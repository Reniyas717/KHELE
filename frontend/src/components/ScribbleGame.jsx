import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export default function ScribbleGame({ roomCode, username, players, initialGameState, onLeaveRoom }) {
  const [gameState, setGameState] = useState(initialGameState);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const [guess, setGuess] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [showWordSelection, setShowWordSelection] = useState(false);
  const { sendMessage, on, isConnected } = useWebSocket();
  const setupComplete = useRef(false);
  const lastPoint = useRef({ x: 0, y: 0 });

  // Update game state when initialGameState prop changes
  useEffect(() => {
    if (initialGameState) {
      console.log('📦 Received initial Scribble game state:', initialGameState);
      console.log('👤 Current drawer:', initialGameState.currentDrawer);
      console.log('📝 Word options:', initialGameState.wordOptions);
      console.log('🎨 Current word:', initialGameState.currentWord);
      
      setGameState(initialGameState);
      
      // Show word selection if drawer and no word selected
      const shouldShowSelection = 
        initialGameState.currentDrawer === username && 
        !initialGameState.currentWord && 
        initialGameState.wordOptions && 
        initialGameState.wordOptions.length > 0;
      
      console.log('🔍 Should show word selection?', shouldShowSelection);
      
      if (shouldShowSelection) {
        setShowWordSelection(true);
      }
    }
  }, [initialGameState, username]);

  useEffect(() => {
    // Skip if already setup
    if (setupComplete.current) return;
    setupComplete.current = true;

    console.log('🎨 ScribbleGame mounted for room:', roomCode, 'user:', username);

    // Listen for game updates
    const unsubscribeWordSelected = on('WORD_SELECTED', (payload) => {
      console.log('📝 Word selected:', payload);
      setGameState(payload.gameState);
      setShowWordSelection(false);
    });

    const unsubscribeGameStarted = on('GAME_STARTED', (payload) => {
      console.log('🎨 Game started:', payload);
      if (payload.gameState && payload.gameType === 'scribble') {
        setGameState(payload.gameState);
        if (payload.gameState.currentDrawer === username && !payload.gameState.currentWord) {
          setShowWordSelection(true);
        }
      }
    });

    const unsubscribeDrawLine = on('DRAW_LINE', (payload) => {
      if (canvasRef.current && payload.line) {
        drawLineOnCanvas(payload.line);
      }
    });

    const unsubscribeClearCanvas = on('CLEAR_CANVAS', () => {
      clearCanvas();
    });

    const unsubscribeChatMessage = on('CHAT_MESSAGE', (payload) => {
      setChatMessages(prev => [...prev, { 
        username: payload.username, 
        message: payload.message 
      }]);
    });

    const unsubscribeCorrectGuess = on('CORRECT_GUESS', (payload) => {
      setChatMessages(prev => [...prev, { 
        username: 'System', 
        message: `${payload.username} guessed correctly! 🎉`,
        isSystem: true 
      }]);
      setGameState(payload.gameState);
      
      // Auto next round if all guessed
      if (payload.gameState.allGuessed) {
        setTimeout(() => {
          handleNextRound();
        }, 3000);
      }
    });

    const unsubscribeNextRound = on('NEXT_ROUND', (payload) => {
      setGameState(payload.gameState);
      clearCanvas();
      setChatMessages([]);
      
      // Show word selection if you're the new drawer
      if (payload.gameState.currentDrawer === username && !payload.gameState.currentWord) {
        setShowWordSelection(true);
      }
    });

    const unsubscribeGameOver = on('GAME_OVER', (payload) => {
      const scoresText = payload.finalScores
        .sort((a, b) => b.score - a.score)
        .map((p, i) => `${i + 1}. ${p.username}: ${p.score}`)
        .join('\n');
      
      alert(`🏆 Game Over!\n\nWinner: ${payload.winner}\n\nFinal Scores:\n${scoresText}`);
      onLeaveRoom();
    });

    // Request game state as fallback
    if (!gameState && !initialGameState) {
      setTimeout(() => {
        sendMessage('REQUEST_GAME_STATE', { roomCode });
      }, 1000);
    }

    return () => {
      console.log('🧹 Cleaning up ScribbleGame');
      unsubscribeWordSelected();
      unsubscribeGameStarted();
      unsubscribeDrawLine();
      unsubscribeClearCanvas();
      unsubscribeChatMessage();
      unsubscribeCorrectGuess();
      unsubscribeNextRound();
      unsubscribeGameOver();
    };
  }, []); // Empty dependency - run once

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    
    // Enable smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }, []);

  const drawLineOnCanvas = (line) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = line.color || '#000000';
    ctx.lineWidth = line.width || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

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
    if (!isMyTurn() || !gameState.drawingStarted) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    lastPoint.current = { x, y };
    setIsDrawing(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const draw = (e) => {
    if (!isDrawing || !isMyTurn() || !gameState.drawingStarted) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const ctx = canvas.getContext('2d');
    const line = {
      x0: lastPoint.current.x,
      y0: lastPoint.current.y,
      x1: x,
      y1: y,
      color: ctx.strokeStyle,
      width: ctx.lineWidth
    };

    drawLineOnCanvas(line);
    sendMessage('DRAW_LINE', { roomCode, line });

    lastPoint.current = { x, y };
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

  const handleWordSelect = (word) => {
    console.log('📝 Selecting word:', word);
    sendMessage('SELECT_WORD', { roomCode, word });
    setShowWordSelection(false);
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
          <h2 className="text-2xl font-bold text-gray-800">Loading Scribble...</h2>
        </div>
      </div>
    );
  }

  // Word Selection Modal
  if (showWordSelection && isMyTurn()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full">
          <h2 className="text-4xl font-bold text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
            Choose a Word to Draw
          </h2>
          <p className="text-center text-gray-600 mb-8">Pick one word from the options below</p>
          
          <div className="grid grid-cols-1 gap-4">
            {gameState.wordOptions?.map((word, index) => (
              <button
                key={index}
                onClick={() => handleWordSelect(word)}
                className="p-6 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-2xl text-2xl font-bold transition-all transform hover:scale-105 shadow-lg"
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
                {isMyTurn() 
                  ? gameState.currentWord 
                    ? `Your word: ${gameState.currentWord}` 
                    : 'Choosing word...'
                  : gameState.currentWord && gameState.drawingStarted
                    ? `${gameState.currentWord.split('').map((c, i) => i === 0 || i === gameState.currentWord.length - 1 ? c : '_').join(' ')}`
                    : 'Waiting for drawer...'}
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
                  player.username === gameState.currentDrawer
                    ? 'bg-blue-100 border-2 border-blue-500'
                    : player.hasGuessed
                    ? 'bg-green-100 border-2 border-green-500'
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
                {player.username === gameState.currentDrawer && (
                  <p className="text-xs text-blue-600 mt-1">✏️ Drawing</p>
                )}
                {player.hasGuessed && player.username !== gameState.currentDrawer && (
                  <p className="text-xs text-green-600 mt-1">✅ Guessed!</p>
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
                {isMyTurn() && gameState.drawingStarted && (
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
                className={`border-2 border-gray-300 rounded-lg w-full bg-white ${
                  isMyTurn() && gameState.drawingStarted ? 'cursor-crosshair' : 'cursor-not-allowed'
                }`}
              />
            </div>
          </div>

          {/* Chat & Guess */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl p-4 h-full flex flex-col">
              <h2 className="text-xl font-bold mb-4">Chat</h2>
              
              <div className="flex-1 overflow-y-auto mb-4 space-y-2 min-h-[400px] max-h-[500px]">
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

              {!isMyTurn() && gameState.drawingStarted && !gameState.players.find(p => p.username === username)?.hasGuessed && (
                <form onSubmit={handleGuess} className="flex gap-2">
                  <input
                    type="text"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    placeholder="Type your guess..."
                    className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    Send
                  </button>
                </form>
              )}

              {gameState.allGuessed && (
                <div className="mt-4 p-4 bg-green-100 border-2 border-green-500 rounded-lg text-center">
                  <p className="text-green-800 font-bold">
                    🎉 Everyone guessed! Moving to next round...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const handleCreateRoom = async (gameType) => {
  if (!user) {
    alert('Please login first!');
    return;
  }

  try {
    setIsCreating(true);
    console.log(`🎮 Creating ${gameType} room for user:`, user.username);
    
    const response = await api.post('/rooms/create', {
      host: user.username,
      gameType: gameType
    });

    console.log('✅ Room created:', response.data);

    const roomData = response.data.room;
    
    setCurrentRoom({
      code: roomData.roomCode,
      data: roomData,
      preSelectedGame: gameType
    });

    console.log('🚪 Navigating to room:', roomData.roomCode);
  } catch (error) {
    console.error('❌ Error creating room:', error);
    alert(error.response?.data?.message || 'Failed to create room');
  } finally {
    setIsCreating(false);
  }
};
