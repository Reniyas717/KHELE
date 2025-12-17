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
  const [wordChoices, setWordChoices] = useState([]);
  const [roundStarted, setRoundStarted] = useState(false);
  const { sendMessage, on, isConnected } = useWebSocket();
  const listenersSetup = useRef(false);

  const isDrawer = gameState?.currentDrawer === username;
  const currentPlayer = gameState?.players?.find(p => p.username === username);
  const hasGuessed = currentPlayer?.hasGuessed || false;
  const currentWord = gameState?.currentWord || '';
  const wordToShow = isDrawer ? currentWord : (currentWord ? currentWord.replace(/./g, '_ ') : '');

  console.log('🎮 ScribbleGame render:', {
    username,
    isDrawer,
    hasGuessed,
    currentDrawer: gameState?.currentDrawer,
    currentWord,
    roundStarted,
    showWordChoices
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

    const unsubGameStarted = on('GAME_STARTED', (data) => {
      console.log('🎮 GAME_STARTED received:', data);
      const payload = data.payload || data;
      setGameState(payload.gameState);
      setRoundStarted(false);
      setMessages([{ type: 'system', text: 'Game started! Waiting for drawer to choose a word...' }]);
    });

    const unsubWordChoices = on('WORD_CHOICES', (data) => {
      console.log('📝 WORD_CHOICES received:', data);
      const payload = data.payload || data;
      setWordChoices(payload.wordChoices || []);
      setShowWordChoices(true);
      setRoundStarted(false);
    });

    const unsubRoundStart = on('ROUND_START', (data) => {
      console.log('🎯 ROUND_START received:', data);
      const payload = data.payload || data;
      setGameState(payload.gameState);
      setShowWordChoices(false);
      setRoundStarted(true);
      
      const word = isDrawer ? payload.gameState.currentWord : payload.gameState.currentWord.replace(/./g, '_ ');
      setMessages(prev => [...prev, {
        type: 'system',
        text: isDrawer ? `You are drawing: ${payload.gameState.currentWord}` : `Round started! Guess the word: ${word}`
      }]);
    });

    const unsubCorrectGuess = on('CORRECT_GUESS', (data) => {
      console.log('✅ CORRECT_GUESS received:', data);
      const payload = data.payload || data;
      setMessages(prev => [...prev, {
        type: 'system',
        text: `🎉 ${payload.player} guessed correctly! +${payload.points} points`
      }]);
      
      if (payload.gameState) {
        setGameState(payload.gameState);
      }
    });

    const unsubRoundEnd = on('ROUND_END', (data) => {
      console.log('🏁 ROUND_END received:', data);
      const payload = data.payload || data;
      setMessages(prev => [...prev, {
        type: 'system',
        text: `Round ended! The word was: ${payload.word}`
      }]);
      setGameState(payload.gameState);
      setRoundStarted(false);
    });

    const unsubNextRound = on('NEXT_ROUND', (data) => {
      console.log('➡️ NEXT_ROUND received:', data);
      const payload = data.payload || data;
      setGameState(payload.gameState);
      setRoundStarted(false);
      setMessages(prev => [...prev, {
        type: 'system',
        text: `Next round! ${payload.gameState.currentDrawer} is now drawing...`
      }]);
      // Clear messages for new round
      setMessages([{
        type: 'system',
        text: `Next round! ${payload.gameState.currentDrawer} is now drawing...`
      }]);
    });

    const unsubGameOver = on('GAME_OVER', (data) => {
      console.log('🏆 GAME_OVER received:', data);
      const payload = data.payload || data;
      
      let gameOverMessage = '🎉 Game Over!\n\nFinal Scores:\n';
      if (payload.gameState?.players) {
        payload.gameState.players
          .sort((a, b) => b.score - a.score)
          .forEach((p, i) => {
            gameOverMessage += `${i + 1}. ${p.username}: ${p.score} points\n`;
          });
      }
      
      alert(gameOverMessage);
      setRoundStarted(false);
    });

    const unsubChatMessage = on('CHAT_MESSAGE', (data) => {
      console.log('💬 CHAT_MESSAGE received:', data);
      const payload = data.payload || data;
      setMessages(prev => [...prev, {
        type: 'chat',
        username: payload.username,
        text: payload.message,
        isDrawer: payload.isDrawer,
        hasGuessed: payload.hasGuessed
      }]);
    });

    return () => {
      console.log('🧹 Cleaning up Scribble listeners');
      unsubGameUpdate?.();
      unsubGameStarted?.();
      unsubWordChoices?.();
      unsubRoundStart?.();
      unsubCorrectGuess?.();
      unsubRoundEnd?.();
      unsubNextRound?.();
      unsubGameOver?.();
      unsubChatMessage?.();
      listenersSetup.current = false;
    };
  }, [isConnected, on, isDrawer]);

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

    if (!roundStarted) {
      alert('⏳ Please wait for the round to start!');
      return;
    }

    console.log('💬 Sending message/guess:', message);
    
    // If drawer or already guessed, send as chat message
    if (isDrawer || hasGuessed) {
      sendMessage('SEND_MESSAGE', {
        roomCode,
        username,
        message
      });
    } else {
      // Otherwise, it's a guess
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
          {roundStarted ? (
            <div>
              <p className="text-lg font-raleway mt-2" style={{ color: colors.textSecondary }}>
                {isDrawer ? (
                  <>🎨 You are drawing: <span className="font-bold text-2xl" style={{ color: colors.primary }}>{currentWord}</span></>
                ) : hasGuessed ? (
                  <>✅ You guessed it! The word is: <span className="font-bold text-2xl" style={{ color: colors.primary }}>{currentWord}</span></>
                ) : (
                  <>👀 <span style={{ color: colors.primary }}>{gameState?.currentDrawer}</span> is drawing: <span className="font-bold text-xl tracking-wider" style={{ color: colors.secondary }}>{wordToShow}</span></>
                )}
              </p>
              {!isDrawer && !hasGuessed && (
                <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                  💡 Type your guess in the chat below
                </p>
              )}
            </div>
          ) : (
            <p className="text-lg font-raleway mt-2 animate-pulse" style={{ color: colors.secondary }}>
              ⏳ Waiting for {gameState?.currentDrawer} to choose a word...
            </p>
          )}
        </div>

        {/* Players */}
        <div className="mb-8">
          <h2 className="text-xl font-orbitron font-bold mb-4" style={{ color: colors.text }}>
            Players
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {gameState?.players?.map((player, index) => {
              const isCurrentDrawer = player.username === gameState.currentDrawer;
              const hasGuessedPlayer = player.hasGuessed;
              
              return (
                <div
                  key={player.username || index}
                  className="p-4 rounded-lg border-2 transition-all"
                  style={{
                    background: isCurrentDrawer
                      ? `${colors.primary}20`
                      : hasGuessedPlayer
                      ? `${colors.secondary}20`
                      : 'rgba(0, 0, 0, 0.3)',
                    borderColor: isCurrentDrawer
                      ? colors.primary
                      : hasGuessedPlayer
                      ? colors.secondary
                      : `${colors.primary}30`,
                    boxShadow: isCurrentDrawer ? `0 0 20px ${colors.primary}40` : 'none'
                  }}
                >
                  <p className="font-raleway font-bold" style={{ color: colors.text }}>
                    {player.username} {player.username === username && '(You)'}
                    {isCurrentDrawer && ' 🎨'}
                    {hasGuessedPlayer && !isCurrentDrawer && ' ✅'}
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
              
              {/* Show message if round hasn't started */}
              {!roundStarted ? (
                <div className="w-full h-[600px] flex items-center justify-center bg-gray-800 rounded-lg border-4 border-dashed border-gray-600">
                  <div className="text-center">
                    <p className="text-6xl mb-4">⏳</p>
                    <p className="text-2xl font-orbitron font-bold" style={{ color: colors.text }}>
                      Waiting for round to start...
                    </p>
                    <p className="text-lg font-poppins mt-2" style={{ color: colors.textSecondary }}>
                      {isDrawer ? 'Please choose a word from the options' : `${gameState?.currentDrawer} is choosing a word`}
                    </p>
                  </div>
                </div>
              ) : (
                <Canvas 
                  roomCode={roomCode} 
                  canDraw={isDrawer && roundStarted}
                />
              )}
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
                {isDrawer ? 'Chat' : hasGuessed ? 'Chat (You guessed!)' : 'Chat & Guess'}
              </h2>

              {/* Info about chat visibility */}
              {!isDrawer && !hasGuessed && roundStarted && (
                <div 
                  className="mb-3 p-2 rounded text-xs text-center"
                  style={{ 
                    background: 'rgba(139, 92, 246, 0.1)',
                    color: colors.secondary
                  }}
                >
                  💡 Chat is visible only to those who guessed correctly
                </div>
              )}

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
                          className="text-sm font-bold text-center py-2 px-3 rounded"
                          style={{ 
                            color: colors.secondary,
                            background: 'rgba(139, 92, 246, 0.1)'
                          }}
                        >
                          {msg.text}
                        </p>
                      ) : (
                        <p className="text-sm">
                          <span 
                            className="font-bold" 
                            style={{ 
                              color: msg.isDrawer ? colors.primary : msg.hasGuessed ? colors.secondary : colors.primary 
                            }}
                          >
                            {msg.username}{msg.isDrawer ? ' 🎨' : msg.hasGuessed ? ' ✅' : ''}:
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
                  placeholder={
                    !roundStarted 
                      ? "Wait for round to start..." 
                      : isDrawer 
                      ? "Type a message..." 
                      : hasGuessed
                      ? "Type a message..."
                      : "Type your guess..."
                  }
                  disabled={!roundStarted}
                  className="flex-1 px-4 py-2 rounded-lg font-poppins"
                  style={{
                    background: roundStarted ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.3)',
                    color: colors.text,
                    border: `1px solid ${colors.primary}30`,
                    cursor: !roundStarted ? 'not-allowed' : 'text'
                  }}
                />
                <button
                  type="submit"
                  disabled={!roundStarted}
                  className="px-6 py-2 rounded-lg font-raleway font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: roundStarted 
                      ? `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`
                      : 'rgba(100, 100, 100, 0.5)',
                    color: '#fff'
                  }}
                >
                  {isDrawer || hasGuessed ? 'Send' : 'Guess'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Word Choice Modal */}
        {showWordChoices && wordChoices.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
            <div 
              className="p-8 rounded-2xl border max-w-md w-full mx-4"
              style={{
                background: colors.surface,
                borderColor: colors.primary,
                boxShadow: `0 0 60px ${colors.primary}60`
              }}
            >
              <h3 className="text-3xl font-orbitron font-bold mb-2 text-center" style={{ color: colors.text }}>
                ✏️ Choose a word to draw
              </h3>
              <p className="text-center mb-6 font-poppins" style={{ color: colors.textSecondary }}>
                Other players are waiting for you...
              </p>
              <div className="space-y-3">
                {wordChoices.map((word, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleWordSelect(word)}
                    className="w-full px-6 py-4 rounded-lg font-raleway font-bold text-xl transition-all hover:scale-105 hover:shadow-xl"
                    style={{
                      background: `linear-gradient(135deg, ${colors.primary}40, ${colors.secondary}20)`,
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
