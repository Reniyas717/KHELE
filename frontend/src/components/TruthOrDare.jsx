import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';
import PixelSnow from './ui/PixelSnow';
import {
  IoArrowBack,
  IoSunnyOutline,
  IoMoonOutline,
  IoSparklesSharp,
  IoPeopleSharp,
  IoTrophySharp
} from 'react-icons/io5';
import { MdTheaterComedy } from 'react-icons/md';

export default function TruthOrDare({ roomCode, username, players, onLeaveGame }) {
  const { colors, theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { sendMessage, on } = useWebSocket();

  // Game states
  const [gameState, setGameState] = useState('lobby');
  const [settings, setSettings] = useState({
    rating: 'PG',
    rounds: 5
  });
  const [currentRound, setCurrentRound] = useState(1);
  const [currentSpinner, setCurrentSpinner] = useState(0); // Track whose turn to spin
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [cards, setCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [flippedCard, setFlippedCard] = useState(null);
  const [ratings, setRatings] = useState({});
  const [scores, setScores] = useState({});
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);

  // API data - Only fetch after game starts
  const [truthQuestions, setTruthQuestions] = useState([]);
  const [dareQuestions, setDareQuestions] = useState([]);
  const [isLoadingAPI, setIsLoadingAPI] = useState(false);
  const [questionsLoaded, setQuestionsLoaded] = useState(false);

  const wheelRef = useRef(null);
  const isHost = players[0]?.username === username;
  const isMyTurnToSpin = players[currentSpinner]?.username === username;

  // Wheel colors for segments
  const wheelColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DFE6E9', '#FF85A2', '#A29BFE',
    '#74B9FF', '#00B894', '#FDCB6E', '#E17055'
  ];

  // Theme-based PixelSnow colors
  const snowColor = theme === 'dark' ? '#ec4899' : '#f97316';
  const snowDensity = theme === 'dark' ? 0.1 : 0.08;
  const snowBrightness = theme === 'dark' ? 0.5 : 0.35;

  // Fetch Truth or Dare questions ONLY when game starts
  const fetchQuestions = useCallback(async () => {
    if (questionsLoaded) return; // Don't fetch if already loaded

    setIsLoadingAPI(true);
    console.log('🔍 Fetching questions for rating:', settings.rating);

    try {
      const fetchBatch = async (type, count) => {
        const questions = [];
        for (let i = 0; i < count; i++) {
          try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/rooms/truthordare/${type}?rating=${settings.rating}`);
            if (res.ok) {
              const data = await res.json();
              if (data.question) questions.push(data.question);
            }
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (err) {
            console.error(`Error fetching ${type}:`, err);
          }
        }
        return questions;
      };

      const [truths, dares] = await Promise.all([
        fetchBatch('truth', 30),
        fetchBatch('dare', 30)
      ]);

      console.log('✅ Fetched questions:', { truths: truths.length, dares: dares.length });

      if (truths.length > 0 && dares.length > 0) {
        setTruthQuestions(truths);
        setDareQuestions(dares);
        setQuestionsLoaded(true);
      } else {
        throw new Error('No questions fetched');
      }
    } catch (error) {
      console.error('❌ Using fallback questions');
      setTruthQuestions([
        "What's the most embarrassing thing you've ever done?",
        "What's your biggest secret?",
        "Who do you have a crush on?",
        "What's the worst lie you've ever told?",
        "What's your most embarrassing moment?",
        "Have you ever cheated on a test?",
        "What's the meanest thing you've said about someone?",
        "What's your biggest fear?",
        "Have you ever blamed something on someone else?",
        "What's the most childish thing you still do?"
      ]);
      setDareQuestions([
        "Do 20 pushups right now",
        "Sing your favorite song loudly",
        "Dance for 30 seconds without music",
        "Do your best celebrity impression",
        "Speak in an accent for the next 3 rounds",
        "Let someone post anything on your social media",
        "Do 10 jumping jacks",
        "Talk in a funny voice for 2 minutes",
        "Do your best animal impression",
        "Strike 5 different poses like a model"
      ]);
      setQuestionsLoaded(true);
    } finally {
      setIsLoadingAPI(false);
    }
  }, [settings.rating, questionsLoaded]);

  // Initialize scores
  useEffect(() => {
    const initialScores = {};
    players.forEach(player => {
      initialScores[player.username] = 0;
    });
    setScores(initialScores);
  }, [players]);

  // WebSocket handlers
  useEffect(() => {
    console.log('🎧 Setting up Truth or Dare listeners');

    const unsubSettings = on('TOD_SETTINGS_UPDATE', (data) => {
      console.log('⚙️ Settings updated:', data.payload.settings);
      setSettings(data.payload.settings);
    });

    const unsubGameStart = on('TOD_GAME_START', (data) => {
      console.log('🎭 Game starting:', data.payload.settings);
      setGameState('spinning');
      setSettings(data.payload.settings);
      setCurrentRound(1);
      setCurrentSpinner(0);
      // Fetch questions when game starts
      fetchQuestions();
    });

    const unsubSpin = on('TOD_SPIN_WHEEL', (data) => {
      console.log('🎡 Wheel spinning - FULL PAYLOAD:', data.payload);
      const { selectedPlayer, cards } = data.payload;

      if (!cards || !Array.isArray(cards) || cards.length === 0) {
        console.error('❌ No cards received in payload!');
        return;
      }

      console.log('✅ Cards received:', cards);

      // Set spinning state
      setIsSpinning(true);
      setCards(cards);

      // Calculate rotation to land on selected player
      const playerIndex = players.findIndex(p => p.username === selectedPlayer);
      const segmentAngle = 360 / players.length;
      const baseRotation = 360 * 8; // 8 full spins
      const playerOffset = (playerIndex * segmentAngle) + (segmentAngle / 2);
      const finalRotation = baseRotation + (360 - playerOffset) + Math.random() * 20 - 10;

      setWheelRotation(prev => prev + finalRotation);

      // After spin animation completes
      setTimeout(() => {
        setIsSpinning(false);
        setSelectedPlayer(selectedPlayer);
        setGameState('selecting');
      }, 5000);
    });

    const unsubCardSelect = on('TOD_CARD_SELECTED', (data) => {
      console.log('🎴 Card selected:', data.payload.card);
      setSelectedCard(data.payload.card);
      setFlippedCard(data.payload.card.id);
      setShowCardModal(true);

      setTimeout(() => {
        setShowCardModal(false);
        setTimeout(() => {
          setGameState('rating');
        }, 500);
      }, 1500);
    });

    const unsubRating = on('TOD_RATING_SUBMITTED', (data) => {
      console.log('⭐ Rating submitted:', data.payload);
      setRatings(prev => ({
        ...prev,
        [data.payload.rater]: data.payload.rating
      }));
    });

    const unsubNextRound = on('TOD_NEXT_ROUND', (data) => {
      console.log('➡️ Next round:', data.payload);
      const { scores: newScores, round } = data.payload;
      setScores(newScores);
      setCurrentRound(round);
      setRatings({});
      setSelectedCard(null);
      setFlippedCard(null);
      setSelectedPlayer(null);
      setCards([]);
      setShowCardModal(false);

      // Move to next spinner (rotate through all players)
      setCurrentSpinner(prev => (prev + 1) % players.length);

      if (round > settings.rounds) {
        setGameState('gameOver');
      } else {
        setGameState('spinning');
      }
    });

    return () => {
      console.log('🧹 Cleaning up Truth or Dare listeners');
      unsubSettings?.();
      unsubGameStart?.();
      unsubSpin?.();
      unsubCardSelect?.();
      unsubRating?.();
      unsubNextRound?.();
    };
  }, [on, settings.rounds, players, fetchQuestions]);

  const updateSettings = useCallback((newSettings) => {
    if (!isHost) return;
    console.log('⚙️ Updating settings:', newSettings);
    setSettings(newSettings);
    sendMessage('TOD_SETTINGS_UPDATE', {
      roomCode,
      settings: newSettings
    });
  }, [isHost, roomCode, sendMessage]);

  const startGame = useCallback(() => {
    if (!isHost || players.length < 2) return;
    console.log('🎮 Starting game');
    sendMessage('TOD_GAME_START', {
      roomCode,
      settings
    });
  }, [isHost, players.length, roomCode, sendMessage, settings]);

  const generateCards = useCallback(() => {
    const newCards = [];
    for (let i = 0; i < 5; i++) {
      const isTruth = Math.random() > 0.5;
      const questions = isTruth ? truthQuestions : dareQuestions;
      if (questions.length > 0) {
        newCards.push({
          id: i,
          type: isTruth ? 'truth' : 'dare',
          question: questions[Math.floor(Math.random() * questions.length)]
        });
      }
    }
    return newCards;
  }, [truthQuestions, dareQuestions]);

  const spinWheel = useCallback(() => {
    if (!isMyTurnToSpin || isSpinning || !questionsLoaded) return;

    const randomPlayer = players[Math.floor(Math.random() * players.length)].username;
    const newCards = generateCards();

    console.log('🎰 Spinning wheel:', { randomPlayer, cards: newCards, spinner: username });

    sendMessage('TOD_SPIN_WHEEL', {
      roomCode,
      selectedPlayer: randomPlayer,
      cards: newCards
    });
  }, [isMyTurnToSpin, isSpinning, questionsLoaded, players, roomCode, sendMessage, generateCards, username]);

  const selectCard = useCallback((card) => {
    if (selectedPlayer !== username || flippedCard !== null) return;
    console.log('🎴 Selecting card:', card);
    sendMessage('TOD_CARD_SELECTED', {
      roomCode,
      card
    });
  }, [selectedPlayer, username, roomCode, sendMessage, flippedCard]);

  const submitRating = useCallback((rating) => {
    if (ratings[username] !== undefined) return;
    console.log('⭐ Submitting rating:', rating);
    sendMessage('TOD_RATING_SUBMITTED', {
      roomCode,
      rater: username,
      rating
    });
    setRatings(prev => ({
      ...prev,
      [username]: rating
    }));
  }, [ratings, username, roomCode, sendMessage]);

  const nextRound = useCallback(() => {
    if (!isHost) return;
    const ratingValues = Object.values(ratings);
    const averageRating = ratingValues.length > 0
      ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
      : 0;

    const newScores = { ...scores };
    newScores[selectedPlayer] = (newScores[selectedPlayer] || 0) + Math.round(averageRating);
    const nextRoundNum = currentRound + 1;

    sendMessage('TOD_NEXT_ROUND', {
      roomCode,
      scores: newScores,
      round: nextRoundNum
    });
  }, [isHost, ratings, scores, selectedPlayer, currentRound, roomCode, sendMessage]);

  if (isLoadingAPI) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${colors.bg} transition-colors duration-300 p-4`}>
        <div className="text-center max-w-md w-full">
          {/* Animated Icon */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-32 h-32 rounded-full animate-ping ${colors.primaryBg} opacity-20`} />
            </div>
            <div className="relative flex items-center justify-center">
              <MdTheaterComedy className={`w-24 h-24 animate-bounce ${colors.primary}`} />
            </div>
          </div>

          {/* Title */}
          <h2 className={`text-2xl md:text-3xl font-display font-bold mb-4 ${colors.text}`}>
            Loading Truth or Dare...
          </h2>

          {/* Status Message */}
          <p className={`font-body text-base md:text-lg mb-6 ${colors.textSecondary}`}>
            Fetching spicy questions from the server...
          </p>

          {/* Progress Dots */}
          <div className="flex justify-center gap-2 mb-6">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full animate-bounce ${colors.primaryBg}`}
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>

          {/* Loading Bar */}
          <div className={`w-full h-2 rounded-full overflow-hidden ${colors.bgSecondary}`}>
            <div
              className={`h-full ${colors.primaryBg} animate-pulse`}
              style={{
                width: '70%',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}
            />
          </div>

          {/* Tip */}
          <p className={`text-xs md:text-sm mt-6 italic ${colors.textSecondary}`}>
            💡 Tip: The more honest you are, the more fun the game!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-4 md:p-8 relative ${colors.bg} transition-colors duration-300`}>
      {/* PixelSnow Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <PixelSnow
          color={snowColor}
          flakeSize={0.008}
          minFlakeSize={1.5}
          pixelResolution={180}
          speed={0.6}
          density={snowDensity}
          brightness={snowBrightness}
          direction={135}
          variant="round"
        />
      </div>

      {/* Back Button */}
      <button
        onClick={onLeaveGame}
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
              <MdTheaterComedy className="w-10 h-10 md:w-12 md:h-12" />
              Truth or Dare
            </h1>
            <p className={`font-body text-sm md:text-base ${colors.textSecondary}`}>
              Room: {roomCode} | Round: {currentRound}/{settings.rounds} | Rating: {settings.rating}
            </p>
          </div>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {players.map(player => (
            <div
              key={player.username}
              className={`p-3 md:p-4 rounded-xl transition-all duration-300 backdrop-blur-xl border ${player.username === selectedPlayer
                ? `${colors.primaryBg} ${colors.primaryBorder} scale-105`
                : `${colors.surface} ${colors.border}`
                }`}
            >
              <div className={`font-accent font-bold text-base md:text-lg truncate ${colors.text}`}>
                {player.username}
              </div>
              <div className={`text-2xl md:text-3xl font-black ${colors.primary}`}>
                {scores[player.username] || 0} pts
              </div>
              {player.username === players[0]?.username && (
                <div className={`text-xs mt-1 flex items-center gap-1 ${colors.secondary}`}>
                  <IoTrophySharp className="w-3 h-3" /> Host
                </div>
              )}
              {players[currentSpinner]?.username === player.username && gameState === 'spinning' && (
                <div className={`text-xs mt-1 flex items-center gap-1 ${colors.accent}`}>
                  <IoSparklesSharp className="w-3 h-3" /> Spinner
                </div>
              )}
            </div>
          ))}
        </div>

        {/* LOBBY */}
        {gameState === 'lobby' && (
          <div className={`rounded-2xl p-6 md:p-8 backdrop-blur-xl border ${colors.surface} ${colors.border}`}>
            <h2 className={`text-2xl md:text-3xl font-display font-bold mb-6 flex items-center gap-2 ${colors.text}`}>
              <IoSparklesSharp className="w-6 h-6" />
              Game Settings
            </h2>

            {isHost ? (
              <div className="space-y-6">
                <div>
                  <label className={`block font-accent font-bold mb-3 text-lg md:text-xl ${colors.text}`}>Content Rating</label>
                  <div className="flex flex-wrap gap-3">
                    {['PG', 'PG13', 'R'].map(rating => (
                      <button
                        key={rating}
                        onClick={() => updateSettings({ ...settings, rating })}
                        className={`px-6 py-3 md:px-8 md:py-4 rounded-xl font-accent font-bold text-base md:text-lg transition-all hover:scale-105 ${settings.rating === rating
                          ? `${colors.primaryBg} ${colors.primaryHover} text-white shadow-xl`
                          : `${colors.surface} ${colors.text} ${colors.border} border`
                          }`}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                  <p className={`font-body text-sm mt-3 ${colors.textSecondary}`}>
                    {settings.rating === 'PG' && '✅ Family-friendly fun for everyone'}
                    {settings.rating === 'PG13' && '⚠️ Teen-appropriate with mild content'}
                    {settings.rating === 'R' && '🔞 Adults only - spicy content ahead!'}
                  </p>
                </div>

                <div>
                  <label className={`block font-accent font-bold mb-3 text-lg md:text-xl ${colors.text}`}>
                    Number of Rounds: <span className={colors.primary}>{settings.rounds}</span>
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    value={settings.rounds}
                    onChange={(e) => updateSettings({ ...settings, rounds: parseInt(e.target.value) })}
                    className="w-full h-3 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  />
                  <div className={`flex justify-between text-sm mt-2 ${colors.textSecondary}`}>
                    <span>3 rounds</span>
                    <span>15 rounds</span>
                  </div>
                </div>

                <button
                  onClick={startGame}
                  disabled={players.length < 2}
                  className={`w-full py-5 md:py-6 rounded-xl font-accent font-bold text-xl md:text-2xl transition-all ${players.length < 2
                    ? 'bg-gray-500/50 text-gray-300 cursor-not-allowed'
                    : `${colors.primaryBg} ${colors.primaryHover} text-white hover:scale-[1.02] shadow-2xl animate-pulse`
                    }`}
                >
                  {players.length < 2 ? '⏳ Waiting for players...' : '🚀 Start Game!'}
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-7xl mb-4 animate-bounce">⏳</div>
                <h3 className={`text-2xl font-display font-bold mb-2 ${colors.text}`}>Waiting for host to start...</h3>
                <p className={`font-body ${colors.textSecondary}`}>
                  Rating: <span className={`font-bold ${colors.primary}`}>{settings.rating}</span> |
                  Rounds: <span className={`font-bold ${colors.primary}`}>{settings.rounds}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* SPINNING WHEEL */}
        {gameState === 'spinning' && (
          <div className="flex flex-col items-center">
            <h2 className={`text-2xl md:text-3xl lg:text-4xl font-display font-bold mb-6 md:mb-8 text-center ${colors.text}`}>
              {isSpinning ? '🎡 Spinning...' : isMyTurnToSpin ? '🎯 Your turn to spin!' : `⏳ ${players[currentSpinner]?.username}'s turn to spin`}
            </h2>

            {/* Wheel Container */}
            <div className="relative w-72 h-72 md:w-80 md:h-80 lg:w-96 lg:h-96 mb-8">
              {/* Outer Ring with Lights */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-600 via-red-500 to-red-700 p-3 shadow-2xl">
                {/* Light Bulbs */}
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className={`absolute w-2 h-2 md:w-3 md:h-3 rounded-full ${isSpinning ? 'animate-pulse' : ''}`}
                    style={{
                      background: isSpinning
                        ? `hsl(${(i * 18 + Date.now() / 50) % 360}, 100%, 60%)`
                        : '#FFD700',
                      boxShadow: '0 0 10px #FFD700',
                      top: `${50 - 47 * Math.cos(2 * Math.PI * i / 20)}%`,
                      left: `${50 + 47 * Math.sin(2 * Math.PI * i / 20)}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                ))}

                {/* Inner Wheel */}
                <div
                  ref={wheelRef}
                  className="w-full h-full rounded-full overflow-hidden relative shadow-inner"
                  style={{
                    transform: `rotate(${wheelRotation}deg)`,
                    transition: isSpinning
                      ? 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
                      : 'none',
                    background: 'conic-gradient(from 0deg, ' +
                      players.map((_, i) => {
                        const color = wheelColors[i % wheelColors.length];
                        const start = (i / players.length) * 100;
                        const end = ((i + 1) / players.length) * 100;
                        return `${color} ${start}% ${end}%`;
                      }).join(', ') + ')',
                  }}
                >
                  {/* Player Names on Wheel */}
                  {players.map((player, index) => {
                    const segmentAngle = 360 / players.length;
                    const rotation = index * segmentAngle + segmentAngle / 2;

                    return (
                      <div
                        key={player.username}
                        className="absolute top-1/2 left-1/2 origin-left"
                        style={{
                          transform: `rotate(${rotation}deg) translateX(20%)`,
                        }}
                      >
                        <span
                          className="text-white font-bold text-xs md:text-sm drop-shadow-lg bg-black/40 px-2 py-1 rounded"
                          style={{
                            transform: `rotate(90deg)`,
                            display: 'inline-block',
                          }}
                        >
                          {player.username}
                        </span>
                      </div>
                    );
                  })}

                  {/* Center Cap */}
                  <div className="absolute top-1/2 left-1/2 w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 shadow-lg border-4 border-yellow-300 flex items-center justify-center">
                    <div className="w-6 h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-inner" />
                  </div>
                </div>
              </div>

              {/* Pointer */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                <div
                  className="w-0 h-0 drop-shadow-lg"
                  style={{
                    borderLeft: '20px solid transparent',
                    borderRight: '20px solid transparent',
                    borderTop: '40px solid #FFD700',
                    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
                  }}
                />
                <div
                  className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 absolute -top-2 left-1/2 -translate-x-1/2 border-2 border-yellow-300"
                />
              </div>

              {/* Stand */}
              <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
                <div className="w-24 md:w-32 h-12 md:h-16 bg-gradient-to-b from-red-600 to-red-800 rounded-b-xl shadow-xl" />
                <div className="w-32 md:w-40 h-4 md:h-6 bg-gradient-to-b from-red-700 to-red-900 rounded-b-xl mx-auto -mt-1" />
              </div>
            </div>

            {/* Spin Button */}
            {isMyTurnToSpin && !isSpinning && questionsLoaded && (
              <button
                onClick={spinWheel}
                className={`mt-8 px-8 md:px-12 py-4 md:py-5 rounded-2xl font-accent font-black text-xl md:text-2xl shadow-2xl transition-all hover:scale-110 hover:-translate-y-1 animate-bounce ${colors.primaryBg} ${colors.primaryHover} text-white`}
              >
                🎰 SPIN THE WHEEL!
              </button>
            )}

            {!isMyTurnToSpin && !isSpinning && (
              <div className={`mt-8 text-lg md:text-xl font-body animate-pulse ${colors.textSecondary}`}>
                Waiting for {players[currentSpinner]?.username} to spin...
              </div>
            )}

            {isSpinning && (
              <div className={`mt-8 text-xl md:text-2xl font-display font-bold animate-pulse ${colors.primary}`}>
                🎲 Who will it be?!
              </div>
            )}
          </div>
        )}

        {/* SELECTING CARDS */}
        {gameState === 'selecting' && cards && cards.length > 0 && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <div className={`inline-block px-6 py-3 rounded-full mb-4 ${colors.primaryBg}`}>
                <span className={`text-xl md:text-2xl font-accent font-black text-white`}>
                  🎯 {selectedPlayer}'s Turn!
                </span>
              </div>
              <h2 className={`text-2xl md:text-3xl lg:text-4xl font-display font-bold ${colors.text}`}>
                {selectedPlayer === username
                  ? "✨ Pick a card to reveal your fate!"
                  : `👀 ${selectedPlayer} is choosing...`}
              </h2>
            </div>

            <div className="flex flex-wrap justify-center gap-3 md:gap-4 lg:gap-6">
              {cards.map((card, index) => (
                <div
                  key={card.id}
                  onClick={() => selectCard(card)}
                  className={`relative w-32 h-48 md:w-36 md:h-52 lg:w-44 lg:h-64 transition-all duration-500 
                    ${selectedPlayer === username && flippedCard === null ? 'cursor-pointer hover:scale-110 hover:-translate-y-4 hover:rotate-2' : 'cursor-not-allowed opacity-60'}
                    ${flippedCard === card.id ? 'scale-110 z-10' : ''}`}
                  style={{
                    perspective: '1000px',
                    animationDelay: `${index * 0.1}s`,
                    pointerEvents: selectedPlayer === username && flippedCard === null ? 'auto' : 'none'
                  }}
                >
                  <div
                    className="absolute w-full h-full transition-transform duration-700 preserve-3d"
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: flippedCard === card.id ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    }}
                  >
                    {/* Card Back */}
                    <div
                      className={`absolute w-full h-full rounded-2xl shadow-2xl backface-hidden flex flex-col items-center justify-center p-4
                        ${card.type === 'truth'
                          ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700'
                          : 'bg-gradient-to-br from-red-500 via-red-600 to-orange-700'
                        }
                        border-4 ${card.type === 'truth' ? 'border-blue-300' : 'border-red-300'}
                      `}
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <div className="text-5xl md:text-6xl lg:text-7xl mb-3">
                        {card.type === 'truth' ? '🤔' : '🔥'}
                      </div>
                      <div className="text-white font-black text-lg md:text-xl lg:text-2xl uppercase tracking-wider">
                        {card.type}
                      </div>
                      <div className="text-white/60 text-xs mt-2">
                        {selectedPlayer === username ? 'Tap to reveal' : 'Wait...'}
                      </div>
                    </div>

                    {/* Card Front */}
                    <div
                      className={`absolute w-full h-full rounded-2xl shadow-2xl flex flex-col items-center justify-center p-4
                        ${card.type === 'truth'
                          ? 'bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600'
                          : 'bg-gradient-to-br from-red-400 via-red-500 to-orange-600'
                        }
                        border-4 ${card.type === 'truth' ? 'border-blue-200' : 'border-red-200'}
                      `}
                      style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)'
                      }}
                    >
                      <div className="text-3xl md:text-4xl mb-2">
                        {card.type === 'truth' ? '🤔' : '🔥'}
                      </div>
                      <div className="text-white text-center font-semibold text-xs md:text-sm lg:text-base leading-tight">
                        {card.question}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CARD MODAL */}
        {showCardModal && selectedCard && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div
              className={`max-w-lg w-full rounded-3xl p-6 md:p-8 shadow-2xl transform animate-bounce-in relative
                ${selectedCard.type === 'truth'
                  ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 border-4 border-blue-300'
                  : 'bg-gradient-to-br from-red-500 via-red-600 to-orange-700 border-4 border-red-300'
                }`}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowCardModal(false)}
                className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white font-bold text-xl transition-all hover:scale-110"
              >
                ✕
              </button>

              <div className="text-center">
                <div className="text-7xl md:text-8xl mb-4">
                  {selectedCard.type === 'truth' ? '🤔' : '🔥'}
                </div>
                <h3 className="text-2xl md:text-3xl font-display font-black text-white uppercase mb-6 tracking-wider">
                  {selectedCard.type}
                </h3>
                <p className="text-xl md:text-2xl text-white font-body font-semibold leading-relaxed mb-6">
                  {selectedCard.question}
                </p>
                <div className="text-white/70 mb-6 font-body">
                  {selectedPlayer === username
                    ? "Complete this challenge! Others will rate your performance."
                    : `${selectedPlayer} must complete this challenge!`}
                </div>

                {/* Continue Button */}
                <button
                  onClick={() => setShowCardModal(false)}
                  className="px-8 py-3 bg-white/20 hover:bg-white/30 text-white font-accent font-bold rounded-xl transition-all hover:scale-105"
                >
                  Got it! Let's go! 🚀
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RATING */}
        {gameState === 'rating' && selectedCard && (
          <div className={`rounded-2xl p-6 md:p-8 backdrop-blur-xl border ${colors.surface} ${colors.border}`}>
            <div className={`text-center mb-8 p-6 md:p-8 rounded-2xl ${selectedCard.type === 'truth'
              ? 'bg-gradient-to-br from-blue-500/30 to-indigo-600/30 border-2 border-blue-400/50'
              : 'bg-gradient-to-br from-red-500/30 to-orange-600/30 border-2 border-red-400/50'
              }`}>
              <div className="text-5xl md:text-6xl mb-4">{selectedCard.type === 'truth' ? '🤔' : '🔥'}</div>
              <h2 className={`text-xl md:text-2xl lg:text-3xl font-display font-bold mb-4 uppercase ${colors.text}`}>{selectedCard.type}</h2>
              <p className={`text-lg md:text-xl lg:text-2xl font-body font-medium ${colors.text}`}>{selectedCard.question}</p>
            </div>

            <h3 className={`text-xl md:text-2xl font-display font-bold mb-6 text-center ${colors.text}`}>
              {selectedPlayer === username
                ? "🎭 Perform your challenge! Others are watching..."
                : `⭐ Rate ${selectedPlayer}'s performance!`}
            </h3>

            {selectedPlayer !== username && ratings[username] === undefined && (
              <div className="mb-8">
                <p className={`text-center mb-4 font-body ${colors.textSecondary}`}>Tap a rating:</p>
                <div className="flex justify-center gap-2 md:gap-3 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <button
                      key={num}
                      onClick={() => submitRating(num)}
                      className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 rounded-full font-bold text-base md:text-lg lg:text-xl text-black shadow-lg transition-all hover:scale-125 hover:-translate-y-1"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedPlayer !== username && ratings[username] !== undefined && (
              <div className="text-center mb-8 p-4 bg-green-500/20 rounded-xl border border-green-400/50">
                <p className="text-green-400 font-accent font-bold text-lg">
                  ✅ You rated: {ratings[username]} / 10
                </p>
              </div>
            )}

            {selectedPlayer === username && (
              <div className="text-center mb-8 p-6 bg-blue-500/20 rounded-xl border border-blue-400/50">
                <p className={`font-body text-lg ${colors.text}`}>
                  ⏳ Waiting for others to rate your performance...
                </p>
                <p className={`text-sm mt-2 ${colors.textSecondary}`}>
                  {Object.keys(ratings).length} / {players.length - 1} rated
                </p>
              </div>
            )}

            {/* Ratings Progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className={`font-accent text-sm ${colors.textSecondary}`}>Ratings Submitted</span>
                <span className={`font-accent text-sm font-bold ${colors.primary}`}>
                  {Object.keys(ratings).length} / {players.length - 1}
                </span>
              </div>
              <div className={`w-full h-2 rounded-full ${colors.bgSecondary}`}>
                <div
                  className={`h-full rounded-full transition-all duration-500 ${colors.primaryBg}`}
                  style={{ width: `${(Object.keys(ratings).length / (players.length - 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Next Round Button (Host Only) */}
            {isHost && Object.keys(ratings).length >= players.length - 1 && (
              <button
                onClick={nextRound}
                className={`w-full py-4 rounded-xl font-accent font-bold text-lg transition-all hover:scale-105 shadow-xl ${colors.primaryBg} ${colors.primaryHover} text-white`}
              >
                ➡️ Next Round
              </button>
            )}
          </div>
        )}

        {/* GAME OVER */}
        {gameState === 'gameOver' && (
          <div className={`rounded-2xl p-6 md:p-8 backdrop-blur-xl border ${colors.surface} ${colors.border}`}>
            <div className="text-center mb-8">
              <h2 className={`text-4xl md:text-5xl font-display font-black mb-4 ${colors.primary}`}>
                🎉 Game Over! 🎉
              </h2>
              <p className={`text-lg md:text-xl font-body ${colors.textSecondary}`}>Final Scores</p>
            </div>

            <div className="space-y-3 mb-8">
              {Object.entries(scores)
                .sort(([, a], [, b]) => b - a)
                .map(([playerName, score], index) => (
                  <div
                    key={playerName}
                    className={`p-4 rounded-lg border-2 transition-all backdrop-blur-xl ${index === 0
                      ? `${colors.primaryBg}/20 ${colors.primaryBorder}`
                      : playerName === username
                        ? `${colors.secondaryBg}/20 ${colors.secondaryBorder}`
                        : `${colors.surface} ${colors.border}`
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-3xl md:text-4xl">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'}
                        </span>
                        <div>
                          <p className={`text-lg md:text-xl font-display font-bold ${colors.text}`}>
                            #{index + 1} - {playerName} {playerName === username && '(You)'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl md:text-3xl font-black ${colors.primary}`}>
                          {score}
                        </p>
                        <p className={`text-xs font-body ${colors.textSecondary}`}>
                          points
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <button
              onClick={onLeaveGame}
              className={`w-full px-8 py-4 rounded-xl font-accent font-bold text-lg transition-all hover:scale-105 border border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20`}
            >
              🚪 Return to Lobby
            </button>
          </div>
        )}
      </div>
    </div>
  );
}