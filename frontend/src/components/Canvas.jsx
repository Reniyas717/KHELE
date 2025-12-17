import { useRef, useEffect, useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export default function Canvas({ roomCode, canDraw = true, onClear }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const { sendMessage, on } = useWebSocket();

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

      console.log('🎨 Received draw data from other player');

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
      console.log('🧹 Received canvas clear');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      unsubDraw?.();
      unsubClear?.();
    };
  }, [on]);

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    if (!canDraw) return;
    
    const pos = getMousePos(e);
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

    const pos = getMousePos(e);
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

  const stopDrawing = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.closePath();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Broadcast clear to other players
    sendMessage('CANVAS_CLEAR', { roomCode });

    if (onClear) onClear();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Drawing Tools - Only show for drawer */}
      {canDraw && (
        <div className="flex gap-4 items-center bg-gray-800 p-4 rounded-lg">
          <div className="flex gap-2 items-center">
            <label className="text-white text-sm">Color:</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-12 h-8 cursor-pointer rounded"
            />
          </div>

          <div className="flex gap-2 items-center">
            <label className="text-white text-sm">Size:</label>
            <input
              type="range"
              min="1"
              max="20"
              value={lineWidth}
              onChange={(e) => setLineWidth(parseInt(e.target.value))}
              className="w-32"
            />
            <span className="text-white text-sm w-8">{lineWidth}px</span>
          </div>

          <button
            onClick={clearCanvas}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition font-bold"
          >
            🗑️ Clear
          </button>
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border-4 border-gray-700 rounded-lg bg-white"
        style={{ 
          cursor: canDraw ? 'crosshair' : 'not-allowed',
          touchAction: 'none'
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />

      {!canDraw && (
        <p className="text-gray-400 text-sm">
          👀 Watch and guess what's being drawn!
        </p>
      )}
    </div>
  );
}