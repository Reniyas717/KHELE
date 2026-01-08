import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';
import PixelSnow from './ui/PixelSnow';
import {
  IoArrowBack,
  IoSunnyOutline,
  IoMoonOutline,
  IoPeopleSharp,
  IoTrophySharp,
  IoRefreshSharp
} from 'react-icons/io5';
import { FaIdCard } from 'react-icons/fa6';

export default function UNOGame({ roomCode, username, players, initialGameState, onLeaveRoom }) {
  const { colors, theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(initialGameState || null);
  const [myHand, setMyHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [gameOverData, setGameOverData] = useState(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const { sendMessage, on, isConnected } = useWebSocket();
  const listenersSetup = useRef(false);
  const handRequestSent = useRef(false);

  // Check if current user has finished
  const myPlayer = gameState?.players?.find(p => p.name === username);
  const iHaveFinished = myPlayer?.finished || false;

  // Theme-based PixelSnow colors
  const snowColor = theme === 'dark' ? '#ef4444' : '#3b82f6';
  const snowDensity = theme === 'dark' ? 0.1 : 0.08;
  const snowBrightness = theme === 'dark' ? 0.5 : 0.35;

  console.log('🎮 UNOGame render:', {
    username,
    currentPlayer: gameState?.currentPlayer,
    isMyTurn: gameState?.currentPlayer === username,
    myHandSize: myHand.length,
    iHaveFinished,
    hasGameState: !!gameState,
    isLoading
  });

  // Initialize game state from props
  useEffect(() => {
    if (initialGameState) {
      console.log('📦 Setting initial game state:', initialGameState);
      setGameState(initialGameState);
    }
  }, [initialGameState]);

  // Request hand when component mounts or game starts
  useEffect(() => {
    if (isConnected && roomCode && username && !handRequestSent.current) {
      console.log('🤚 Requesting hand for', username);
      handRequestSent.current = true;
      setIsLoading(true);

      sendMessage('REQUEST_HAND', { roomCode, username });

      // Retry after 1 second if still loading
      const retryTimer = setTimeout(() => {
        if (isLoading && myHand.length === 0) {
          console.log('🔄 Retrying hand request...');
          sendMessage('REQUEST_HAND', { roomCode, username });
        }
      }, 1000);

      // Retry after 2 seconds if still loading
      const secondRetryTimer = setTimeout(() => {
        if (isLoading && myHand.length === 0) {
          console.log('🔄 Second retry for hand request...');
          sendMessage('REQUEST_HAND', { roomCode, username });
        }
      }, 2000);

      return () => {
        clearTimeout(retryTimer);
        clearTimeout(secondRetryTimer);
      };
    }
  }, [isConnected, roomCode, username, sendMessage, isLoading, myHand.length]);

  // Watch for game over condition
  useEffect(() => {
    if (!gameState?.players) return;

    const activePlayers = gameState.players.filter(p => !p.finished);
    const finishedCount = gameState.players.filter(p => p.finished).length;

    if (activePlayers.length <= 1 && finishedCount >= gameState.players.length - 1 && !showGameOver) {
      console.log('🏆 Game over condition met');

      const rankings = gameState.players
        .sort((a, b) => (a.position || 999) - (b.position || 999))
        .map(p => ({
          name: p.name,
          position: p.position || gameState.players.length,
          points: p.score || 0
        }));

      setTimeout(() => {
        setGameOverData({
          rankings,
          finalScores: rankings.map(r => ({ name: r.name, points: r.points }))
        });
        setShowGameOver(true);
      }, 1500);
    }
  }, [gameState?.players, showGameOver]);

  // Setup WebSocket listeners
  useEffect(() => {
    if (!isConnected || listenersSetup.current) return;

    console.log('🎧 Setting up UNO WebSocket listeners');
    listenersSetup.current = true;

    const unsubHandUpdate = on('HAND_UPDATE', (data) => {
      console.log('🃏 HAND_UPDATE received:', data);
      const hand = data.payload?.hand || data.hand || [];
      const newGameState = data.payload?.gameState;

      console.log(`✅ Received hand: ${hand.length} cards for ${username}`);
      console.log('🎴 Cards:', hand.map(c => `${c.value}-${c.color}`));

      setMyHand(hand);

      if (newGameState) {
        console.log('📊 Updating game state from HAND_UPDATE:', {
          currentPlayer: newGameState.currentPlayer,
          currentCard: newGameState.currentCard,
          isMyTurn: newGameState.currentPlayer === username
        });
        setGameState(prevState => ({
          ...prevState,
          ...newGameState
        }));
      }

      setIsLoading(false);
    });

    const unsubCardPlayed = on('CARD_PLAYED', (data) => {
      console.log('🎴 CARD_PLAYED received:', data);
      const newGameState = data.payload?.gameState || data.gameState;

      console.log('📊 Updating game state after card played');
      setGameState(newGameState);

      // Request updated hand
      setTimeout(() => {
        console.log('🔄 Requesting hand update after card played');
        sendMessage('REQUEST_HAND', { roomCode, username });
      }, 200);
    });

    const unsubCardDrawn = on('CARD_DRAWN', (data) => {
      console.log('📥 CARD_DRAWN received:', data);
      const newGameState = data.payload?.gameState || data.gameState;

      console.log('📊 Updating game state after card drawn');
      setGameState(newGameState);

      // Request updated hand
      setTimeout(() => {
        console.log('🔄 Requesting hand update after card drawn');
        sendMessage('REQUEST_HAND', { roomCode, username });
      }, 200);
    });

    const unsubGameOver = on('GAME_OVER', (data) => {
      console.log('🏆 GAME_OVER received:', data);
      const payload = data.payload || data;

      setGameOverData({
        rankings: payload.rankings || [],
        finalScores: payload.finalScores || []
      });
      setShowGameOver(true);
    });

    const unsubError = on('ERROR', (data) => {
      console.error('❌ ERROR received:', data);
      const message = data.payload?.message || data.message;

      // If error is about player not found, try requesting hand again
      if (message.includes('Player not found')) {
        console.log('🔄 Player not found error - retrying hand request in 1s');
        setTimeout(() => {
          sendMessage('REQUEST_HAND', { roomCode, username });
        }, 1000);
      } else {
        alert(`Error: ${message}`);
      }

      setIsLoading(false);
    });

    return () => {
      console.log('🧹 Cleaning up UNO listeners');
      unsubHandUpdate?.();
      unsubCardPlayed?.();
      unsubCardDrawn?.();
      unsubGameOver?.();
      unsubError?.();
      listenersSetup.current = false;
    };
  }, [isConnected, on, roomCode, username, sendMessage]);

  const handlePlayCard = (cardIndex) => {
    if (iHaveFinished) {
      console.log('❌ Cannot play - player has finished');
      alert('You have already finished this game! Wait for others to complete.');
      return;
    }

    const card = myHand[cardIndex];

    if (!card) {
      console.error('❌ Invalid card index:', cardIndex);
      return;
    }

    const currentPlayer = gameState?.currentPlayer;

    if (currentPlayer !== username) {
      console.log('❌ Not your turn! Current player:', currentPlayer);
      alert(`It's not your turn! Waiting for ${currentPlayer}...`);
      return;
    }

    if (!canPlayCard(card)) {
      console.log('❌ Cannot play this card');
      alert("You can't play this card! It doesn't match color or value.");
      return;
    }

    console.log('🎴 Playing card:', card, 'at index:', cardIndex);

    // Check if it's a wild card
    if (card.color === 'wild') {
      setSelectedCard(cardIndex);
      setShowColorPicker(true);
      return;
    }

    console.log('📤 Sending PLAY_CARD to server');
    sendMessage('PLAY_CARD', {
      roomCode,
      username,
      cardIndex,
      chosenColor: null
    });
  };

  const handleColorChoice = (color) => {
    console.log('🎨 Color chosen:', color);
    console.log('📤 Sending PLAY_CARD (wild) to server');

    sendMessage('PLAY_CARD', {
      roomCode,
      username,
      cardIndex: selectedCard,
      chosenColor: color
    });

    setShowColorPicker(false);
    setSelectedCard(null);
  };

  const handleDrawCard = () => {
    if (iHaveFinished) {
      console.log('❌ Cannot draw - player has finished');
      alert('You have already finished this game! Wait for others to complete.');
      return;
    }

    const currentPlayer = gameState?.currentPlayer;

    if (currentPlayer !== username) {
      console.log('❌ Not your turn to draw!');
      alert(`It's not your turn! Waiting for ${currentPlayer}...`);
      return;
    }

    console.log('📥 Drawing card');
    console.log('📤 Sending DRAW_CARD to server');
    sendMessage('DRAW_CARD', {
      roomCode,
      username
    });
  };

  const handleRestartGame = () => {
    sendMessage('START_GAME', {
      roomCode,
      username,
      gameType: 'uno'
    });

    setShowGameOver(false);
    setGameOverData(null);
    setIsLoading(true);
    setMyHand([]);
    handRequestSent.current = false;
  };

  const canPlayCard = (card) => {
    if (!gameState?.currentCard && !gameState?.currentColor) {
      console.log('⚠️ No current card or color');
      return false;
    }

    const currentColor = gameState.currentColor;
    const currentCard = gameState.currentCard;

    // Wild cards can always be played
    if (card.color === 'wild') {
      return true;
    }

    // Match color
    if (card.color === currentColor) {
      return true;
    }

    // Match value
    if (card.value === currentCard?.value) {
      return true;
    }

    return false;
  };

  const getCardColor = (card) => {
    const colorMap = {
      red: '#ef4444',
      blue: '#3b82f6',
      green: '#10b981',
      yellow: '#eab308',
      wild: '#8b5cf6'
    };
    return colorMap[card?.color] || colorMap.wild;
  };

  const getCardDisplay = (card) => {
    if (!card) return '?';
    if (card.value === 'wild') return 'W';
    if (card.value === 'wild_draw4') return '+4';
    if (card.value === 'skip') return '⊘';
    if (card.value === 'reverse') return '⇄';
    if (card.value === 'draw2') return '+2';
    return card.value;
  };

  const getMedalEmoji = (position) => {
    switch (position) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '🏅';
    }
  };

  const isMyTurn = gameState?.currentPlayer === username && !iHaveFinished;

  const getPlayerCardCount = (playerName) => {
    if (playerName === username) {
      return myHand.length;
    }
    const player = gameState?.players?.find(p => p.name === playerName);
    return player?.cardCount || 0;
  };

  // Show loading state
  if (isLoading && myHand.length === 0) {
    return (
      <div className={`min-h-screen p-8 flex items-center justify-center ${colors.bg} transition-colors duration-300`}>
        <div className="text-center">
          <div
            className={`inline-block animate-spin rounded-full h-20 w-20 md:h-24 md:w-24 border-t-4 border-b-4 mb-6`}
            style={{ borderColor: colors.primary }}
          />
          <h2 className={`text-2xl md:text-3xl font-display font-bold mb-4 ${colors.text}`}>
            Loading UNO Game...
          </h2>
          <p className={`text-base md:text-lg font-body mb-2 ${colors.textSecondary}`}>
            Dealing cards to all players...
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
              <FaIdCard className="w-10 h-10 md:w-12 md:h-12" />
              UNO Game
            </h1>
          </div>
        </div>

        {/* Players */}
        <div className="mb-8">
          <h2 className={`text-lg md:text-xl font-display font-bold mb-4 flex items-center gap-2 ${colors.text}`}>
            <IoPeopleSharp className="w-5 h-5" />
            Players
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {gameState?.players?.map((player, index) => {
              const cardCount = getPlayerCardCount(player.name);
              const isCurrentPlayer = player.name === gameState.currentPlayer;
              const hasFinished = player.finished;

              return (
                <div
                  key={player.name || index}
                  className={`p-3 md:p-4 rounded-lg border-2 transition-all backdrop-blur-xl ${hasFinished
                      ? 'bg-green-500/10 border-green-500 opacity-70'
                      : isCurrentPlayer
                        ? `${colors.primaryBg}/20 ${colors.primaryBorder} shadow-lg`
                        : `${colors.surface} ${colors.border}`
                    }`}
                >
                  <p className={`font-accent font-bold text-sm md:text-base ${colors.text}`}>
                    {player.name} {player.name === username && '(You)'}
                  </p>
                  <p className={`text-xs md:text-sm ${colors.textSecondary}`}>
                    Cards: {cardCount}
                  </p>
                  {hasFinished && (
                    <p className="text-xs mt-1 font-bold text-green-500 flex items-center gap-1">
                      {getMedalEmoji(player.position)} Finished #{player.position}
                    </p>
                  )}
                  {isCurrentPlayer && !hasFinished && (
                    <p className={`text-xs mt-1 font-bold animate-pulse ${colors.primary}`}>
                      🔴 Current Turn
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Game Board */}
        {iHaveFinished ? (
          <div className="mb-8 text-center">
            <div
              className={`p-6 md:p-8 rounded-2xl border-2 inline-block backdrop-blur-xl ${colors.primaryBg}/20 ${colors.primaryBorder} shadow-2xl`}
            >
              <p className="text-5xl md:text-6xl mb-4">🏆</p>
              <h2 className={`text-2xl md:text-3xl font-display font-bold mb-2 ${colors.text}`}>
                You Finished!
              </h2>
              <p className={`text-lg md:text-xl font-body mb-4 ${colors.textSecondary}`}>
                Position: {getMedalEmoji(myPlayer?.position)} #{myPlayer?.position}
              </p>
              <p className={`text-sm font-body mt-4 ${colors.textSecondary}`}>
                Waiting for other players to finish...
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-col md:flex-row justify-center items-center gap-6 md:gap-8">
              {/* Draw Pile */}
              <div className="text-center">
                <div
                  className={`w-28 h-40 md:w-32 md:h-48 rounded-lg flex items-center justify-center border-4 transition-all ${isMyTurn ? `border-dashed cursor-pointer hover:scale-105 hover:shadow-2xl ${colors.primaryBorder} ${colors.primaryBg}/20` : `border-solid cursor-not-allowed ${colors.border} ${colors.bgSecondary}`
                    }`}
                  onClick={isMyTurn ? handleDrawCard : undefined}
                  title={isMyTurn ? "Click to draw a card" : "Wait for your turn"}
                >
                  <div>
                    <p className="text-5xl md:text-6xl mb-2">🎴</p>
                    <p className={`text-xs font-body font-bold ${colors.text}`}>
                      {gameState?.deck?.length || 0} cards
                    </p>
                  </div>
                </div>
                <p className={`mt-2 font-accent font-bold ${colors.text}`}>
                  Draw Pile
                </p>
              </div>

              {/* Current Card */}
              <div className="text-center">
                {gameState?.currentCard && (
                  <div
                    className="w-28 h-40 md:w-32 md:h-48 rounded-lg flex items-center justify-center text-5xl md:text-6xl font-black shadow-2xl"
                    style={{
                      background: getCardColor({ color: gameState.currentColor }),
                      color: '#fff',
                      boxShadow: `0 0 40px ${getCardColor({ color: gameState.currentColor })}60`,
                      border: '4px solid rgba(255,255,255,0.3)'
                    }}
                  >
                    {getCardDisplay(gameState.currentCard)}
                  </div>
                )}
                <p className={`mt-2 font-accent font-bold ${colors.text}`}>
                  Current Card
                </p>
                <p className={`text-sm font-body font-bold capitalize ${colors.primary}`}>
                  Color: {gameState?.currentColor || 'N/A'}
                </p>
              </div>
            </div>

            {/* Turn Indicator */}
            <div
              className={`mb-6 p-4 rounded-lg border text-center transition-all backdrop-blur-xl ${isMyTurn ? `${colors.primaryBg}/20 ${colors.primaryBorder} shadow-lg` : `${colors.surface} ${colors.border}`
                }`}
            >
              <p className={`text-xl md:text-2xl font-display font-bold ${colors.text}`}>
                {isMyTurn ? '🎯 It\'s your turn!' : `⏳ Waiting for ${gameState?.currentPlayer}...`}
              </p>
            </div>

            {/* Your Hand */}
            <div
              className={`p-4 md:p-6 rounded-2xl border backdrop-blur-xl ${colors.surface} ${colors.border}`}
            >
              <h2 className={`text-xl md:text-2xl font-display font-bold mb-4 ${colors.text}`}>
                Your Hand ({myHand.length} cards)
              </h2>

              {myHand.length === 0 ? (
                <div className="text-center py-12">
                  <div className={`inline-block animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-t-4 border-b-4 mb-4`} style={{ borderColor: colors.primary }} />
                  <p className={`text-lg md:text-xl font-body ${colors.textSecondary}`}>
                    Loading your cards...
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3 md:gap-4 justify-center">
                  {myHand.map((card, index) => {
                    const playable = isMyTurn && canPlayCard(card);
                    const cardColor = getCardColor(card);

                    return (
                      <div
                        key={card.id || `${card.color}-${card.value}-${index}`}
                        className={`w-20 h-32 md:w-24 md:h-36 rounded-lg flex items-center justify-center text-3xl md:text-4xl font-black transition-all ${playable
                            ? 'cursor-pointer hover:scale-125 hover:-translate-y-4 shadow-2xl'
                            : isMyTurn
                              ? 'cursor-not-allowed opacity-60'
                              : 'opacity-80'
                          }`}
                        style={{
                          background: cardColor,
                          color: '#fff',
                          boxShadow: playable
                            ? `0 0 40px ${cardColor}90, 0 10px 30px rgba(0,0,0,0.5)`
                            : `0 4px 10px rgba(0,0,0,0.3)`,
                          border: playable
                            ? `4px solid ${colors.glow}`
                            : '3px solid rgba(255,255,255,0.2)',
                          transform: playable ? 'scale(1)' : 'scale(0.95)',
                          filter: (!isMyTurn || playable) ? 'none' : 'grayscale(0.3) brightness(0.8)'
                        }}
                        onClick={() => playable && handlePlayCard(index)}
                        title={
                          !isMyTurn
                            ? `Wait for your turn (${gameState?.currentPlayer}'s turn)`
                            : playable
                              ? 'Click to play'
                              : 'Cannot play - no match'
                        }
                      >
                        {getCardDisplay(card)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Color Picker Modal */}
        {showColorPicker && (
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowColorPicker(false)}
          >
            <div
              className={`p-6 md:p-8 rounded-2xl border backdrop-blur-xl ${colors.surface} ${colors.primaryBorder} shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={`text-xl md:text-2xl font-display font-bold mb-6 text-center ${colors.text}`}>
                Choose a Color
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {['red', 'blue', 'green', 'yellow'].map((color) => (
                  <button
                    key={color}
                    className="w-28 h-28 md:w-32 md:h-32 rounded-xl font-accent font-bold text-white text-lg md:text-xl hover:scale-110 transition-transform capitalize"
                    style={{
                      background: {
                        red: '#ef4444',
                        blue: '#3b82f6',
                        green: '#10b981',
                        yellow: '#eab308'
                      }[color],
                      boxShadow: `0 0 40px ${{
                          red: '#ef4444',
                          blue: '#3b82f6',
                          green: '#10b981',
                          yellow: '#eab308'
                        }[color]
                        }60`
                    }}
                    onClick={() => handleColorChoice(color)}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Game Over Modal */}
        {showGameOver && gameOverData && (
          <div
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <div
              className={`p-6 md:p-8 rounded-2xl border max-w-2xl w-full backdrop-blur-xl ${colors.surface} ${colors.primaryBorder} shadow-2xl`}
            >
              <div className="text-center mb-8">
                <h2
                  className={`text-4xl md:text-5xl font-display font-black mb-2 ${colors.primary}`}
                >
                  🎉 Game Over! 🎉
                </h2>
                <p className={`text-base md:text-lg font-body ${colors.textSecondary}`}>
                  Final Rankings
                </p>
              </div>

              <div className="space-y-3 mb-8">
                {gameOverData.rankings?.map((player, index) => (
                  <div
                    key={player.name}
                    className={`p-4 rounded-lg border-2 transition-all backdrop-blur-xl ${index === 0
                        ? `${colors.primaryBg}/20 ${colors.primaryBorder}`
                        : player.name === username
                          ? `${colors.secondaryBg}/20 ${colors.secondaryBorder}`
                          : `${colors.surface} ${colors.border}`
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-3xl md:text-4xl">{getMedalEmoji(player.position)}</span>
                        <div>
                          <p className={`text-lg md:text-xl font-display font-bold ${colors.text}`}>
                            #{player.position} - {player.name} {player.name === username && '(You)'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl md:text-3xl font-black ${colors.primary}`}>
                          {player.points}
                        </p>
                        <p className={`text-xs font-body ${colors.textSecondary}`}>
                          points
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <button
                  onClick={handleRestartGame}
                  className={`flex-1 px-6 md:px-8 py-3 md:py-4 rounded-xl font-accent font-bold text-base md:text-lg transition-all hover:scale-105 flex items-center justify-center gap-2 ${colors.primaryBg} ${colors.primaryHover} text-white shadow-xl`}
                >
                  <IoRefreshSharp className="w-5 h-5" />
                  Play Again
                </button>
                <button
                  onClick={() => {
                    setShowGameOver(false);
                    onLeaveRoom();
                  }}
                  className="flex-1 px-6 md:px-8 py-3 md:py-4 rounded-xl font-accent font-bold text-base md:text-lg transition-all hover:scale-105 border border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                >
                  🚪 Return to Lobby
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
