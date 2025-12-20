import { useRef, useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export default function HandDrawing({ roomCode, canDraw = true, onClear }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const handsRef = useRef(null);
  const streamRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const colorRef = useRef('#ff0000');
  const lineWidthRef = useRef(10);
  const [colorDisplay, setColorDisplay] = useState('#ff0000');
  const [lineWidthDisplay, setLineWidthDisplay] = useState(10);
  const isDrawingRef = useRef(false);
  const { sendMessage, on } = useWebSocket();
  const [canvasReady, setCanvasReady] = useState(false);
  
  // Enhanced tracking with history
  const positionHistoryRef = useRef([]);
  const maxHistoryLength = 5;
  const gestureHistoryRef = useRef([]);
  const lastDrawnPointRef = useRef(null);

  const colors = [
    { name: 'Red', value: '#ff0000' },
    { name: 'Green', value: '#00ff00' },
    { name: 'Blue', value: '#0000ff' },
    { name: 'Yellow', value: '#ffff00' },
    { name: 'Black', value: '#000000' }
  ];

  // Update color without re-render
  const updateColor = useCallback((newColor) => {
    colorRef.current = newColor;
    setColorDisplay(newColor);
  }, []);

  // Update line width without re-render
  const updateLineWidth = useCallback((newWidth) => {
    lineWidthRef.current = newWidth;
    setLineWidthDisplay(newWidth);
  }, []);

  // Check if canvas elements are ready
  useEffect(() => {
    if (canvasRef.current && drawCanvasRef.current) {
      console.log('✅ Canvas elements are ready');
      setCanvasReady(true);
    }
  }, []);

  // Kalman-like filter for ultra-smooth tracking
  const getSmoothedPosition = useCallback((rawX, rawY) => {
    const history = positionHistoryRef.current;
    
    // Add new position
    history.push({ x: rawX, y: rawY });
    
    // Keep only recent history
    if (history.length > maxHistoryLength) {
      history.shift();
    }

    // If we don't have enough history, return raw position
    if (history.length < 2) {
      return { x: rawX, y: rawY };
    }

    // Weighted average with more weight on recent positions
    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;

    history.forEach((pos, index) => {
      const weight = (index + 1) / history.length; // More recent = higher weight
      weightedX += pos.x * weight;
      weightedY += pos.y * weight;
      totalWeight += weight;
    });

    return {
      x: weightedX / totalWeight,
      y: weightedY / totalWeight
    };
  }, []);

  // Robust gesture detection with history
  const detectGesture = useCallback((landmarks) => {
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const indexMcp = landmarks[5];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];

    // More lenient finger detection
    const indexUp = indexTip.y < indexPip.y - 0.01;
    const middleUp = middleTip.y < middlePip.y - 0.01;
    const ringDown = ringTip.y > ringPip.y;
    const pinkyDown = pinkyTip.y > pinkyPip.y;

    // Determine gesture
    let gesture = 'idle';
    if (indexUp && middleUp) {
      gesture = 'selection';
    } else if (indexUp && !middleUp && ringDown && pinkyDown) {
      gesture = 'drawing';
    }

    // Add to history
    gestureHistoryRef.current.push(gesture);
    if (gestureHistoryRef.current.length > 3) {
      gestureHistoryRef.current.shift();
    }

    // Return most common gesture in history (voting)
    const gestureCounts = {};
    gestureHistoryRef.current.forEach(g => {
      gestureCounts[g] = (gestureCounts[g] || 0) + 1;
    });

    let mostCommon = gesture;
    let maxCount = 0;
    Object.keys(gestureCounts).forEach(g => {
      if (gestureCounts[g] > maxCount) {
        maxCount = gestureCounts[g];
        mostCommon = g;
      }
    });

    return mostCommon;
  }, []);

  // Draw smooth bezier curve between points
  const drawSmoothLine = useCallback((ctx, points, color, lineWidth) => {
    if (points.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
    } else {
      // Use quadratic curves for smoother lines
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      // Last segment
      const lastPoint = points[points.length - 1];
      const secondLastPoint = points[points.length - 2];
      ctx.quadraticCurveTo(
        secondLastPoint.x,
        secondLastPoint.y,
        lastPoint.x,
        lastPoint.y
      );
    }

    ctx.stroke();
  }, []);

  useEffect(() => {
    let animationFrame = null;
    let isActive = true;
    let processingFrame = false;

    const initCamera = async () => {
      console.log('🎥 Initializing camera mode...');
      setIsLoading(true);
      setError(null);

      try {
        const videoElement = videoRef.current;
        const canvas = canvasRef.current;
        const drawCanvas = drawCanvasRef.current;

        if (!videoElement || !canvas || !drawCanvas) {
          console.error('❌ Canvas elements not found');
          throw new Error('Canvas elements not ready. Please try again.');
        }

        console.log('✅ All canvas elements found');

        // Stop any existing camera first
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        if (handsRef.current) {
          handsRef.current.close();
          handsRef.current = null;
        }

        const ctx = canvas.getContext('2d', { 
          alpha: false, 
          desynchronized: true,
          willReadFrequently: false 
        });
        const drawCtx = drawCanvas.getContext('2d', { 
          alpha: true, 
          desynchronized: true,
          willReadFrequently: false 
        });
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';

        console.log('🎥 Requesting camera access...');

        // Get camera stream - maximum performance settings
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
            frameRate: { ideal: 60 } // Highest possible frame rate
          },
          audio: false
        });

        if (!isActive) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        videoElement.srcObject = stream;

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Video load timeout')), 3000);
          videoElement.onloadedmetadata = () => {
            clearTimeout(timeout);
            videoElement.play()
              .then(resolve)
              .catch(reject);
          };
          videoElement.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Video loading error'));
          };
        });

        console.log('✅ Camera stream acquired and playing');

        // Import MediaPipe Hands
        console.log('📦 Loading MediaPipe Hands...');
        const { Hands } = await import('@mediapipe/hands');
        
        if (!isActive) return;

        // Initialize MediaPipe Hands - maximum performance
        const hands = new Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          }
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5, // Lower for faster initial detection
          minTrackingConfidence: 0.5
        });

        handsRef.current = hands;

        // Track drawing state
        let currentStroke = [];
        let lastBroadcastTime = 0;
        const broadcastInterval = 16; // ~60fps broadcast

        hands.onResults((results) => {
          if (!ctx || !drawCtx || !isActive) return;

          // Clear and draw camera feed WITH MIRROR EFFECT
          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Mirror the camera feed horizontally
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];

            // Get raw position - MIRRORED
            const indexTip = landmarks[8];
            const rawX = (1 - indexTip.x) * canvas.width;
            const rawY = indexTip.y * canvas.height;

            // Apply smoothing
            const smoothed = getSmoothedPosition(rawX, rawY);

            // Detect gesture
            const gesture = detectGesture(landmarks);

            // Draw finger indicator with gesture-based color
            ctx.save();
            ctx.beginPath();
            ctx.arc(smoothed.x, smoothed.y, 12, 0, 2 * Math.PI);
            
            if (gesture === 'drawing') {
              ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
              ctx.fill();
              ctx.strokeStyle = '#00ff00';
              ctx.lineWidth = 4;
              ctx.stroke();
            } else if (gesture === 'selection') {
              ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
              ctx.fill();
              ctx.strokeStyle = '#ffa500';
              ctx.lineWidth = 4;
              ctx.stroke();
            } else {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 3;
              ctx.stroke();
            }
            
            ctx.restore();

            // Selection mode - change color
            if (gesture === 'selection' && smoothed.y < 100) {
              const colorWidth = canvas.width / colors.length;
              const selectedIndex = Math.floor(smoothed.x / colorWidth);
              if (selectedIndex >= 0 && selectedIndex < colors.length) {
                updateColor(colors[selectedIndex].value);
              }
            }
            // Drawing mode - CONTINUOUS TRACKING
            else if (gesture === 'drawing' && smoothed.y > 100 && canDraw) {
              // Add point to current stroke
              currentStroke.push({ x: smoothed.x, y: smoothed.y });

              // Draw immediately on local canvas
              if (currentStroke.length >= 2) {
                const lastTwo = currentStroke.slice(-2);
                
                drawCtx.strokeStyle = colorRef.current;
                drawCtx.lineWidth = lineWidthRef.current;
                drawCtx.lineCap = 'round';
                drawCtx.lineJoin = 'round';
                drawCtx.beginPath();
                drawCtx.moveTo(lastTwo[0].x, lastTwo[0].y);
                drawCtx.lineTo(lastTwo[1].x, lastTwo[1].y);
                drawCtx.stroke();
              }

              // Broadcast periodically to reduce network load
              const now = performance.now();
              if (now - lastBroadcastTime > broadcastInterval && currentStroke.length >= 2) {
                // Send recent segment
                const recentPoints = currentStroke.slice(-3);
                for (let i = 1; i < recentPoints.length; i++) {
                  sendMessage('CANVAS_DRAW', {
                    roomCode,
                    drawData: {
                      x0: recentPoints[i - 1].x,
                      y0: recentPoints[i - 1].y,
                      x1: recentPoints[i].x,
                      y1: recentPoints[i].y,
                      color: colorRef.current,
                      lineWidth: lineWidthRef.current
                    }
                  });
                }
                lastBroadcastTime = now;
              }

              isDrawingRef.current = true;
              lastDrawnPointRef.current = smoothed;
            } else {
              // End of stroke
              if (isDrawingRef.current && currentStroke.length > 0) {
                // Broadcast any remaining points
                for (let i = 1; i < currentStroke.length; i++) {
                  sendMessage('CANVAS_DRAW', {
                    roomCode,
                    drawData: {
                      x0: currentStroke[i - 1].x,
                      y0: currentStroke[i - 1].y,
                      x1: currentStroke[i].x,
                      y1: currentStroke[i].y,
                      color: colorRef.current,
                      lineWidth: lineWidthRef.current
                    }
                  });
                }
                currentStroke = [];
              }
              isDrawingRef.current = false;
              lastDrawnPointRef.current = null;
            }
          } else {
            // No hand detected - end stroke
            if (isDrawingRef.current && currentStroke.length > 0) {
              // Broadcast remaining points
              for (let i = 1; i < currentStroke.length; i++) {
                sendMessage('CANVAS_DRAW', {
                  roomCode,
                  drawData: {
                    x0: currentStroke[i - 1].x,
                    y0: currentStroke[i - 1].y,
                    x1: currentStroke[i].x,
                    y1: currentStroke[i].y,
                    color: colorRef.current,
                    lineWidth: lineWidthRef.current
                  }
                });
              }
              currentStroke = [];
            }
            isDrawingRef.current = false;
            lastDrawnPointRef.current = null;
            positionHistoryRef.current = [];
            gestureHistoryRef.current = [];
          }
        });

        console.log('🖐️ Starting hand detection...');

        // HIGH-FREQUENCY frame processing for maximum responsiveness
        const processFrame = async () => {
          if (!isActive || !handsRef.current || !videoElement || processingFrame) return;
          
          processingFrame = true;
          
          try {
            await handsRef.current.send({ image: videoElement });
          } catch (err) {
            console.error('Frame processing error:', err);
          }
          
          processingFrame = false;
          
          if (isActive) {
            // Use requestAnimationFrame for maximum frame rate
            animationFrame = requestAnimationFrame(processFrame);
          }
        };

        // Start processing frames immediately
        processFrame();
        
        console.log('✅ Hand tracking initialized successfully');
        console.log('🎉 Camera mode ready! Ultra-responsive tracking active.');
        setIsLoading(false);
        setError(null);

      } catch (err) {
        console.error('❌ Error initializing camera:', err);
        const errorMsg = err.name === 'NotAllowedError' 
          ? 'Camera access denied. Please allow camera permission in your browser settings.'
          : err.name === 'NotFoundError'
          ? 'No camera found. Please connect a camera and try again.'
          : err.name === 'NotReadableError'
          ? 'Camera is in use by another app. Please close other apps and try again.'
          : err.message || 'Failed to initialize camera. Please check permissions.';
        setError(errorMsg);
        setIsLoading(false);
      }
    };

    // Initialize camera only when canvas is ready and canDraw is true
    if (canDraw && canvasReady) {
      console.log('🚀 Starting camera initialization (canvas ready)...');
      initCamera();
      
      return () => {
        isActive = false;

        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }

        if (handsRef.current) {
          handsRef.current.close();
          handsRef.current = null;
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            track.stop();
            console.log('🛑 Stopped camera track');
          });
          streamRef.current = null;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }

        // Reset tracking state
        positionHistoryRef.current = [];
        gestureHistoryRef.current = [];
        lastDrawnPointRef.current = null;
      };
    }

    return () => {
      isActive = false;
      
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      if (handsRef.current) {
        handsRef.current.close();
        handsRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [canDraw, canvasReady, roomCode, sendMessage, updateColor, getSmoothedPosition, detectGesture, drawSmoothLine]);

  // Listen for drawing from other players
  useEffect(() => {
    const unsubDraw = on('CANVAS_DRAW', (data) => {
      const { drawData } = data.payload;
      if (!drawData) return;

      const drawCanvas = drawCanvasRef.current;
      if (!drawCanvas) return;

      const drawCtx = drawCanvas.getContext('2d');
      drawCtx.strokeStyle = drawData.color;
      drawCtx.lineWidth = drawData.lineWidth;
      drawCtx.lineCap = 'round';
      drawCtx.lineJoin = 'round';
      
      // Simple line drawing
      drawCtx.beginPath();
      drawCtx.moveTo(drawData.x0, drawData.y0);
      drawCtx.lineTo(drawData.x1, drawData.y1);
      drawCtx.stroke();
    });

    const unsubClear = on('CANVAS_CLEAR', () => {
      const drawCanvas = drawCanvasRef.current;
      if (!drawCanvas) return;
      const drawCtx = drawCanvas.getContext('2d');
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    });

    return () => {
      unsubDraw?.();
      unsubClear?.();
    };
  }, [on]);

  const clearCanvas = useCallback(() => {
    const drawCanvas = drawCanvasRef.current;
    if (!drawCanvas) return;
    const drawCtx = drawCanvas.getContext('2d');
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    sendMessage('CANVAS_CLEAR', { roomCode });
    if (onClear) onClear();
  }, [roomCode, sendMessage, onClear]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Drawing Tools - Only show for drawer */}
      {canDraw && (
        <div className="flex gap-4 items-center bg-gray-800 p-4 rounded-lg flex-wrap">
          <div className="flex gap-2 items-center">
            <label className="text-white text-sm">Color:</label>
            <input
              type="color"
              value={colorDisplay}
              onChange={(e) => updateColor(e.target.value)}
              className="w-12 h-8 cursor-pointer rounded"
            />
          </div>

          <div className="flex gap-2 items-center">
            <label className="text-white text-sm">Size:</label>
            <input
              type="range"
              min="5"
              max="30"
              value={lineWidthDisplay}
              onChange={(e) => updateLineWidth(parseInt(e.target.value))}
              className="w-32"
            />
            <span className="text-white text-sm w-8">{lineWidthDisplay}px</span>
          </div>

          <button
            onClick={clearCanvas}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition font-bold"
          >
            🗑️ Clear
          </button>
        </div>
      )}

      {isLoading && (
        <div className="w-[640px] h-[480px] flex items-center justify-center bg-gray-800 rounded-lg border-4 border-gray-700">
          <div className="text-center">
            <div className="animate-spin text-6xl mb-4">📷</div>
            <p className="text-white text-xl font-bold">Loading camera...</p>
            <p className="text-gray-400 text-sm mt-2">Please allow camera access</p>
          </div>
        </div>
      )}

      {error && (
        <div className="w-[640px] p-6 bg-red-900/20 border-4 border-red-500 rounded-lg">
          <div className="text-center">
            <p className="text-red-500 text-xl font-bold mb-2">❌ Camera Error</p>
            <p className="text-red-300 text-sm">{error}</p>
            <p className="text-gray-400 text-xs mt-3">
              💡 Try: Close other apps using camera, refresh page, or use mouse mode
            </p>
          </div>
        </div>
      )}

      {/* Camera + Drawing Canvas Container - Always render to ensure refs exist */}
      <div className={`relative ${isLoading || error ? 'hidden' : ''}`}>
        {/* Color Palette Overlay */}
        {canDraw && (
          <div className="absolute top-2 left-2 right-2 flex gap-2 z-10">
            {colors.map((c, i) => (
              <div
                key={i}
                className="flex-1 h-16 rounded cursor-pointer border-2 border-white flex items-center justify-center text-white font-bold text-sm shadow-lg"
                style={{ backgroundColor: c.value }}
              >
                {c.name}
              </div>
            ))}
          </div>
        )}

        {/* Camera Feed */}
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          autoPlay
          muted
        />

        {/* Camera Visualization Canvas */}
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="border-4 border-gray-700 rounded-lg"
        />

        {/* Drawing Canvas (overlay) */}
        <canvas
          ref={drawCanvasRef}
          width={640}
          height={480}
          className="absolute top-0 left-0 pointer-events-none"
        />
      </div>

      {canDraw && !isLoading && !error && (
        <div className="text-gray-300 text-sm text-center bg-gray-800 p-3 rounded-lg">
          <p className="font-bold mb-1">✋ Ultra-Responsive Hand Tracking:</p>
          <p>☝️ Index finger only = Draw (captures every movement!)</p>
          <p>✌️ Index + Middle = Select color (top bar)</p>
          <p className="text-xs text-green-400 mt-2">✨ Zero lag - continuous tracking</p>
        </div>
      )}

      {!canDraw && (
        <p className="text-gray-400 text-sm">
          👀 Watch and guess what's being drawn!
        </p>
      )}
    </div>
  );
}