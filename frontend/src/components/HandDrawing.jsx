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
  const prevPosRef = useRef({ x: 0, y: 0 });
  const isDrawingRef = useRef(false);
  const { sendMessage, on } = useWebSocket();
  const [canvasReady, setCanvasReady] = useState(false);

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

  useEffect(() => {
    let animationFrame = null;
    let isActive = true;
    let smoothX = 0, smoothY = 0;
    const alpha = 0.3; // Increased smoothing for better performance

    const initCamera = async () => {
      console.log('🎥 Initializing camera mode...');
      setIsLoading(true);
      setError(null);

      try {
        // Wait for canvas elements to be ready
        const videoElement = videoRef.current;
        const canvas = canvasRef.current;
        const drawCanvas = drawCanvasRef.current;

        if (!videoElement || !canvas || !drawCanvas) {
          console.error('❌ Canvas elements not found:', { videoElement: !!videoElement, canvas: !!canvas, drawCanvas: !!drawCanvas });
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

        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        const drawCtx = drawCanvas.getContext('2d', { alpha: true, desynchronized: true });
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';

        console.log('🎥 Requesting camera access...');

        // Get camera stream with lower resolution for faster loading
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, max: 640 },
            height: { ideal: 480, max: 480 },
            facingMode: 'user',
            frameRate: { ideal: 30 }
          },
          audio: false
        });

        if (!isActive) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        videoElement.srcObject = stream;

        // Faster video loading
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

        // Initialize MediaPipe Hands with faster settings
        const hands = new Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          }
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 0, // Reduced from 1 for faster processing
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        handsRef.current = hands;

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

            // Get finger positions
            const indexTip = landmarks[8];
            const indexPip = landmarks[6];
            const indexMcp = landmarks[5];
            const middleTip = landmarks[12];
            const middlePip = landmarks[10];
            const ringTip = landmarks[16];
            const pinkyTip = landmarks[20];

            // Check if fingers are extended
            const indexUp = indexTip.y < indexPip.y - 0.02 && indexPip.y < indexMcp.y;
            const middleUp = middleTip.y < middlePip.y - 0.02;
            const ringDown = ringTip.y > landmarks[14].y;
            const pinkyDown = pinkyTip.y > landmarks[18].y;

            // Position - MIRRORED for natural drawing
            const x = (1 - indexTip.x) * canvas.width; // Flip X coordinate
            const y = indexTip.y * canvas.height;

            // Smooth position
            if (smoothX === 0 && smoothY === 0) {
              smoothX = x;
              smoothY = y;
            } else {
              smoothX = alpha * x + (1 - alpha) * smoothX;
              smoothY = alpha * y + (1 - alpha) * smoothY;
            }

            const drawingActive = indexUp && !middleUp && ringDown && pinkyDown && canDraw;
            const selectionMode = indexUp && middleUp;

            // Draw finger indicator on camera canvas
            ctx.save();
            ctx.beginPath();
            ctx.arc(smoothX, smoothY, 15, 0, 2 * Math.PI);
            ctx.fillStyle = drawingActive ? 'rgba(0, 255, 0, 0.7)' : 
                           selectionMode ? 'rgba(255, 165, 0, 0.7)' : 
                           'rgba(255, 255, 255, 0.5)';
            ctx.fill();
            ctx.strokeStyle = drawingActive ? '#00ff00' : selectionMode ? '#ffa500' : '#fff';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();

            // Selection mode - change color
            if (selectionMode && y < 100) {
              const colorWidth = canvas.width / colors.length;
              const selectedIndex = Math.floor(smoothX / colorWidth);
              if (selectedIndex >= 0 && selectedIndex < colors.length) {
                updateColor(colors[selectedIndex].value);
              }
            }
            // Drawing mode
            else if (drawingActive && y > 100) {
              if (!isDrawingRef.current) {
                isDrawingRef.current = true;
                prevPosRef.current = { x: smoothX, y: smoothY };
              } else {
                // Draw on canvas
                drawCtx.strokeStyle = colorRef.current;
                drawCtx.lineWidth = lineWidthRef.current;
                drawCtx.beginPath();
                drawCtx.moveTo(prevPosRef.current.x, prevPosRef.current.y);
                drawCtx.lineTo(smoothX, smoothY);
                drawCtx.stroke();

                // Broadcast to other players
                sendMessage('CANVAS_DRAW', {
                  roomCode,
                  drawData: {
                    x0: prevPosRef.current.x,
                    y0: prevPosRef.current.y,
                    x1: smoothX,
                    y1: smoothY,
                    color: colorRef.current,
                    lineWidth: lineWidthRef.current
                  }
                });

                prevPosRef.current = { x: smoothX, y: smoothY };
              }
            } else {
              isDrawingRef.current = false;
            }
          } else {
            isDrawingRef.current = false;
          }
        });

        console.log('🖐️ Starting hand detection...');

        // Process video frames
        const processFrame = async () => {
          if (!isActive || !handsRef.current || !videoElement) return;
          
          try {
            await handsRef.current.send({ image: videoElement });
          } catch (err) {
            console.error('Frame processing error:', err);
          }
          
          if (isActive) {
            animationFrame = requestAnimationFrame(processFrame);
          }
        };

        // Start processing frames
        processFrame();
        
        console.log('✅ Hand tracking initialized successfully');
        console.log('🎉 Camera mode ready! Hand tracking active.');
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
      // Immediate initialization for faster loading
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
  }, [canDraw, canvasReady, roomCode, sendMessage, updateColor]);

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
          <p className="font-bold mb-1">✋ Hand Gesture Controls:</p>
          <p>☝️ Index finger only = Draw</p>
          <p>✌️ Index + Middle = Select color (top bar)</p>
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