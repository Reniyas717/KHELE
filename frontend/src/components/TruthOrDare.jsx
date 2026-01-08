import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export default function TruthOrDare({ roomCode, username, players, onLeaveGame }) {
  const { sendMessage, on } = useWebSocket();

  // Game states
  const [gameState, setGameState] = useState('lobby');
  const [settings, setSettings] = useState({
    rating: 'PG',
    rounds: 5
  });
  const [currentRound, setCurrentRound] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [cards, setCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [flippedCard, setFlippedCard] = useState(null);
  const [ratings, setRatings] = useState({});
  const [scores, setScores] = useState({});
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);

  // API data
  const [truthQuestions, setTruthQuestions] = useState([]);
  const [dareQuestions, setDareQuestions] = useState([]);
  const [isLoadingAPI, setIsLoadingAPI] = useState(true);

  const wheelRef = useRef(null);
  const isHost = players[0]?.username === username;

  // Wheel colors for segments
  const wheelColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DFE6E9', '#FF85A2', '#A29BFE',
    '#74B9FF', '#00B894', '#FDCB6E', '#E17055'
  ];

  // Fetch Truth or Dare questions from API
  useEffect(() => {
    const fetchQuestions = async () => {
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
      } finally {
        setIsLoadingAPI(false);
      }
    };

    fetchQuestions();
  }, [settings.rating]);

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
    });

    const unsubSpin = on('TOD_SPIN_WHEEL', (data) => {
      console.log('🎡 Wheel spinning - FULL PAYLOAD:', data.payload);
      const { selectedPlayer, cards, targetRotation } = data.payload;

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
      // Add multiple full rotations + offset to land on player segment
      // The wheel spins clockwise, so we need to calculate where the pointer will land
      const baseRotation = 360 * 8; // 8 full spins for dramatic effect
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

      // Auto-close modal after 4 seconds and move to rating
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
  }, [on, settings.rounds, players]);

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
    if (!isHost || isSpinning || truthQuestions.length === 0 || dareQuestions.length === 0) return;

    const randomPlayer = players[Math.floor(Math.random() * players.length)].username;
    const newCards = generateCards();

    console.log('🎰 Spinning wheel:', { randomPlayer, cards: newCards });

    sendMessage('TOD_SPIN_WHEEL', {
      roomCode,
      selectedPlayer: randomPlayer,
      cards: newCards
    });
  }, [isHost, isSpinning, players, roomCode, sendMessage, generateCards, truthQuestions, dareQuestions]);

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

  // Render wheel segment
  const renderWheelSegments = () => {
    const segmentAngle = 360 / players.length;

    return players.map((player, index) => {
      const rotation = index * segmentAngle;
      const color = wheelColors[index % wheelColors.length];

      return (
        <div
          key={player.username}
          className="absolute w-full h-full"
          style={{
            transform: `rotate(${rotation}deg)`,
          }}
        >
          {/* Segment */}
          <div
            className="absolute top-0 left-1/2 origin-bottom h-1/2 w-1/2"
            style={{
              transform: `translateX(-50%) rotate(${segmentAngle / 2}deg)`,
              clipPath: `polygon(50% 100%, 0 0, 100% 0)`,
              background: `linear-gradient(to bottom, ${color}, ${color}dd)`,
            }}
          />
          {/* Player name */}
          <div
            className="absolute top-[15%] left-1/2 transform -translate-x-1/2"
            style={{
              transform: `translateX(-50%) rotate(${segmentAngle / 2}deg)`,
            }}
          >
            <span
              className="text-white font-bold text-sm drop-shadow-lg px-2 py-1 rounded bg-black/30"
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                transform: 'rotate(180deg)'
              }}
            >
              {player.username}
            </span>
          </div>
        </div>
      );
    });
  };

  if (isLoadingAPI) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900">
        <div className="text-center">
          <div className="text-8xl mb-4 animate-bounce">🎭</div>
          <h2 className="text-3xl font-bold text-white mb-2">Loading Truth or Dare...</h2>
          <p className="text-gray-300">Fetching spicy questions...</p>
          <div className="mt-4 flex justify-center gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-3 h-3 bg-pink-500 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">🎭 Truth or Dare</h1>
            <p className="text-gray-300 text-sm md:text-base">
              Room: {roomCode} | Round: {currentRound}/{settings.rounds} | Rating: {settings.rating}
            </p>
          </div>
          <button
            onClick={onLeaveGame}
            className="px-4 py-2 md:px-6 md:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition"
          >
            Leave Game
          </button>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {players.map(player => (
            <div
              key={player.username}
              className={`p-3 md:p-4 rounded-xl transition-all duration-300 ${player.username === selectedPlayer
                  ? 'bg-gradient-to-br from-yellow-400 to-orange-500 ring-4 ring-yellow-300 scale-105'
                  : 'bg-white/10 backdrop-blur'
                }`}
            >
              <div className="text-white font-bold text-lg truncate">{player.username}</div>
              <div className="text-2xl md:text-3xl font-bold text-yellow-300">
                {scores[player.username] || 0} pts
              </div>
              {player.username === players[0]?.username && (
                <div className="text-xs text-yellow-200 mt-1">👑 Host</div>
              )}
            </div>
          ))}
        </div>

        {/* LOBBY */}
        {gameState === 'lobby' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 animate-fade-in">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">⚙️ Game Settings</h2>

            {isHost ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-white font-bold mb-3 text-lg md:text-xl">Content Rating</label>
                  <div className="flex flex-wrap gap-3">
                    {['PG', 'PG13', 'R'].map(rating => (
                      <button
                        key={rating}
                        onClick={() => updateSettings({ ...settings, rating })}
                        className={`px-6 py-3 md:px-8 md:py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 ${settings.rating === rating
                            ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white ring-4 ring-pink-300 shadow-lg shadow-pink-500/50'
                            : 'bg-white/20 text-white hover:bg-white/30'
                          }`}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                  <p className="text-gray-300 text-sm mt-3">
                    {settings.rating === 'PG' && '✅ Family-friendly fun for everyone'}
                    {settings.rating === 'PG13' && '⚠️ Teen-appropriate with mild content'}
                    {settings.rating === 'R' && '🔞 Adults only - spicy content ahead!'}
                  </p>
                </div>

                <div>
                  <label className="block text-white font-bold mb-3 text-lg md:text-xl">
                    Number of Rounds: <span className="text-pink-400">{settings.rounds}</span>
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    value={settings.rounds}
                    onChange={(e) => updateSettings({ ...settings, rounds: parseInt(e.target.value) })}
                    className="w-full h-3 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  />
                  <div className="flex justify-between text-white/60 text-sm mt-2">
                    <span>3 rounds</span>
                    <span>15 rounds</span>
                  </div>
                </div>

                <button
                  onClick={startGame}
                  disabled={players.length < 2}
                  className={`w-full py-5 md:py-6 rounded-xl font-bold text-xl md:text-2xl transition-all ${players.length < 2
                      ? 'bg-gray-500/50 text-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white hover:scale-[1.02] shadow-2xl shadow-purple-500/50 animate-pulse'
                    }`}
                >
                  {players.length < 2 ? '⏳ Waiting for players...' : '🚀 Start Game!'}
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-7xl mb-4 animate-bounce">⏳</div>
                <h3 className="text-2xl font-bold text-white mb-2">Waiting for host to start...</h3>
                <p className="text-gray-300">
                  Rating: <span className="text-pink-400 font-bold">{settings.rating}</span> |
                  Rounds: <span className="text-pink-400 font-bold">{settings.rounds}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* SPINNING WHEEL */}
        {gameState === 'spinning' && (
          <div className="flex flex-col items-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
              {isSpinning ? '🎡 Spinning...' : '🎯 Spin to choose a player!'}
            </h2>

            {/* Wheel Container */}
            <div className="relative w-80 h-80 md:w-96 md:h-96 mb-8">
              {/* Outer Ring with Lights */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-600 via-red-500 to-red-700 p-3 shadow-2xl">
                {/* Light Bulbs */}
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className={`absolute w-3 h-3 rounded-full ${isSpinning ? 'animate-pulse' : ''}`}
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
                          className="text-white font-bold text-sm md:text-base drop-shadow-lg bg-black/40 px-2 py-1 rounded"
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
                  <div className="absolute top-1/2 left-1/2 w-16 h-16 md:w-20 md:h-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 shadow-lg border-4 border-yellow-300 flex items-center justify-center">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-inner" />
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
                <div className="w-32 h-16 bg-gradient-to-b from-red-600 to-red-800 rounded-b-xl shadow-xl" />
                <div className="w-40 h-6 bg-gradient-to-b from-red-700 to-red-900 rounded-b-xl mx-auto -mt-1" />
              </div>
            </div>

            {/* Spin Button */}
            {isHost && !isSpinning && (
              <button
                onClick={spinWheel}
                className="mt-8 px-12 py-5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black rounded-2xl font-black text-2xl shadow-2xl shadow-yellow-500/50 transition-all hover:scale-110 hover:-translate-y-1 animate-bounce"
              >
                🎰 SPIN THE WHEEL!
              </button>
            )}

            {!isHost && !isSpinning && (
              <div className="mt-8 text-xl text-white/80 animate-pulse">
                Waiting for {players[0]?.username} to spin...
              </div>
            )}

            {isSpinning && (
              <div className="mt-8 text-2xl font-bold text-yellow-400 animate-pulse">
                🎲 Who will it be?!
              </div>
            )}
          </div>
        )}

        {/* SELECTING CARDS */}
        {gameState === 'selecting' && cards && cards.length > 0 && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <div className="inline-block px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full mb-4">
                <span className="text-2xl font-black text-black">
                  🎯 {selectedPlayer}'s Turn!
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">
                {selectedPlayer === username
                  ? "✨ Pick a card to reveal your fate!"
                  : `👀 ${selectedPlayer} is choosing...`}
              </h2>
            </div>

            <div className="flex flex-wrap justify-center gap-4 md:gap-6">
              {cards.map((card, index) => (
                <div
                  key={card.id}
                  onClick={() => selectCard(card)}
                  className={`relative w-36 h-52 md:w-44 md:h-64 transition-all duration-500 
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
                      <div className="text-6xl md:text-7xl mb-3">
                        {card.type === 'truth' ? '🤔' : '🔥'}
                      </div>
                      <div className="text-white font-black text-xl md:text-2xl uppercase tracking-wider">
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
                      <div className="text-4xl mb-2">
                        {card.type === 'truth' ? '🤔' : '🔥'}
                      </div>
                      <div className="text-white text-center font-semibold text-sm md:text-base leading-tight">
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
              className={`max-w-lg w-full rounded-3xl p-8 shadow-2xl transform animate-bounce-in relative
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
                <div className="text-8xl mb-4">
                  {selectedCard.type === 'truth' ? '🤔' : '🔥'}
                </div>
                <h3 className="text-3xl font-black text-white uppercase mb-6 tracking-wider">
                  {selectedCard.type}
                </h3>
                <p className="text-2xl text-white font-semibold leading-relaxed mb-6">
                  {selectedCard.question}
                </p>
                <div className="text-white/70 mb-6">
                  {selectedPlayer === username
                    ? "Complete this challenge! Others will rate your performance."
                    : `${selectedPlayer} must complete this challenge!`}
                </div>

                {/* Continue Button */}
                <button
                  onClick={() => setShowCardModal(false)}
                  className="px-8 py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl transition-all hover:scale-105"
                >
                  Got it! Let's go! 🚀
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RATING */}
        {gameState === 'rating' && selectedCard && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 animate-fade-in">
            <div className={`text-center mb-8 p-6 md:p-8 rounded-2xl ${selectedCard.type === 'truth'
                ? 'bg-gradient-to-br from-blue-500/30 to-indigo-600/30 border-2 border-blue-400/50'
                : 'bg-gradient-to-br from-red-500/30 to-orange-600/30 border-2 border-red-400/50'
              }`}>
              <div className="text-6xl mb-4">{selectedCard.type === 'truth' ? '🤔' : '🔥'}</div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 uppercase">{selectedCard.type}</h2>
              <p className="text-xl md:text-2xl text-white font-medium">{selectedCard.question}</p>
            </div>

            <h3 className="text-xl md:text-2xl font-bold text-white mb-6 text-center">
              {selectedPlayer === username
                ? "🎭 Perform your challenge! Others are watching..."
                : `⭐ Rate ${selectedPlayer}'s performance!`}
            </h3>

            {selectedPlayer !== username && ratings[username] === undefined && (
              <div className="mb-8">
                <p className="text-center text-white/70 mb-4">Tap a rating:</p>
                <div className="flex justify-center gap-2 md:gap-3 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <button
                      key={num}
                      onClick={() => submitRating(num)}
                      className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 rounded-full font-bold text-lg md:text-xl text-black shadow-lg transition-all hover:scale-125 hover:-translate-y-1"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedPlayer !== username && ratings[username] !== undefined && (
              <div className="text-center mb-8 p-4 bg-green-500/20 rounded-xl border border-green-400/50">
                <p className="text-green-400 font-bold text-lg">
                  ✅ You rated: {ratings[username]} / 10
                </p>
              </div>
            )}

            {selectedPlayer === username && (
              <div className="text-center mb-8 p-4 bg-purple-500/20 rounded-xl border border-purple-400/50">
                <p className="text-purple-300 font-bold text-lg animate-pulse">
                  🎬 Performing... Waiting for ratings...
                </p>
              </div>
            )}

            <div className="bg-white/5 rounded-xl p-4 md:p-6 border border-white/10">
              <h4 className="text-lg font-bold text-white mb-4">
                📊 Votes: {Object.keys(ratings).length}/{players.length - 1}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {players.filter(p => p.username !== selectedPlayer).map(player => (
                  <div
                    key={player.username}
                    className={`p-3 rounded-lg text-center transition-all ${ratings[player.username] !== undefined
                        ? 'bg-green-500/30 border border-green-400/50'
                        : 'bg-white/10 border border-white/20'
                      }`}
                  >
                    <span className={ratings[player.username] !== undefined ? 'text-green-300' : 'text-gray-400'}>
                      {player.username}
                    </span>
                    <div className="text-lg font-bold mt-1">
                      {ratings[player.username] !== undefined ? `${ratings[player.username]}⭐` : '⏳'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {isHost && Object.keys(ratings).length >= players.length - 1 && (
              <button
                onClick={nextRound}
                className="w-full mt-8 py-5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-400 hover:to-teal-400 text-white rounded-xl font-bold text-xl md:text-2xl transition-all hover:scale-[1.02] shadow-xl shadow-green-500/30"
              >
                {currentRound >= settings.rounds ? '🏆 View Final Results!' : '➡️ Next Round'}
              </button>
            )}
          </div>
        )}

        {/* GAME OVER */}
        {gameState === 'gameOver' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 text-center animate-fade-in">
            <div className="text-8xl mb-6 animate-bounce">🏆</div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-8 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              Game Over!
            </h2>

            <div className="space-y-4 mb-8">
              {Object.entries(scores)
                .sort(([, a], [, b]) => b - a)
                .map(([player, score], index) => (
                  <div
                    key={player}
                    className={`p-5 rounded-xl transition-all ${index === 0
                        ? 'bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 scale-105 shadow-2xl shadow-yellow-500/50'
                        : index === 1
                          ? 'bg-gradient-to-r from-gray-400 to-gray-500'
                          : index === 2
                            ? 'bg-gradient-to-r from-amber-700 to-amber-800'
                            : 'bg-white/10'
                      }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="text-4xl">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'}
                        </div>
                        <div className="text-xl md:text-2xl font-bold text-white">{player}</div>
                      </div>
                      <div className="text-3xl md:text-4xl font-black text-white">{score} pts</div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <button
                onClick={() => {
                  setGameState('lobby');
                  setCurrentRound(1);
                  setRatings({});
                  setSelectedCard(null);
                  setFlippedCard(null);
                  setSelectedPlayer(null);
                  setCards([]);
                  setShowCardModal(false);
                  setWheelRotation(0);
                  const initialScores = {};
                  players.forEach(player => {
                    initialScores[player.username] = 0;
                  });
                  setScores(initialScores);
                }}
                className="px-10 py-5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white rounded-xl font-bold text-xl transition-all hover:scale-105 shadow-xl"
              >
                🔄 Play Again
              </button>
              <button
                onClick={onLeaveGame}
                className="px-10 py-5 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white rounded-xl font-bold text-xl transition-all hover:scale-105 shadow-xl"
              >
                🚪 Leave Game
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Custom Styles */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes bounce-in {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        
        .animate-bounce-in {
          animation: bounce-in 0.6s ease-out;
        }
        
        .preserve-3d {
          transform-style: preserve-3d;
        }
        
        .backface-hidden {
          backface-visibility: hidden;
        }
      `}</style>
    </div>
  );
}