import { useRef, useEffect, useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export default function Canvas({ roomCode, canDraw = true, onClear }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);
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

      console.log('🎨 Received draw data from other player:', drawData);

      ctx.strokeStyle = drawData.color;
      ctx.lineWidth = drawData.lineWidth;

      ctx.beginPath();
      ctx.moveTo(drawData.x0, drawData.y0);
      ctx.lineTo(drawData.x1, drawData.y1);
      ctx.stroke();
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

  const startDrawing = (e) => {
    if (!canDraw) return;
    setIsDrawing(true);

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing || !canDraw) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x1 = e.clientX - rect.left;
    const y1 = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    const x0 = ctx.getImageData(0, 0, 1, 1); // Get last position

    ctx.lineTo(x1, y1);
    ctx.stroke();

    // Broadcast drawing to other players
    const prevX = e.clientX - e.movementX - rect.left;
    const prevY = e.clientY - e.movementY - rect.top;

    sendMessage('CANVAS_DRAW', {
      roomCode,
      drawData: {
        x0: prevX,
        y0: prevY,
        x1,
        y1,
        color,
        lineWidth
      }
    });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
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
          <div className="flex gap-2">
            <label className="text-white text-sm">Color:</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-12 h-8 cursor-pointer"
            />
          </div>

          <div className="flex gap-2">
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
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
          >
            Clear
          </button>
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border-4 border-gray-700 rounded-lg bg-white cursor-crosshair"
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