import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function TruthOrDare({ roomCode, username, players, onLeaveGame }) {
  const { sendMessage, on } = useWebSocket();
  
  // Game states
  const [gameState, setGameState] = useState('lobby'); // lobby, spinning, selecting, rating, results, gameOver
  const [settings, setSettings] = useState({
    rating: 'PG',
    rounds: 5
  });
  const [currentRound, setCurrentRound] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [cards, setCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [ratings, setRatings] = useState({});
  const [scores, setScores] = useState({});
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  
  // API data
  const [truthQuestions, setTruthQuestions] = useState([]);
  const [dareQuestions, setDareQuestions] = useState([]);
  const [isLoadingAPI, setIsLoadingAPI] = useState(true);
  
  const wheelRef = useRef(null);
  const isHost = players[0]?.username === username;

  // Fetch Truth or Dare questions from API
  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoadingAPI(true);
      try {
        const [truthRes, dareRes] = await Promise.all([
          fetch('https://api.truthordarebot.xyz/v1/truth'),
          fetch('https://api.truthordarebot.xyz/v1/dare')
        ]);

        if (truthRes.ok && dareRes.ok) {
          const truthData = await truthRes.json();
          const dareData = await dareRes.json();
          
          setTruthQuestions(truthData.question ? [truthData.question] : []);
          setDareQuestions(dareData.question ? [dareData.question] : []);
          
          // Fetch more questions
          const fetchBatch = async (type, count) => {
            const questions = [];
            for (let i = 0; i < count; i++) {
              try {
                const res = await fetch(`https://api.truthordarebot.xyz/v1/${type}`);
                if (res.ok) {
                  const data = await res.json();
                  if (data.question) questions.push(data.question);
                }
                await new Promise(resolve => setTimeout(resolve, 100));
              } catch (err) {
                console.error(`Error fetching ${type}:`, err);
              }
            }
            return questions;
          };

          const [moreTruths, moreDares] = await Promise.all([
            fetchBatch('truth', 50),
            fetchBatch('dare', 50)
          ]);

          setTruthQuestions(prev => [...prev, ...moreTruths]);
          setDareQuestions(prev => [...prev, ...moreDares]);
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
        // Fallback questions
        setTruthQuestions([
          "What's the most embarrassing thing you've ever done?",
          "What's your biggest secret?",
          "Who do you have a crush on?",
          "What's the worst lie you've ever told?",
          "What's your most embarrassing moment in school?"
        ]);
        setDareQuestions([
          "Do 20 pushups right now",
          "Sing your favorite song",
          "Dance for 30 seconds",
          "Do your best celebrity impression",
          "Speak in an accent for the next 3 rounds"
        ]);
      } finally {
        setIsLoadingAPI(false);
      }
    };

    fetchQuestions();
  }, []);

  // Initialize scores
  useEffect(() => {
    const initialScores = {};
    players.forEach(player => {
      initialScores[player.username] = 0;
    });
    setScores(initialScores);
  }, [players]);

  // WebSocket message handlers
  useEffect(() => {
    const unsubSettings = on('TOD_SETTINGS_UPDATE', (data) => {
      setSettings(data.payload.settings);
    });

    const unsubGameStart = on('TOD_GAME_START', (data) => {
      setGameState('spinning');
      setSettings(data.payload.settings);
    });

    const unsubSpin = on('TOD_SPIN_WHEEL', (data) => {
      performSpin(data.payload.selectedPlayer);
    });

    const unsubCardSelect = on('TOD_CARD_SELECTED', (data) => {
      setSelectedCard(data.payload.card);
      setGameState('rating');
    });

    const unsubRating = on('TOD_RATING_SUBMITTED', (data) => {
      setRatings(prev => ({
        ...prev,
        [data.payload.rater]: data.payload.rating
      }));
    });

    const unsubNextRound = on('TOD_NEXT_ROUND', (data) => {
      const { scores: newScores, round } = data.payload;
      setScores(newScores);
      setCurrentRound(round);
      setRatings({});
      setSelectedCard(null);
      setSelectedPlayer(null);
      
      if (round > settings.rounds) {
        setGameState('gameOver');
      } else {
        setGameState('spinning');
      }
    });

    return () => {
      unsubSettings?.();
      unsubGameStart?.();
      unsubSpin?.();
      unsubCardSelect?.();
      unsubRating?.();
      unsubNextRound?.();
    };
  }, [on, settings.rounds]);

  // Update settings (host only)
  const updateSettings = useCallback((newSettings) => {
    if (!isHost) return;
    setSettings(newSettings);
    sendMessage('TOD_SETTINGS_UPDATE', {
      roomCode,
      settings: newSettings
    });
  }, [isHost, roomCode, sendMessage]);

  // Start game (host only)
  const startGame = useCallback(() => {
    if (!isHost || players.length < 2) return;
    sendMessage('TOD_GAME_START', {
      roomCode,
      settings
    });
    setGameState('spinning');
  }, [isHost, players.length, roomCode, sendMessage, settings]);

  // Spin wheel animation
  const performSpin = useCallback((targetPlayer) => {
    setIsSpinning(true);
    
    const playerIndex = players.findIndex(p => p.username === targetPlayer);
    const degreesPerPlayer = 360 / players.length;
    const targetRotation = 360 * 5 + (playerIndex * degreesPerPlayer);
    
    setWheelRotation(targetRotation);
    
    setTimeout(() => {
      setIsSpinning(false);
      setSelectedPlayer(targetPlayer);
      generateCards();
      setGameState('selecting');
    }, 4000);
  }, [players]);

  // Spin wheel (host only)
  const spinWheel = useCallback(() => {
    if (!isHost || isSpinning) return;
    
    const randomPlayer = players[Math.floor(Math.random() * players.length)].username;
    
    sendMessage('TOD_SPIN_WHEEL', {
      roomCode,
      selectedPlayer: randomPlayer
    });
    
    performSpin(randomPlayer);
  }, [isHost, isSpinning, players, roomCode, sendMessage, performSpin]);

  // Generate 5 random cards
  const generateCards = useCallback(() => {
    const newCards = [];
    for (let i = 0; i < 5; i++) {
      const isTruth = Math.random() > 0.5;
      const questions = isTruth ? truthQuestions : dareQuestions;
      
      if (questions.length > 0) {
        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
        newCards.push({
          id: i,
          type: isTruth ? 'truth' : 'dare',
          question: randomQuestion,
          rating: isTruth ? settings.rating : settings.rating
        });
      }
    }
    setCards(newCards);
  }, [truthQuestions, dareQuestions, settings.rating]);

  // Select card (selected player only)
  const selectCard = useCallback((card) => {
    if (selectedPlayer !== username) return;
    
    setSelectedCard(card);
    sendMessage('TOD_CARD_SELECTED', {
      roomCode,
      card
    });
    setGameState('rating');
  }, [selectedPlayer, username, roomCode, sendMessage]);

  // Submit rating
  const submitRating = useCallback((rating) => {
    if (ratings[username] !== undefined) return;
    
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

  // Next round (host only)
  const nextRound = useCallback(() => {
    if (!isHost) return;
    
    // Calculate average rating
    const ratingValues = Object.values(ratings);
    const averageRating = ratingValues.length > 0 
      ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length 
      : 0;
    
    // Update scores
    const newScores = { ...scores };
    newScores[selectedPlayer] = (newScores[selectedPlayer] || 0) + Math.round(averageRating);
    
    const nextRoundNum = currentRound + 1;
    
    sendMessage('TOD_NEXT_ROUND', {
      roomCode,
      scores: newScores,
      round: nextRoundNum
    });
    
    setScores(newScores);
    setCurrentRound(nextRoundNum);
    setRatings({});
    setSelectedCard(null);
    setSelectedPlayer(null);
    
    if (nextRoundNum > settings.rounds) {
      setGameState('gameOver');
    } else {
      setGameState('spinning');
    }
  }, [isHost, ratings, scores, selectedPlayer, currentRound, settings.rounds, roomCode, sendMessage]);

  if (isLoadingAPI) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900">
        <div className="text-center">
          <div className="animate-spin text-8xl mb-4">🎭</div>
          <h2 className="text-3xl font-bold text-white mb-2">Loading Truth or Dare...</h2>
          <p className="text-gray-300">Fetching questions from the vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-5xl font-bold text-white mb-2 flex items-center gap-3">
              🎭 Truth or Dare
            </h1>
            <p className="text-gray-300">
              Room: {roomCode} | Round: {currentRound}/{settings.rounds}
            </p>
          </div>
          <button
            onClick={onLeaveGame}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition"
          >
            Leave Game
          </button>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {players.map(player => (
            <motion.div
              key={player.username}
              className={`p-4 rounded-lg ${
                player.username === selectedPlayer
                  ? 'bg-yellow-500 ring-4 ring-yellow-300'
                  : 'bg-white/10'
              }`}
              whileHover={{ scale: 1.05 }}
            >
              <div className="text-white font-bold text-lg">{player.username}</div>
              <div className="text-3xl font-bold text-yellow-300">
                {scores[player.username] || 0} pts
              </div>
              {player.username === players[0]?.username && (
                <div className="text-xs text-yellow-200 mt-1">👑 Host</div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Game States */}
        <AnimatePresence mode="wait">
          {/* LOBBY */}
          {gameState === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-8"
            >
              <h2 className="text-3xl font-bold text-white mb-6">⚙️ Game Settings</h2>
              
              {isHost ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-white font-bold mb-3 text-xl">
                      Content Rating
                    </label>
                    <div className="flex gap-4">
                      {['PG', 'PG13', 'R'].map(rating => (
                        <button
                          key={rating}
                          onClick={() => updateSettings({ ...settings, rating })}
                          className={`px-8 py-4 rounded-lg font-bold text-lg transition ${
                            settings.rating === rating
                              ? 'bg-pink-500 text-white ring-4 ring-pink-300'
                              : 'bg-white/20 text-white hover:bg-white/30'
                          }`}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-white font-bold mb-3 text-xl">
                      Number of Rounds: {settings.rounds}
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="10"
                      value={settings.rounds}
                      onChange={(e) => updateSettings({ ...settings, rounds: parseInt(e.target.value) })}
                      className="w-full h-3 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-white/60 text-sm mt-2">
                      <span>3 rounds</span>
                      <span>10 rounds</span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={startGame}
                    disabled={players.length < 2}
                    className={`w-full py-6 rounded-xl font-bold text-2xl transition ${
                      players.length < 2
                        ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                        : 'bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600'
                    }`}
                  >
                    {players.length < 2 ? 'Waiting for players...' : '🎮 Start Game!'}
                  </motion.button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">⏳</div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    Waiting for host to start...
                  </h3>
                  <p className="text-gray-300">
                    Rating: {settings.rating} | Rounds: {settings.rounds}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* SPINNING WHEEL */}
          {gameState === 'spinning' && (
            <motion.div
              key="spinning"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center"
            >
              <h2 className="text-4xl font-bold text-white mb-8">
                🎡 Spinning the Wheel...
              </h2>
              
              <div className="relative w-96 h-96 mx-auto mb-8">
                <motion.div
                  ref={wheelRef}
                  className="w-full h-full rounded-full border-8 border-white shadow-2xl relative overflow-hidden"
                  animate={{ rotate: wheelRotation }}
                  transition={{ duration: 4, ease: "easeOut" }}
                  style={{ background: 'conic-gradient(from 0deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #ffeaa7, #dfe6e9)' }}
                >
                  {players.map((player, index) => {
                    const angle = (360 / players.length) * index;
                    return (
                      <div
                        key={player.username}
                        className="absolute top-1/2 left-1/2 origin-left"
                        style={{
                          transform: `rotate(${angle}deg) translateX(120px)`,
                          width: '100px'
                        }}
                      >
                        <div className="bg-white px-3 py-2 rounded-full shadow-lg font-bold text-sm">
                          {player.username}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
                
                {/* Pointer */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-4">
                  <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-yellow-400"></div>
                </div>
              </div>

              {isHost && !isSpinning && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={spinWheel}
                  className="px-12 py-6 bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl font-bold text-2xl shadow-lg"
                >
                  🎰 SPIN!
                </motion.button>
              )}
            </motion.div>
          )}

          {/* CARD SELECTION */}
          {gameState === 'selecting' && (
            <motion.div
              key="selecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h2 className="text-4xl font-bold text-white mb-4 text-center">
                🎴 {selectedPlayer === username ? "Choose your fate!" : `${selectedPlayer} is choosing...`}
              </h2>
              
              <div className="grid grid-cols-5 gap-4 mb-8">
                {cards.map((card, index) => (
                  <motion.div
                    key={card.id}
                    initial={{ rotateY: 180, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: selectedPlayer === username ? 1.05 : 1 }}
                    className={`relative cursor-pointer ${selectedPlayer !== username ? 'pointer-events-none' : ''}`}
                    onClick={() => selectCard(card)}
                  >
                    <div className={`aspect-[2/3] rounded-xl p-6 flex flex-col items-center justify-center shadow-xl ${
                      card.type === 'truth' 
                        ? 'bg-gradient-to-br from-blue-500 to-blue-700' 
                        : 'bg-gradient-to-br from-red-500 to-red-700'
                    }`}>
                      <div className="text-6xl mb-4">
                        {card.type === 'truth' ? '🤔' : '🔥'}
                      </div>
                      <div className="text-white font-bold text-2xl uppercase">
                        {card.type}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* RATING */}
          {gameState === 'rating' && selectedCard && (
            <motion.div
              key="rating"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-8"
            >
              <div className={`text-center mb-8 p-8 rounded-xl ${
                selectedCard.type === 'truth' 
                  ? 'bg-blue-500/20' 
                  : 'bg-red-500/20'
              }`}>
                <div className="text-6xl mb-4">
                  {selectedCard.type === 'truth' ? '🤔' : '🔥'}
                </div>
                <h2 className="text-3xl font-bold text-white mb-4 uppercase">
                  {selectedCard.type}
                </h2>
                <p className="text-2xl text-white font-medium">
                  {selectedCard.question}
                </p>
              </div>

              <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-4 text-center">
                  {selectedPlayer === username 
                    ? "Time to perform! Others are rating you..." 
                    : `Rate ${selectedPlayer}'s performance!`}
                </h3>
              </div>

              {selectedPlayer !== username && ratings[username] === undefined && (
                <div className="flex justify-center gap-3 mb-8">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <motion.button
                      key={num}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => submitRating(num)}
                      className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 rounded-full font-bold text-2xl text-white shadow-lg"
                    >
                      {num}
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Ratings Progress */}
              <div className="bg-white/10 rounded-xl p-6">
                <h4 className="text-xl font-bold text-white mb-4">
                  Votes: {Object.keys(ratings).length}/{players.length - 1}
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {players.filter(p => p.username !== selectedPlayer).map(player => (
                    <div
                      key={player.username}
                      className={`p-3 rounded-lg ${
                        ratings[player.username] !== undefined
                          ? 'bg-green-500/30 text-green-200'
                          : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      {player.username}: {ratings[player.username] !== undefined ? '✓' : '⏳'}
                    </div>
                  ))}
                </div>
              </div>

              {isHost && Object.keys(ratings).length >= players.length - 1 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={nextRound}
                  className="w-full mt-8 py-6 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white rounded-xl font-bold text-2xl"
                >
                  {currentRound >= settings.rounds ? '🏆 View Results' : '➡️ Next Round'}
                </motion.button>
              )}
            </motion.div>
          )}

          {/* GAME OVER */}
          {gameState === 'gameOver' && (
            <motion.div
              key="gameOver"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center"
            >
              <div className="text-8xl mb-6">🏆</div>
              <h2 className="text-5xl font-bold text-white mb-8">Game Over!</h2>
              
              <div className="space-y-4 mb-8">
                {Object.entries(scores)
                  .sort(([, a], [, b]) => b - a)
                  .map(([player, score], index) => (
                    <motion.div
                      key={player}
                      initial={{ x: -100, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-6 rounded-xl ${
                        index === 0 
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-500' 
                          : 'bg-white/10'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="text-4xl">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'}
                          </div>
                          <div className="text-2xl font-bold text-white">{player}</div>
                        </div>
                        <div className="text-4xl font-bold text-white">{score} pts</div>
                      </div>
                    </motion.div>
                  ))}
              </div>

              <div className="flex gap-4 justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setGameState('lobby');
                    setCurrentRound(1);
                    setRatings({});
                    setSelectedCard(null);
                    setSelectedPlayer(null);
                    const initialScores = {};
                    players.forEach(player => {
                      initialScores[player.username] = 0;
                    });
                    setScores(initialScores);
                  }}
                  className="px-12 py-6 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white rounded-xl font-bold text-2xl"
                >
                  🔄 Play Again
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onLeaveGame}
                  className="px-12 py-6 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-2xl"
                >
                  🚪 Leave Game
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}