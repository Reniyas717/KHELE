import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';

export default function ScribbleGame({ roomCode, username, players, initialGameState, onLeaveRoom }) {
  const { colors } = useTheme();
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
    if (setupComplete.current) return;

    console.log('🎮 Setting up ScribbleGame listeners');

    // Listen for drawing updates
    const unsubDrawLine = on('DRAW_LINE', (data) => {
      console.log('✏️ Received DRAW_LINE');
      const line = data.payload?.line || data.line; // Handle both formats
      if (line) {
        drawLineOnCanvas(line);
      }
    });

    const unsubClearCanvas = on('CLEAR_CANVAS', () => {
      console.log('🗑️ Received CLEAR_CANVAS');
      clearCanvas();
    });

    // Listen for word selection
    const unsubWordSelected = on('WORD_SELECTED', (data) => {
      console.log('📝 Received WORD_SELECTED:', data);
      setGameState(data.gameState || data.payload?.gameState);
      setShowWordSelection(false);
    });

    // Listen for correct guesses
    const unsubCorrectGuess = on('CORRECT_GUESS', (data) => {
      console.log('✅ Received CORRECT_GUESS:', data);
      const payload = data.payload || data;
      
      setChatMessages(prev => [...prev, {
        username: 'System',
        message: `${payload.username} guessed correctly! (+${payload.points} points)`,
        isSystem: true,
        isCorrect: true
      }]);
      
      setGameState(payload.gameState);
    });

    // Listen for chat messages (wrong guesses)
    const unsubChatMessage = on('CHAT_MESSAGE', (data) => {
      console.log('💬 Received CHAT_MESSAGE:', data);
      const payload = data.payload || data;
      
      setChatMessages(prev => [...prev, {
        username: payload.username,
        message: payload.message,
        isSystem: payload.isSystem || false
      }]);
    });

    // Listen for next round
    const unsubNextRound = on('NEXT_ROUND', (data) => {
      console.log('➡️ Received NEXT_ROUND');
      setGameState(data.payload?.gameState || data.gameState);
      clearCanvas();
      setChatMessages([]);
    });

    setupComplete.current = true;

    return () => {
      console.log('🧹 Cleaning up ScribbleGame listeners');
      unsubDrawLine?.();
      unsubClearCanvas?.();
      unsubWordSelected?.();
      unsubCorrectGuess?.();
      unsubChatMessage?.();
      unsubNextRound?.();
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
    if (!canDraw) {
      console.log('⚠️ Cannot draw - conditions not met:', { 
        isMyTurn: isMyTurn(), 
        drawingStarted: gameState?.drawingStarted,
        hasWord: !!gameState?.currentWord 
      });
      return;
    }
    
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
    if (!isDrawing || !canDraw) return;

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
    if (!canDraw) return;
    clearCanvas();
    sendMessage('CLEAR_CANVAS', { roomCode });
  };

  const handleGuess = (e) => {
    e.preventDefault();
    if (!guess.trim()) return;

    console.log('📤 Sending guess:', guess);
    sendMessage('GUESS_WORD', { roomCode, username, guess: guess.trim() });
    setGuess('');
  };

  const handleNextRound = () => {
    sendMessage('NEXT_ROUND', { roomCode });
  };

  const handleWordSelect = async (word) => {
    if (!isMyTurn()) return;
    
    console.log('✅ Word selected:', word);
    
    // Send to server
    sendMessage('SELECT_WORD', { roomCode, word });
    
    // Update local state immediately for better UX
    setShowWordSelection(false);
    setGameState(prev => ({
      ...prev,
      currentWord: word,
      drawingStarted: true,
      wordOptions: []
    }));
  };

  const isMyTurn = () => {
    return gameState?.currentDrawer === username;
  };

  const canDraw = isMyTurn() && gameState?.drawingStarted && gameState?.currentWord;

  // Show loading state while waiting for game state
  if (!gameState) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: colors.background }}
      >
        <div 
          className="rounded-3xl shadow-2xl p-8 text-center border"
          style={{
            background: colors.surface,
            borderColor: `${colors.primary}30`,
            backdropFilter: 'blur(20px)'
          }}
        >
          <div 
            className="animate-spin rounded-full h-16 w-16 border-b-4 mx-auto mb-4"
            style={{ borderColor: colors.secondary }}
          ></div>
          <h2 className="text-2xl font-orbitron font-bold" style={{ color: colors.text }}>
            Loading Scribble...
          </h2>
        </div>
      </div>
    );
  }

  // Word Selection Modal
  if (showWordSelection && isMyTurn()) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: colors.background }}
      >
        <div 
          className="rounded-3xl shadow-2xl p-12 max-w-2xl w-full border"
          style={{
            background: colors.surface,
            borderColor: `${colors.secondary}30`,
            backdropFilter: 'blur(20px)'
          }}
        >
          <h2 
            className="text-4xl font-orbitron font-bold text-center mb-4"
            style={{
              background: `linear-gradient(135deg, ${colors.secondary}, ${colors.accent})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Choose a Word to Draw
          </h2>
          <p className="text-center font-poppins mb-8" style={{ color: colors.textSecondary }}>
            Pick one word from the options below
          </p>
          
          <div className="grid grid-cols-1 gap-4">
            {gameState.wordOptions?.map((word, index) => (
              <button
                key={index}
                onClick={() => handleWordSelect(word)}
                className="p-6 rounded-2xl text-2xl font-orbitron font-bold transition-all transform hover:scale-105 shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${colors.secondary}, ${colors.accent})`,
                  color: '#000'
                }}
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
    <div 
      className="min-h-screen p-4"
      style={{ backgroundColor: colors.background }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div 
          className="rounded-2xl shadow-xl p-4 mb-4 border"
          style={{
            background: colors.surface,
            borderColor: `${colors.secondary}30`,
            backdropFilter: 'blur(20px)'
          }}
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 
                className="text-3xl font-orbitron font-black"
                style={{
                  background: `linear-gradient(135deg, ${colors.secondary}, ${colors.accent})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                ✏️ Scribble
              </h1>
              <p className="text-sm font-poppins" style={{ color: colors.textSecondary }}>
                Room: {roomCode}
              </p>
            </div>
            <div className="text-center">
              <p className="text-lg font-orbitron font-bold" style={{ color: colors.text }}>
                Round {roundNumber}/{maxRounds}
              </p>
              <p className="text-sm font-poppins" style={{ color: colors.textSecondary }}>
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
              className="px-4 py-2 rounded-lg font-raleway font-semibold transition-colors border"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.5)',
                color: '#ef4444'
              }}
            >
              Leave Game
            </button>
          </div>
        </div>

        {/* Players Scoreboard */}
        <div 
          className="rounded-2xl shadow-xl p-4 mb-4 border"
          style={{
            background: colors.surface,
            borderColor: `${colors.secondary}30`,
            backdropFilter: 'blur(20px)'
          }}
        >
          <h2 className="text-lg font-orbitron font-bold mb-3" style={{ color: colors.text }}>
            Players
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {gameState.players?.map((player) => (
              <div
                key={player.username}
                className="p-3 rounded-lg border-2"
                style={{
                  background: player.username === gameState.currentDrawer
                    ? `${colors.secondary}20`
                    : player.hasGuessed
                    ? `${colors.primary}20`
                    : 'rgba(0, 0, 0, 0.3)',
                  borderColor: player.username === gameState.currentDrawer
                    ? colors.secondary
                    : player.hasGuessed
                    ? colors.primary
                    : `${colors.primary}30`
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-raleway font-semibold" style={{ color: colors.text }}>
                    {player.username}
                    {player.username === username && ' (You)'}
                  </span>
                  <span className="text-xl font-bold" style={{ color: colors.secondary }}>
                    {player.score || 0}
                  </span>
                </div>
                {player.username === gameState.currentDrawer && (
                  <p className="text-xs font-poppins mt-1" style={{ color: colors.secondary }}>
                    ✏️ Drawing
                  </p>
                )}
                {player.hasGuessed && player.username !== gameState.currentDrawer && (
                  <p className="text-xs font-poppins mt-1" style={{ color: colors.primary }}>
                    ✅ Guessed!
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Canvas */}
          <div className="lg:col-span-2">
            <div 
              className="rounded-2xl shadow-xl p-4 border"
              style={{
                background: colors.surface,
                borderColor: `${colors.secondary}30`,
                backdropFilter: 'blur(20px)'
              }}
            >
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-xl font-orbitron font-bold" style={{ color: colors.text }}>
                  {isMyTurn() 
                    ? gameState?.drawingStarted 
                      ? '🎨 Draw your word!' 
                      : '📝 Select a word first...'
                    : '👀 Watch and guess!'}
                </h2>
                {isMyTurn() && gameState?.drawingStarted && (
                  <button
                    onClick={handleClearCanvas}
                    className="px-4 py-2 rounded-lg font-raleway font-semibold transition-colors border"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      borderColor: 'rgba(239, 68, 68, 0.5)',
                      color: '#ef4444'
                    }}
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
                className="border-2 rounded-lg w-full bg-white"
                style={{ 
                  maxHeight: '600px',
                  borderColor: `${colors.secondary}40`,
                  cursor: canDraw ? 'crosshair' : 'not-allowed'
                }}
              />
            </div>
          </div>

          {/* Chat & Guess */}
          <div className="lg:col-span-1">
            <div 
              className="rounded-2xl shadow-xl p-4 flex flex-col border"
              style={{ 
                height: '680px',
                background: colors.surface,
                borderColor: `${colors.secondary}30`,
                backdropFilter: 'blur(20px)'
              }}
            >
              <h2 className="text-xl font-orbitron font-bold mb-3" style={{ color: colors.text }}>
                Chat
              </h2>
              
              {/* Scrollable chat messages */}
              <div 
                className="flex-1 overflow-y-auto mb-3 space-y-2 rounded-lg p-3"
                style={{ background: 'rgba(0, 0, 0, 0.3)' }}
              >
                {chatMessages.length === 0 ? (
                  <p className="text-center italic" style={{ color: colors.textSecondary }}>
                    No messages yet...
                  </p>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className="p-2 rounded-lg"
                      style={{
                        background: msg.isCorrect
                          ? 'rgba(34, 197, 94, 0.2)'
                          : msg.isSystem
                          ? 'rgba(234, 179, 8, 0.2)'
                          : 'rgba(255, 255, 255, 0.1)',
                        borderLeft: `3px solid ${msg.isCorrect ? colors.primary : msg.isSystem ? colors.accent : colors.secondary}`
                      }}
                    >
                      <span className="font-raleway font-semibold" style={{ color: colors.text }}>
                        {msg.username}:
                      </span>{' '}
                      <span className="font-poppins" style={{ color: colors.text }}>
                        {msg.message}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Guess Input */}
              {!isMyTurn() && gameState?.drawingStarted && (
                <>
                  {!gameState?.players?.find(p => p.username === username)?.hasGuessed ? (
                    <form onSubmit={handleGuess} className="flex gap-2">
                      <input
                        type="text"
                        value={guess}
                        onChange={(e) => setGuess(e.target.value)}
                        placeholder="Type your guess..."
                        className="flex-1 px-3 py-2 border-2 rounded-lg focus:outline-none font-poppins"
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderColor: `${colors.secondary}40`,
                          color: colors.text
                        }}
                        autoComplete="off"
                      />
                      <button
                        type="submit"
                        disabled={!guess.trim()}
                        className="px-4 py-2 rounded-lg font-raleway font-semibold transition-colors disabled:opacity-50"
                        style={{
                          background: guess.trim() 
                            ? `linear-gradient(135deg, ${colors.secondary}, ${colors.accent})`
                            : 'rgba(128, 128, 128, 0.3)',
                          color: guess.trim() ? '#000' : colors.textSecondary
                        }}
                      >
                        Send
                      </button>
                    </form>
                  ) : (
                    <div 
                      className="p-3 border-2 rounded-lg text-center"
                      style={{
                        background: `${colors.primary}20`,
                        borderColor: colors.primary
                      }}
                    >
                      <p className="font-raleway font-bold text-sm" style={{ color: colors.primary }}>
                        ✅ You guessed correctly! Waiting for others...
                      </p>
                    </div>
                  )}
                </>
              )}

              {isMyTurn() && gameState?.drawingStarted && (
                <div 
                  className="p-3 border-2 rounded-lg text-center"
                  style={{
                    background: `${colors.secondary}20`,
                    borderColor: colors.secondary
                  }}
                >
                  <p className="font-raleway font-bold text-sm" style={{ color: colors.secondary }}>
                    🎨 Your word: <span className="text-lg">{gameState?.currentWord}</span>
                  </p>
                  <p className="text-xs font-poppins mt-1" style={{ color: colors.textSecondary }}>
                    Others are trying to guess!
                  </p>
                </div>
              )}

              {!gameState?.drawingStarted && (
                <div 
                  className="p-3 border-2 rounded-lg text-center"
                  style={{
                    background: 'rgba(128, 128, 128, 0.2)',
                    borderColor: 'rgba(128, 128, 128, 0.3)'
                  }}
                >
                  <p className="font-poppins text-sm" style={{ color: colors.textSecondary }}>
                    ⏳ Waiting for {gameState?.currentDrawer} to choose a word...
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
