import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';
import Canvas from './Canvas';

export default function ScribbleGame({ roomCode, username, players, initialGameState, onLeaveRoom }) {
  const { colors } = useTheme();
  const [gameState, setGameState] = useState(initialGameState);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [showWordChoices, setShowWordChoices] = useState(false);
  const { sendMessage, on, isConnected } = useWebSocket();
  const listenersSetup = useRef(false);

  const isDrawer = gameState?.currentDrawer === username;
  const currentWord = gameState?.currentWord || '';

  console.log('🎮 ScribbleGame render:', {
    username,
    isDrawer,
    currentDrawer: gameState?.currentDrawer,
    currentWord,
    gameStateTimestamp: Date.now()
  });

  // Setup WebSocket listeners
  useEffect(() => {
    if (!isConnected || listenersSetup.current) return;

    console.log('🎧 Setting up Scribble WebSocket listeners');
    listenersSetup.current = true;

    const unsubGameUpdate = on('GAME_UPDATE', (data) => {
      console.log('🎮 GAME_UPDATE received:', data);
      setGameState(data.payload || data);
    });

    const unsubWordChoices = on('WORD_CHOICES', (data) => {
      console.log('📝 WORD_CHOICES received:', data);
      setShowWordChoices(true);
    });

    const unsubRoundStart = on('ROUND_START', (data) => {
      console.log('🎯 ROUND_START received:', data);
      setGameState(data.payload || data);
      setShowWordChoices(false);
    });

    const unsubCorrectGuess = on('CORRECT_GUESS', (data) => {
      console.log('✅ CORRECT_GUESS received:', data);
      const msg = data.payload || data;
      setMessages(prev => [...prev, {
        type: 'system',
        text: `${msg.player} guessed correctly! +${msg.points} points`
      }]);
    });

    const unsubRoundEnd = on('ROUND_END', (data) => {
      console.log('🏁 ROUND_END received:', data);
      const payload = data.payload || data;
      setMessages(prev => [...prev, {
        type: 'system',
        text: `Round ended! The word was: ${payload.word}`
      }]);
      setGameState(payload.gameState);
    });

    const unsubGameOver = on('GAME_OVER', (data) => {
      console.log('🏆 GAME_OVER received:', data);
      // Handle game over
    });

    const unsubChatMessage = on('CHAT_MESSAGE', (data) => {
      console.log('💬 CHAT_MESSAGE received:', data);
      const msg = data.payload || data;
      setMessages(prev => [...prev, {
        type: 'chat',
        username: msg.username,
        text: msg.message
      }]);
    });

    return () => {
      console.log('🧹 Cleaning up Scribble listeners');
      unsubGameUpdate?.();
      unsubWordChoices?.();
      unsubRoundStart?.();
      unsubCorrectGuess?.();
      unsubRoundEnd?.();
      unsubGameOver?.();
      unsubChatMessage?.();
      listenersSetup.current = false;
    };
  }, [isConnected, on]);

  const handleWordSelect = (word) => {
    console.log('📝 Selecting word:', word);
    sendMessage('SELECT_WORD', {
      roomCode,
      username,
      word
    });
    setShowWordChoices(false);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    console.log('💬 Sending message/guess:', message);
    
    if (isDrawer) {
      // Drawer can only chat
      sendMessage('SEND_MESSAGE', {
        roomCode,
        username,
        message
      });
    } else {
      // Guesser submits guess
      sendMessage('SUBMIT_GUESS', {
        roomCode,
        username,
        guess: message
      });
    }

    setMessage('');
  };

  return (
    <div 
      className="min-h-screen p-8"
      style={{ backgroundColor: colors.background }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 
            className="text-4xl font-orbitron font-black"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            ✏️ Scribble
          </h1>
          <button
            onClick={onLeaveRoom}
            className="px-6 py-3 rounded-lg font-raleway font-bold transition-all hover:scale-105 border"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'rgba(239, 68, 68, 0.5)',
              color: '#ef4444'
            }}
          >
            Leave Game
          </button>
        </div>

        {/* Round Info */}
        <div className="mb-6 text-center">
          <p className="text-2xl font-orbitron font-bold" style={{ color: colors.text }}>
            Round {gameState?.round || 1} / {gameState?.maxRounds || 3}
          </p>
          <p className="text-lg font-raleway mt-2" style={{ color: colors.textSecondary }}>
            {isDrawer ? (
              <>🎨 You are drawing: <span className="font-bold" style={{ color: colors.primary }}>{currentWord}</span></>
            ) : (
              <>👀 <span style={{ color: colors.primary }}>{gameState?.currentDrawer}</span> is drawing...</>
            )}
          </p>
        </div>

        {/* Players */}
        <div className="mb-8">
          <h2 className="text-xl font-orbitron font-bold mb-4" style={{ color: colors.text }}>
            Players
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {gameState?.players?.map((player, index) => {
              const isCurrentDrawer = player.name === gameState.currentDrawer;
              
              return (
                <div
                  key={player.name || index}
                  className="p-4 rounded-lg border-2 transition-all"
                  style={{
                    background: isCurrentDrawer
                      ? `${colors.primary}20`
                      : 'rgba(0, 0, 0, 0.3)',
                    borderColor: isCurrentDrawer
                      ? colors.primary
                      : `${colors.primary}30`,
                    boxShadow: isCurrentDrawer ? `0 0 20px ${colors.primary}40` : 'none'
                  }}
                >
                  <p className="font-raleway font-bold" style={{ color: colors.text }}>
                    {player.name} {player.name === username && '(You)'}
                    {isCurrentDrawer && ' 🎨'}
                  </p>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    Score: {player.score || 0}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Canvas Area */}
          <div className="lg:col-span-2">
            <div 
              className="p-6 rounded-2xl border"
              style={{
                background: colors.surface,
                borderColor: `${colors.primary}30`
              }}
            >
              <h2 className="text-2xl font-orbitron font-bold mb-4" style={{ color: colors.text }}>
                {isDrawer ? '🎨 Draw your word!' : '👀 Watch and guess!'}
              </h2>
              
              {/* Show Canvas for EVERYONE - just control canDraw prop */}
              <Canvas 
                roomCode={roomCode} 
                canDraw={isDrawer}
              />
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-1">
            <div 
              className="p-6 rounded-2xl border h-full flex flex-col"
              style={{
                background: colors.surface,
                borderColor: `${colors.primary}30`
              }}
            >
              <h2 className="text-xl font-orbitron font-bold mb-4" style={{ color: colors.text }}>
                Chat
              </h2>

              {/* Messages */}
              <div 
                className="flex-1 overflow-y-auto mb-4 p-4 rounded-lg"
                style={{ 
                  background: 'rgba(0, 0, 0, 0.3)',
                  maxHeight: '400px'
                }}
              >
                {messages.length === 0 ? (
                  <p className="text-center" style={{ color: colors.textSecondary }}>
                    No messages yet...
                  </p>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className="mb-2">
                      {msg.type === 'system' ? (
                        <p 
                          className="text-sm font-bold text-center py-2"
                          style={{ color: colors.secondary }}
                        >
                          {msg.text}
                        </p>
                      ) : (
                        <p className="text-sm">
                          <span className="font-bold" style={{ color: colors.primary }}>
                            {msg.username}:
                          </span>{' '}
                          <span style={{ color: colors.text }}>{msg.text}</span>
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={isDrawer ? "Type a message..." : "Type your guess..."}
                  className="flex-1 px-4 py-2 rounded-lg font-poppins"
                  style={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    color: colors.text,
                    border: `1px solid ${colors.primary}30`
                  }}
                />
                <button
                  type="submit"
                  className="px-6 py-2 rounded-lg font-raleway font-bold transition-all hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                    color: '#fff'
                  }}
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Word Choice Modal */}
        {showWordChoices && gameState?.wordChoices && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div 
              className="p-8 rounded-2xl border max-w-md w-full mx-4"
              style={{
                background: colors.surface,
                borderColor: colors.primary
              }}
            >
              <h3 className="text-2xl font-orbitron font-bold mb-6 text-center" style={{ color: colors.text }}>
                Choose a word to draw
              </h3>
              <div className="space-y-3">
                {gameState.wordChoices.map((word, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleWordSelect(word)}
                    className="w-full px-6 py-4 rounded-lg font-raleway font-bold text-xl transition-all hover:scale-105"
                    style={{
                      background: `${colors.primary}20`,
                      border: `2px solid ${colors.primary}`,
                      color: colors.text
                    }}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
