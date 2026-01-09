import { useRef, useEffect, useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export default function Canvas({ roomCode, canDraw = true, onClear, useCamera = false }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const { sendMessage, on } = useWebSocket();

  // Handle canvas resize for responsiveness
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const containerWidth = container.clientWidth;

        // Calculate responsive dimensions
        let width = Math.min(containerWidth - 32, 800); // Max 800px, with padding
        let height = Math.floor(width * 0.75); // 4:3 aspect ratio

        // Mobile adjustments
        if (window.innerWidth < 768) {
          width = containerWidth - 16;
          height = Math.floor(width * 0.75);
        }

        setCanvasSize({ width, height });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Listen for drawing from other players
    const unsubDraw = on('CANVAS_DRAW', (data) => {
      const { drawData } = data.payload;
      if (!drawData) return;

      ctx.strokeStyle = drawData.color;
      ctx.lineWidth = drawData.lineWidth;

      ctx.beginPath();
      ctx.moveTo(drawData.x0, drawData.y0);
      ctx.lineTo(drawData.x1, drawData.y1);
      ctx.stroke();
      ctx.closePath();
    });

    // Listen for canvas clear
    const unsubClear = on('CANVAS_CLEAR', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      unsubDraw?.();
      unsubClear?.();
    };
  }, [on]);

  const getPointerPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Handle both mouse and touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    if (!canDraw) return;

    e.preventDefault(); // Prevent scrolling on touch
    const pos = getPointerPos(e);
    setIsDrawing(true);
    setLastPos(pos);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!isDrawing || !canDraw) return;

    e.preventDefault(); // Prevent scrolling on touch
    const pos = getPointerPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Draw locally
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    // Broadcast to other players
    sendMessage('CANVAS_DRAW', {
      roomCode,
      drawData: {
        x0: lastPos.x,
        y0: lastPos.y,
        x1: pos.x,
        y1: pos.y,
        color,
        lineWidth
      }
    });

    setLastPos(pos);
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;

    if (e) e.preventDefault();
    setIsDrawing(false);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.closePath();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    sendMessage('CANVAS_CLEAR', { roomCode });
    if (onClear) onClear();
  };

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-4 w-full">
      {/* Drawing Tools - Only show for drawer */}
      {canDraw && (
        <div className="flex flex-wrap gap-3 md:gap-4 items-center bg-gray-800 p-3 md:p-4 rounded-lg w-full max-w-2xl justify-center">
          <div className="flex gap-2 items-center">
            <label className="text-white text-xs md:text-sm font-bold">Color:</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-8 md:w-12 md:h-10 cursor-pointer rounded"
            />
          </div>

          <div className="flex gap-2 items-center flex-1 min-w-[150px]">
            <label className="text-white text-xs md:text-sm font-bold">Size:</label>
            <input
              type="range"
              min="1"
              max="20"
              value={lineWidth}
              onChange={(e) => setLineWidth(parseInt(e.target.value))}
              className="flex-1 max-w-[120px]"
            />
            <span className="text-white text-xs md:text-sm w-8">{lineWidth}px</span>
          </div>

          <button
            onClick={clearCanvas}
            className="px-3 py-2 md:px-4 md:py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition font-bold text-sm md:text-base"
          >
            Clear
          </button>
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="border-4 border-gray-700 rounded-lg bg-white max-w-full"
        style={{
          cursor: canDraw ? 'crosshair' : 'not-allowed',
          touchAction: 'none',
          width: '100%',
          height: 'auto',
          maxWidth: `${canvasSize.width}px`
        }}
        // Mouse events
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        // Touch events
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        onTouchCancel={stopDrawing}
      />

      {!canDraw && (
        <p className="text-gray-400 text-xs md:text-sm">
          👀 Watch and guess what's being drawn!
        </p>
      )}
    </div>
  );
}