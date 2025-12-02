import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export default function ScribbleGame({ roomCode, username, players, onLeaveRoom }) {
  const [gameState, setGameState] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const [guess, setGuess] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const { sendMessage, on } = useWebSocket();

  useEffect(() => {
    console.log('🎨 ScribbleGame mounted for room:', roomCode, 'user:', username);
    
    // Listen for game updates
    const unsubscribeGameStarted = on('GAME_STARTED', (payload) => {
      console.log('🎨 Scribble Game started:', payload);
      console.log('🎨 Game state received:', JSON.stringify(payload.gameState, null, 2));
      
      if (payload.gameState) {
        setGameState(payload.gameState);
        console.log('✅ Game state set successfully');
      } else {
        console.error('❌ No game state in payload!');
      }
    });

    const unsubscribeDrawLine = on('DRAW_LINE', (payload) => {
      if (canvasRef.current) {
        drawLineOnCanvas(payload.line);
      }
    });

    const unsubscribeClearCanvas = on('CLEAR_CANVAS', () => {
      clearCanvas();
    });

    const unsubscribeChatMessage = on('CHAT_MESSAGE', (payload) => {
      setChatMessages(prev => [...prev, { username: payload.username, message: payload.message }]);
    });

    const unsubscribeCorrectGuess = on('CORRECT_GUESS', (payload) => {
      setChatMessages(prev => [...prev, { 
        username: 'System', 
        message: `${payload.username} guessed the word!`,
        isSystem: true 
      }]);
      setGameState(payload.gameState);
    });

    const unsubscribeNextRound = on('NEXT_ROUND', (payload) => {
      setGameState(payload.gameState);
      clearCanvas();
      setChatMessages([]);
    });

    const unsubscribeGameOver = on('GAME_OVER', (payload) => {
      alert(`Game Over! ${payload.winner} wins with ${payload.finalScores[payload.winner]} points!`);
    });

    return () => {
      console.log('🧹 Cleaning up ScribbleGame');
      unsubscribeGameStarted();
      unsubscribeDrawLine();
      unsubscribeClearCanvas();
      unsubscribeChatMessage();
      unsubscribeCorrectGuess();
      unsubscribeNextRound();
      unsubscribeGameOver();
    };
  }, []); // Empty dependency array - only run once

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
  }, []);

  const drawLineOnCanvas = (line) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.width;

    ctx.beginPath();
    ctx.moveTo(line.x0, line.y0);
    ctx.lineTo(line.x1, line.y1);
    ctx.stroke();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const startDrawing = (e) => {
    if (!isMyTurn()) return;
    setIsDrawing(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const draw = (e) => {
    if (!isDrawing || !isMyTurn()) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    const lastX = canvas.lastX || x;
    const lastY = canvas.lastY || y;

    const line = {
      x0: lastX,
      y0: lastY,
      x1: x,
      y1: y,
      color: ctx.strokeStyle,
      width: ctx.lineWidth
    };

    drawLineOnCanvas(line);
    sendMessage('DRAW_LINE', { roomCode, line });

    canvas.lastX = x;
    canvas.lastY = y;
  };

  const handleClearCanvas = () => {
    if (!isMyTurn()) return;
    clearCanvas();
    sendMessage('CLEAR_CANVAS', { roomCode });
  };

  const handleGuess = (e) => {
    e.preventDefault();
    if (!guess.trim()) return;

    sendMessage('GUESS_WORD', { roomCode, username, guess: guess.trim() });
    setGuess('');
  };

  const handleNextRound = () => {
    sendMessage('NEXT_ROUND', { roomCode });
  };

  const isMyTurn = () => {
    return gameState?.currentDrawer === username;
  };

  // Show loading state while waiting for game state
  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-500 to-pink-500 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-800">Loading Scribble Game...</h2>
          <p className="text-gray-600 mt-2">Please wait while we set up the game</p>
        </div>
      </div>
    );
  }

  const currentDrawer = gameState.currentDrawer;
  const currentWord = gameState.currentWord;
  const roundNumber = gameState.round || 1;
  const maxRounds = gameState.maxRounds || 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-500 to-pink-500 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                ✏️ Scribble
              </h1>
              <p className="text-sm text-gray-600">Room: {roomCode}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-800">Round {roundNumber}/{maxRounds}</p>
              <p className="text-sm text-gray-600">
                {isMyTurn() ? `Your word: ${currentWord}` : 'Guess the drawing!'}
              </p>
            </div>
            <button
              onClick={onLeaveRoom}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              Leave Game
            </button>
          </div>
        </div>

        {/* Players Scoreboard */}
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
          <h2 className="text-lg font-bold mb-3">Players</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {gameState.players?.map((player) => (
              <div
                key={player.username}
                className={`p-3 rounded-lg ${
                  player.username === currentDrawer
                    ? 'bg-blue-100 border-2 border-blue-500'
                    : 'bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {player.username}
                    {player.username === username && ' (You)'}
                  </span>
                  <span className="text-xl font-bold text-blue-500">
                    {player.score || 0}
                  </span>
                </div>
                {player.username === currentDrawer && (
                  <p className="text-xs text-blue-600 mt-1">✏️ Drawing</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Canvas */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl p-4">
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">
                  {isMyTurn() ? '🎨 Draw your word!' : '👀 Watch and guess!'}
                </h2>
                {isMyTurn() && (
                  <button
                    onClick={handleClearCanvas}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    Clear Canvas
                  </button>
                )}
              </div>
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseMove={draw}
                onMouseLeave={stopDrawing}
                className={`border-2 border-gray-300 rounded-lg w-full ${
                  isMyTurn() ? 'cursor-crosshair' : 'cursor-not-allowed'
                }`}
              />
            </div>
          </div>

          {/* Chat & Guess */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl p-4 h-full flex flex-col">
              <h2 className="text-xl font-bold mb-4">Chat</h2>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-2">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded-lg ${
                      msg.isSystem
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100'
                    }`}
                  >
                    <span className="font-semibold">{msg.username}:</span>{' '}
                    <span>{msg.message}</span>
                  </div>
                ))}
              </div>

              {/* Guess Input */}
              {!isMyTurn() && (
                <form onSubmit={handleGuess} className="flex gap-2">
                  <input
                    type="text"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    placeholder="Type your guess..."
                    className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    Send
                  </button>
                </form>
              )}

              {/* Next Round Button (for drawer) */}
              {isMyTurn() && gameState.allGuessed && (
                <button
                  onClick={handleNextRound}
                  className="w-full mt-4 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-bold"
                >
                  Next Round →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
