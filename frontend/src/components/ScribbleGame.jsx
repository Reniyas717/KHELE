import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';
import Canvas from './Canvas';
import HandDrawing from './HandDrawing';
import PixelSnow from './ui/PixelSnow';
import {
  IoArrowBack,
  IoSunnyOutline,
  IoMoonOutline,
  IoBrushSharp,
  IoPeopleSharp,
  IoTimerOutline,
  IoSendSharp,
  IoCameraOutline,
  IoCheckmarkCircleSharp
} from 'react-icons/io5';
import { MdOutlineMouse } from 'react-icons/md'

export default function ScribbleGame({ roomCode, username, players, initialGameState, onLeaveRoom }) {
  const { colors, theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(initialGameState);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [showWordChoices, setShowWordChoices] = useState(false);
  const [wordChoices, setWordChoices] = useState([]);
  const [roundStarted, setRoundStarted] = useState(false);
  const [useCamera, setUseCamera] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const { sendMessage, on, isConnected } = useWebSocket();
  const listenersSetup = useRef(false);
  const timerInterval = useRef(null);
  const initialSetupDone = useRef(false);

  const isDrawer = gameState?.currentDrawer === username;
  const currentPlayer = gameState?.players?.find(p => p.username === username);
  const hasGuessed = currentPlayer?.hasGuessed || false;
  const currentWord = gameState?.currentWord || '';
  const wordToShow = isDrawer ? currentWord : (currentWord ? currentWord.replace(/./g, '_ ') : '');

  // Theme-based PixelSnow colors
  const snowColor = theme === 'dark' ? '#a855f7' : '#10b981';
  const snowDensity = theme === 'dark' ? 0.1 : 0.08;
  const snowBrightness = theme === 'dark' ? 0.5 : 0.35;

  console.log('🎮 ScribbleGame render:', {
    username,
    isDrawer,
    hasGuessed,
    currentDrawer: gameState?.currentDrawer,
    currentWord,
    roundStarted,
    showWordChoices,
    useCamera,
    wordChoices,
    initialGameState: initialGameState ? 'present' : 'null'
  });

  // Initialize game state from props and show word choices if drawer
  useEffect(() => {
    if (initialGameState && !initialSetupDone.current) {
      console.log('📦 Initializing ScribbleGame with state:', initialGameState);
      setGameState(initialGameState);

      // If current user is the drawer, show word choices
      if (initialGameState.currentDrawer === username && initialGameState.wordOptions?.length > 0) {
        console.log('🎨 User is drawer, showing word choices:', initialGameState.wordOptions);
        setWordChoices(initialGameState.wordOptions);
        setShowWordChoices(true);
      }

      initialSetupDone.current = true;

      setMessages([{
        type: 'system',
        text: `Game started! ${initialGameState.currentDrawer} is choosing a word...`
      }]);
    }
  }, [initialGameState, username]);

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
      console.log('🎮 GAME_STARTED received in ScribbleGame:', data);
      const payload = data.payload || data;
      if (payload.gameState) {
        setGameState(payload.gameState);

        // If current user is the drawer, show word choices
        if (payload.gameState.currentDrawer === username && payload.gameState.wordOptions?.length > 0) {
          console.log('🎨 User is drawer, showing word choices');
          setWordChoices(payload.gameState.wordOptions);
          setShowWordChoices(true);
        }
      }
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

      // Start timer
      const timeLimit = payload.timeLimit || 60;
      setTimeRemaining(timeLimit);

      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }

      timerInterval.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerInterval.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Determine if current user is drawer based on updated state
      const userIsDrawer = payload.gameState.currentDrawer === username;
      const word = userIsDrawer ? payload.gameState.currentWord : payload.gameState.currentWord.replace(/./g, '_ ');
      setMessages(prev => [...prev, {
        type: 'system',
        text: userIsDrawer ? `You are drawing: ${payload.gameState.currentWord}` : `Round started! Guess the word: ${word}`
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

    const unsubTimeUp = on('TIME_UP', (data) => {
      console.log('⏰ TIME_UP received:', data);
      const payload = data.payload || data;
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
      setTimeRemaining(0);
      setMessages(prev => [...prev, {
        type: 'system',
        text: payload.message || `Time's up! The word was: ${payload.word}`
      }]);
    });

    const unsubRoundComplete = on('ROUND_COMPLETE', (data) => {
      console.log('🎊 ROUND_COMPLETE received:', data);
      const payload = data.payload || data;
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
      setTimeRemaining(0);
      setMessages(prev => [...prev, {
        type: 'system',
        text: payload.message || `Round complete! The word was: ${payload.word}`
      }]);
    });

    const unsubRoundEnd = on('ROUND_END', (data) => {
      console.log('🏁 ROUND_END received:', data);
      const payload = data.payload || data;
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
      setMessages(prev => [...prev, {
        type: 'system',
        text: `Round ended! The word was: ${payload.word}`
      }]);
      setGameState(payload.gameState);
      setRoundStarted(false);
      setTimeRemaining(null);
    });

    const unsubNextRound = on('NEXT_ROUND', (data) => {
      console.log('➡️ NEXT_ROUND received:', data);
      const payload = data.payload || data;
      setGameState(payload.gameState);
      setRoundStarted(false);
      setTimeRemaining(null);
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }

      // If current user is the new drawer, show word choices
      if (payload.gameState.currentDrawer === username && payload.gameState.wordOptions?.length > 0) {
        console.log('🎨 User is new drawer, showing word choices');
        setWordChoices(payload.gameState.wordOptions);
        setShowWordChoices(true);
      }

      setMessages([{
        type: 'system',
        text: `Next round! ${payload.gameState.currentDrawer} is now drawing...`
      }]);
    });

    const unsubGameOver = on('GAME_OVER', (data) => {
      console.log('🏆 GAME_OVER received:', data);
      const payload = data.payload || data;

      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }

      let gameOverMessage = '🎉 Game Over!\n\nFinal Scores:\n';
      if (payload.rankings) {
        payload.rankings.forEach((p, i) => {
          gameOverMessage += `${i + 1}. ${p.username}: ${p.score} points\n`;
        });
      } else if (payload.gameState?.players) {
        payload.gameState.players
          .sort((a, b) => b.score - a.score)
          .forEach((p, i) => {
            gameOverMessage += `${i + 1}. ${p.username}: ${p.score} points\n`;
          });
      }

      alert(gameOverMessage);
      setRoundStarted(false);
      setTimeRemaining(null);
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
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
      unsubGameUpdate?.();
      unsubGameStarted?.();
      unsubWordChoices?.();
      unsubRoundStart?.();
      unsubCorrectGuess?.();
      unsubTimeUp?.();
      unsubRoundComplete?.();
      unsubRoundEnd?.();
      unsubNextRound?.();
      unsubGameOver?.();
      unsubChatMessage?.();
      listenersSetup.current = false;
    };
  }, [isConnected, on, username]);

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

    if (isDrawer || hasGuessed) {
      sendMessage('SEND_MESSAGE', {
        roomCode,
        username,
        message
      });
    } else {
      sendMessage('SUBMIT_GUESS', {
        roomCode,
        username,
        guess: message
      });
    }

    setMessage('');
  };

  const toggleDrawingMode = () => {
    setUseCamera(!useCamera);
    console.log('🔄 Switching drawing mode to:', !useCamera ? 'Camera' : 'Mouse');
  };

  return (
    <div className={`min-h-screen p-4 md:p-8 relative ${colors.bg} transition-colors duration-300`}>
      {/* PixelSnow Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <PixelSnow
          color={snowColor}
          flakeSize={0.008}
          minFlakeSize={1.5}
          pixelResolution={180}
          speed={0.7}
          density={snowDensity}
          brightness={snowBrightness}
          direction={135}
          variant="round"
        />
      </div>

      {/* Back Button */}
      <button
        onClick={onLeaveRoom}
        className={`absolute top-4 left-4 p-3 rounded-xl border transition-all hover:scale-110 z-10 backdrop-blur-xl ${colors.surface} ${colors.border}`}
        aria-label="Leave game"
      >
        <IoArrowBack className={`w-5 h-5 ${colors.primary}`} />
      </button>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className={`absolute top-4 right-4 p-3 rounded-xl border transition-all hover:scale-110 z-10 backdrop-blur-xl ${colors.surface} ${colors.border}`}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <IoSunnyOutline className="w-5 h-5" />
        ) : (
          <IoMoonOutline className="w-5 h-5" />
        )}
      </button>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 mt-16 md:mt-0">
          <div className="text-center md:text-left mb-4 md:mb-0">
            <h1 className={`font-display text-4xl md:text-5xl font-black mb-2 flex items-center gap-3 justify-center md:justify-start ${colors.primary}`}>
              <IoBrushSharp className="w-10 h-10 md:w-12 md:h-12" />
              Scribble
            </h1>
          </div>
        </div>

        {/* Round Info with Timer */}
        <div className="mb-6 text-center">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <p className={`text-xl md:text-2xl font-display font-bold ${colors.text}`}>
              Round {gameState?.currentRound || 1} / {(gameState?.maxRounds || 3) * (gameState?.players?.length || players.length)}
            </p>
            {timeRemaining !== null && roundStarted && (
              <div
                className={`px-4 py-2 rounded-lg font-display font-bold text-lg md:text-xl flex items-center gap-2 border-2 backdrop-blur-xl ${timeRemaining <= 10
                  ? 'bg-red-500/20 border-red-500 text-red-500'
                  : `${colors.secondaryBg}/20 ${colors.secondaryBorder} ${colors.secondary}`
                  }`}
              >
                <IoTimerOutline className="w-5 h-5" />
                {timeRemaining}s
              </div>
            )}
          </div>
          {roundStarted ? (
            <div>
              <p className={`text-base md:text-lg font-body mt-2 ${colors.textSecondary}`}>
                {isDrawer ? (
                  <>🎨 You are drawing: <span className={`font-bold text-xl md:text-2xl ${colors.primary}`}>{currentWord}</span></>
                ) : hasGuessed ? (
                  <>✅ You guessed it! The word is: <span className={`font-bold text-xl md:text-2xl ${colors.primary}`}>{currentWord}</span></>
                ) : (
                  <>👀 <span className={colors.primary}>{gameState?.currentDrawer}</span> is drawing: <span className={`font-bold text-lg md:text-xl tracking-wider ${colors.secondary}`}>{wordToShow}</span></>
                )}
              </p>
              {!isDrawer && !hasGuessed && (
                <p className={`text-xs md:text-sm mt-1 ${colors.textSecondary}`}>
                  💡 Type your guess in the chat below
                </p>
              )}
            </div>
          ) : (
            <p className={`text-base md:text-lg font-body mt-2 animate-pulse ${colors.secondary}`}>
              ⏳ Waiting for <span className={colors.primary}>{gameState?.currentDrawer || 'drawer'}</span> to choose a word...
            </p>
          )}
        </div>

        {/* Players */}
        <div className="mb-8">
          <h2 className={`text-lg md:text-xl font-display font-bold mb-4 flex items-center gap-2 ${colors.text}`}>
            <IoPeopleSharp className="w-5 h-5" />
            Players
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {(gameState?.players || players)?.map((player, index) => {
              const playerUsername = player.username;
              const isCurrentDrawer = playerUsername === gameState?.currentDrawer;
              const hasGuessedPlayer = player.hasGuessed;

              return (
                <div
                  key={playerUsername || index}
                  className={`p-3 md:p-4 rounded-lg border-2 transition-all backdrop-blur-xl ${isCurrentDrawer
                    ? `${colors.primaryBg}/20 ${colors.primaryBorder} shadow-lg`
                    : hasGuessedPlayer
                      ? `${colors.secondaryBg}/20 ${colors.secondaryBorder}`
                      : `${colors.surface} ${colors.border}`
                    }`}
                >
                  <p className={`font-accent font-bold text-sm md:text-base ${colors.text}`}>
                    {playerUsername} {playerUsername === username && '(You)'}
                    {isCurrentDrawer && ' 🎨'}
                    {hasGuessedPlayer && !isCurrentDrawer && ' ✅'}
                  </p>
                  <p className={`text-xs md:text-sm ${colors.textSecondary}`}>
                    Score: {player.score || 0}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Canvas Area */}
          <div className="lg:col-span-2 w-full">
            <div
              className={`p-4 md:p-6 rounded-2xl border backdrop-blur-xl ${colors.surface} ${colors.border}`}
            >
              {/* Canvas Header with Mode Toggle */}
              <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-3">
                <h2 className={`text-xl md:text-2xl font-display font-bold ${colors.text}`}>
                  {isDrawer ? '🎨 Draw your word!' : '👀 Watch and guess!'}
                </h2>

                {/* Drawing Mode Toggle - Show for drawer during active round */}
                {isDrawer && roundStarted && (
                  <button
                    onClick={toggleDrawingMode}
                    className={`px-4 py-2 rounded-lg font-accent font-bold transition-all hover:scale-105 border-2 flex items-center gap-2 ${useCamera
                      ? `${colors.primaryBg}/40 ${colors.primaryBorder} ${colors.primary}`
                      : `${colors.surface} ${colors.border} ${colors.text}`
                      }`}
                  >
                    {useCamera ? (
                      <>
                        <IoCameraOutline className="w-5 h-5" />
                        <span className="hidden md:inline">Camera Mode</span>
                      </>
                    ) : (
                      <>
                        <MdOutlineMouse className="w-5 h-5" />
                        <span className="hidden md:inline">Mouse Mode</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Show message if round hasn't started */}
              {!roundStarted ? (
                <div className={`w-full h-[300px] md:h-[400px] lg:h-[500px] flex items-center justify-center rounded-lg border-4 border-dashed ${colors.border}`}>
                  <div className="text-center">
                    <p className="text-5xl md:text-6xl mb-4">⏳</p>
                    <p className={`text-xl md:text-2xl font-display font-bold ${colors.text}`}>
                      Waiting for round to start...
                    </p>
                    <p className={`text-base md:text-lg font-body mt-2 ${colors.textSecondary}`}>
                      {isDrawer ? 'Please choose a word from the options' : `${gameState?.currentDrawer || 'Drawer'} is choosing a word`}
                    </p>
                  </div>
                </div>
              ) : (
                // Show camera or mouse drawing based on mode
                useCamera && isDrawer ? (
                  <HandDrawing
                    roomCode={roomCode}
                    canDraw={isDrawer && roundStarted}
                  />
                ) : (
                  <Canvas
                    roomCode={roomCode}
                    canDraw={isDrawer && roundStarted}
                  />
                )
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-1">
            <div
              className={`p-4 md:p-6 rounded-2xl border h-full flex flex-col backdrop-blur-xl ${colors.surface} ${colors.border}`}
            >
              <h2 className={`text-lg md:text-xl font-display font-bold mb-4 ${colors.text}`}>
                {isDrawer ? 'Chat' : hasGuessed ? 'Chat (You guessed!)' : 'Chat & Guess'}
              </h2>

              {/* Info about chat visibility */}
              {!isDrawer && !hasGuessed && roundStarted && (
                <div
                  className={`mb-3 p-2 rounded text-xs text-center ${colors.secondaryBg}/10 ${colors.secondary}`}
                >
                  💡 Chat is visible only to those who guessed correctly
                </div>
              )}

              {/* Messages */}
              <div
                className={`flex-1 overflow-y-auto mb-4 p-3 md:p-4 rounded-lg ${colors.bgSecondary}`}
                style={{ maxHeight: '300px' }}
              >
                {messages.length === 0 ? (
                  <p className={`text-center text-sm ${colors.textSecondary}`}>
                    No messages yet...
                  </p>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className="mb-2">
                      {msg.type === 'system' ? (
                        <p
                          className={`text-xs md:text-sm font-bold text-center py-2 px-3 rounded ${colors.secondaryBg}/10 ${colors.secondary}`}
                        >
                          {msg.text}
                        </p>
                      ) : (
                        <p className="text-xs md:text-sm">
                          <span
                            className={`font-bold ${msg.isDrawer ? colors.primary : msg.hasGuessed ? colors.secondary : colors.primary
                              }`}
                          >
                            {msg.username}{msg.isDrawer ? ' 🎨' : msg.hasGuessed ? ' ✅' : ''}:
                          </span>{' '}
                          <span className={colors.text}>{msg.text}</span>
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
                  className={`flex-1 px-3 md:px-4 py-2 rounded-lg font-body text-sm md:text-base border ${roundStarted ? `${colors.bgSecondary} ${colors.text} ${colors.border}` : `${colors.bgSecondary} ${colors.textSecondary} ${colors.border} cursor-not-allowed`
                    }`}
                />
                <button
                  type="submit"
                  disabled={!roundStarted}
                  className={`px-4 md:px-6 py-2 rounded-lg font-accent font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${roundStarted
                    ? `${colors.primaryBg} ${colors.primaryHover} text-white`
                    : 'bg-gray-500/50 text-gray-300'
                    }`}
                >
                  <IoSendSharp className="w-4 h-4" />
                  <span className="hidden md:inline">{isDrawer || hasGuessed ? 'Send' : 'Guess'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Word Choice Modal */}
        {showWordChoices && wordChoices.length > 0 && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
              className={`p-6 md:p-8 rounded-2xl border max-w-md w-full backdrop-blur-xl ${colors.surface} ${colors.primaryBorder} shadow-2xl`}
            >
              <h3 className={`text-2xl md:text-3xl font-display font-bold mb-2 text-center ${colors.text}`}>
                ✏️ Choose a word to draw
              </h3>
              <p className={`text-center mb-6 font-body ${colors.textSecondary}`}>
                Other players are waiting for you...
              </p>
              <div className="space-y-3">
                {wordChoices.map((word, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleWordSelect(word)}
                    className={`w-full px-6 py-4 rounded-lg font-accent font-bold text-lg md:text-xl transition-all hover:scale-105 hover:shadow-xl border-2 ${colors.primaryBg}/40 ${colors.primaryBorder} ${colors.text}`}
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
