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
      console.log('🔍 Fetching questions for rating:', settings.rating);
      
      try {
        const fetchBatch = async (type, count) => {
          const questions = [];
          for (let i = 0; i < count; i++) {
            try {
              const res = await fetch(`http://localhost:5000/api/rooms/truthordare/${type}?rating=${settings.rating}`);
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
          "What's your most embarrassing moment?"
        ]);
        setDareQuestions([
          "Do 20 pushups right now",
          "Sing your favorite song",
          "Dance for 30 seconds",
          "Do your best celebrity impression",
          "Speak in an accent for 3 rounds"
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
      const { selectedPlayer, cards } = data.payload;
      
      // Validate cards exist
      if (!cards || !Array.isArray(cards) || cards.length === 0) {
        console.error('❌ No cards received in payload!');
        return;
      }
      
      console.log('✅ Cards received:', cards);
      
      // Set cards and selectedPlayer immediately
      setCards(cards);
      setSelectedPlayer(selectedPlayer);
      setIsSpinning(true);
      
      // Animate the wheel
      const playerIndex = players.findIndex(p => p.username === selectedPlayer);
      const degreesPerPlayer = 360 / players.length;
      const targetRotation = 360 * 5 + (playerIndex * degreesPerPlayer);
      setWheelRotation(targetRotation);
      
      setTimeout(() => {
        setIsSpinning(false);
        setGameState('selecting');
        console.log('🎴 Cards set after spin:', cards);
      }, 4000);
    });

    const unsubCardSelect = on('TOD_CARD_SELECTED', (data) => {
      console.log('🎴 Card selected:', data.payload.card);
      setSelectedCard(data.payload.card);
      setFlippedCard(data.payload.card.id);
      setGameState('rating');
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
    setGameState('spinning');
    setCurrentRound(1);
  }, [isHost, players.length, roomCode, sendMessage, settings]);

  const generateCards = useCallback(() => {
    console.log('🎴 Generating cards with questions:', { 
      truths: truthQuestions.length, 
      dares: dareQuestions.length 
    });
    
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
    console.log('🎴 Generated cards:', newCards);
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
    
    // DON'T call performSpin here - let the WebSocket message handle it
  }, [isHost, isSpinning, players, roomCode, sendMessage, generateCards, truthQuestions, dareQuestions]);

  const selectCard = useCallback((card) => {
    if (selectedPlayer !== username) return;
    console.log('🎴 Selecting card:', card);
    setSelectedCard(card);
    setFlippedCard(card.id);
    sendMessage('TOD_CARD_SELECTED', {
      roomCode,
      card
    });
    setGameState('rating');
  }, [selectedPlayer, username, roomCode, sendMessage]);

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
    
    console.log('➡️ Next round:', { nextRoundNum, newScores });
    
    sendMessage('TOD_NEXT_ROUND', {
      roomCode,
      scores: newScores,
      round: nextRoundNum
    });
    
    setScores(newScores);
    setCurrentRound(nextRoundNum);
    setRatings({});
    setSelectedCard(null);
    setFlippedCard(null);
    setSelectedPlayer(null);
    setCards([]);
    
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
          <div className="text-8xl mb-4 animate-spin">🎭</div>
          <h2 className="text-3xl font-bold text-white mb-2">Loading Truth or Dare...</h2>
          <p className="text-gray-300">Fetching questions from the vault...</p>
          <p className="text-gray-400 text-sm mt-2">Rating: {settings.rating}</p>
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
            <h1 className="text-5xl font-bold text-white mb-2">🎭 Truth or Dare</h1>
            <p className="text-gray-300">
              Room: {roomCode} | Round: {currentRound}/{settings.rounds} | Rating: {settings.rating}
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
            <div
              key={player.username}
              className={`p-4 rounded-lg transition-transform hover:scale-105 ${
                player.username === selectedPlayer
                  ? 'bg-yellow-500 ring-4 ring-yellow-300'
                  : 'bg-white/10'
              }`}
            >
              <div className="text-white font-bold text-lg">{player.username}</div>
              <div className="text-3xl font-bold text-yellow-300">
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
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 animate-fade-in">
            <h2 className="text-3xl font-bold text-white mb-6">⚙️ Game Settings</h2>
            
            {isHost ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-white font-bold mb-3 text-xl">Content Rating</label>
                  <div className="flex gap-4">
                    {['PG', 'PG13', 'R'].map(rating => (
                      <button
                        key={rating}
                        onClick={() => updateSettings({ ...settings, rating })}
                        className={`px-8 py-4 rounded-lg font-bold text-lg transition-all hover:scale-105 ${
                          settings.rating === rating
                            ? 'bg-pink-500 text-white ring-4 ring-pink-300'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                  <p className="text-gray-300 text-sm mt-2">
                    {settings.rating === 'PG' && '✅ Family-friendly questions'}
                    {settings.rating === 'PG13' && '⚠️ Mild adult content'}
                    {settings.rating === 'R' && '🔞 Adult content only'}
                  </p>
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

                <button
                  onClick={startGame}
                  disabled={players.length < 2}
                  className={`w-full py-6 rounded-xl font-bold text-2xl transition-all hover:scale-105 ${
                    players.length < 2
                      ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600'
                  }`}
                >
                  {players.length < 2 ? 'Waiting for players...' : '🎮 Start Game!'}
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">⏳</div>
                <h3 className="text-2xl font-bold text-white mb-2">Waiting for host...</h3>
                <p className="text-gray-300">Rating: {settings.rating} | Rounds: {settings.rounds}</p>
              </div>
            )}
          </div>
        )}

        {/* SPINNING */}
        {gameState === 'spinning' && (
          <div className="text-center">
            <h2 className="text-4xl font-bold text-white mb-8">🎡 Choose your fate!</h2>
            <div className="relative w-96 h-96 mx-auto mb-8">
              <div
                ref={wheelRef}
                className="w-full h-full rounded-full border-8 border-white shadow-2xl relative overflow-hidden transition-transform duration-[4000ms] ease-out"
                style={{
                  transform: `rotate(${wheelRotation}deg)`,
                  background: 'conic-gradient(from 0deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #ffeaa7, #dfe6e9)'
                }}
              >
                {players.map((player, index) => {
                  const angle = (360 / players.length) * index;
                  return (
                    <div
                      key={player.username}
                      className="absolute top-1/2 left-1/2"
                      style={{
                        transform: `rotate(${angle}deg) translateX(120px)`,
                        transformOrigin: 'left center'
                      }}
                    >
                      <div className="bg-white px-3 py-2 rounded-full shadow-lg font-bold text-sm text-black">
                        {player.username}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-4">
                <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-yellow-400"></div>
              </div>
            </div>
            {isHost && !isSpinning && (
              <button
                onClick={spinWheel}
                className="px-12 py-6 bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl font-bold text-2xl shadow-lg transition-transform hover:scale-105"
              >
                🎰 SPIN!
              </button>
            )}
          </div>
        )}

        {/* SELECTING */}
        {gameState === 'selecting' && cards && cards.length > 0 && (
          <div>
            <h2 className="text-4xl font-bold text-white mb-8 text-center">
              🎴 {selectedPlayer === username ? "Pick a card!" : `${selectedPlayer} is choosing...`}
            </h2>
            <div className="grid grid-cols-5 gap-6">
              {cards.map((card) => (
                <div
                  key={card.id}
                  onClick={() => selectCard(card)}
                  className={`relative aspect-[2/3] rounded-2xl shadow-2xl transition-all duration-500 cursor-pointer
                    ${selectedPlayer === username ? 'hover:scale-110 hover:-translate-y-2' : 'pointer-events-none opacity-50'}
                    ${flippedCard === card.id ? 'scale-110' : ''}`}
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: flippedCard === card.id ? 'rotateY(180deg)' : 'rotateY(0deg)'
                  }}
                >
                  {/* Card Back */}
                  <div className={`absolute inset-0 rounded-2xl p-6 flex flex-col items-center justify-center ${
                    card.type === 'truth' 
                      ? 'bg-gradient-to-br from-blue-600 to-blue-800' 
                      : 'bg-gradient-to-br from-red-600 to-red-800'
                  }`} style={{ backfaceVisibility: 'hidden' }}>
                    <div className="text-6xl mb-4">{card.type === 'truth' ? '🤔' : '🔥'}</div>
                    <div className="text-white font-bold text-2xl uppercase">{card.type}</div>
                  </div>

                  {/* Card Front (Question) */}
                  <div className={`absolute inset-0 rounded-2xl p-6 flex flex-col items-center justify-center ${
                    card.type === 'truth' 
                      ? 'bg-gradient-to-br from-blue-600 to-blue-800' 
                      : 'bg-gradient-to-br from-red-600 to-red-800'
                  }`} style={{ 
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)'
                  }}>
                    <div className="text-white text-center font-medium">
                      {card.question}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RATING */}
        {gameState === 'rating' && selectedCard && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
            <div className={`text-center mb-8 p-8 rounded-xl ${
              selectedCard.type === 'truth' ? 'bg-blue-500/20' : 'bg-red-500/20'
            }`}>
              <div className="text-6xl mb-4">{selectedCard.type === 'truth' ? '🤔' : '🔥'}</div>
              <h2 className="text-3xl font-bold text-white mb-4 uppercase">{selectedCard.type}</h2>
              <p className="text-2xl text-white font-medium">{selectedCard.question}</p>
            </div>

            <h3 className="text-2xl font-bold text-white mb-4 text-center">
              {selectedPlayer === username 
                ? "Time to perform! Others are rating you..." 
                : `Rate ${selectedPlayer}'s performance!`}
            </h3>

            {selectedPlayer !== username && ratings[username] === undefined && (
              <div className="flex justify-center gap-3 mb-8 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                  <button
                    key={num}
                    onClick={() => submitRating(num)}
                    className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 rounded-full font-bold text-2xl text-white shadow-lg transition-transform hover:scale-110"
                  >
                    {num}
                  </button>
                ))}
              </div>
            )}

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
                    {player.username}: {ratings[player.username] !== undefined ? `${ratings[player.username]}⭐` : '⏳'}
                  </div>
                ))}
              </div>
            </div>

            {isHost && Object.keys(ratings).length >= players.length - 1 && (
              <button
                onClick={nextRound}
                className="w-full mt-8 py-6 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white rounded-xl font-bold text-2xl transition-transform hover:scale-105"
              >
                {currentRound >= settings.rounds ? '🏆 View Results' : '➡️ Next Round'}
              </button>
            )}
          </div>
        )}

        {/* GAME OVER */}
        {gameState === 'gameOver' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
            <div className="text-8xl mb-6">🏆</div>
            <h2 className="text-5xl font-bold text-white mb-8">Game Over!</h2>
            <div className="space-y-4 mb-8">
              {Object.entries(scores)
                .sort(([, a], [, b]) => b - a)
                .map(([player, score], index) => (
                  <div
                    key={player}
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
                  </div>
                ))}
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setGameState('lobby');
                  setCurrentRound(1);
                  setRatings({});
                  setSelectedCard(null);
                  setFlippedCard(null);
                  setSelectedPlayer(null);
                  setCards([]);
                  const initialScores = {};
                  players.forEach(player => {
                    initialScores[player.username] = 0;
                  });
                  setScores(initialScores);
                }}
                className="px-12 py-6 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white rounded-xl font-bold text-2xl transition-transform hover:scale-105"
              >
                🔄 Play Again
              </button>
              <button
                onClick={onLeaveGame}
                className="px-12 py-6 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-2xl transition-transform hover:scale-105"
              >
                🚪 Leave Game
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}