import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';

export default function UNOGame({ roomCode, username, players, initialGameState, onLeaveRoom }) {
  const { colors } = useTheme();
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
    switch(position) {
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

  // Show loading state with debugging info
  if (isLoading && myHand.length === 0) {
    return (
      <div 
        className="min-h-screen p-8 flex items-center justify-center"
        style={{ backgroundColor: colors.background }}
      >
        <div className="text-center">
          <div 
            className="inline-block animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 mb-6"
            style={{ borderColor: colors.primary }}
          ></div>
          <h2 className="text-3xl font-orbitron font-bold mb-4" style={{ color: colors.text }}>
            Loading UNO Game...
          </h2>
          <p className="text-lg font-poppins mb-2" style={{ color: colors.textSecondary }}>
            Dealing cards to all players...
          </p>
          <div className="mt-8 p-4 rounded-lg bg-gray-800 text-left text-xs font-mono" style={{ color: colors.textSecondary }}>
            <p>Debug Info:</p>
            <p>• Username: {username}</p>
            <p>• Room: {roomCode}</p>
            <p>• Connected: {isConnected ? 'Yes' : 'No'}</p>
            <p>• Hand Requested: {handRequestSent.current ? 'Yes' : 'No'}</p>
            <p>• Cards in Hand: {myHand.length}</p>
            <p>• Game State: {gameState ? 'Present' : 'Null'}</p>
          </div>
        </div>
      </div>
    );
  }

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
            🎴 UNO Game
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

        {/* Debug Info */}
        <div className="mb-4 p-3 rounded bg-gray-800 text-xs font-mono">
          <p style={{ color: colors.primary }}>
            👤 You: {username} | 🎯 Current Turn: {gameState?.currentPlayer} | 
            ⚡ Your Turn: {isMyTurn ? 'YES' : 'NO'} | 
            🃏 Cards: {myHand.length}
            {iHaveFinished && ' | 🏁 FINISHED'}
          </p>
        </div>

        {/* Players */}
        <div className="mb-8">
          <h2 className="text-xl font-orbitron font-bold mb-4" style={{ color: colors.text }}>
            Players
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {gameState?.players?.map((player, index) => {
              const cardCount = getPlayerCardCount(player.name);
              const isCurrentPlayer = player.name === gameState.currentPlayer;
              const hasFinished = player.finished;
              
              return (
                <div
                  key={player.name || index}
                  className="p-4 rounded-lg border-2 transition-all"
                  style={{
                    background: hasFinished
                      ? 'rgba(16, 185, 129, 0.1)'
                      : isCurrentPlayer
                      ? `${colors.primary}20`
                      : 'rgba(0, 0, 0, 0.3)',
                    borderColor: hasFinished
                      ? '#10b981'
                      : isCurrentPlayer
                      ? colors.primary
                      : `${colors.primary}30`,
                    boxShadow: isCurrentPlayer ? `0 0 20px ${colors.primary}40` : 'none',
                    opacity: hasFinished ? 0.7 : 1
                  }}
                >
                  <p className="font-raleway font-bold" style={{ color: colors.text }}>
                    {player.name} {player.name === username && '(You)'}
                  </p>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    Cards: {cardCount}
                  </p>
                  {hasFinished && (
                    <p className="text-xs mt-1 font-bold" style={{ color: '#10b981' }}>
                      {getMedalEmoji(player.position)} Finished #{player.position}
                    </p>
                  )}
                  {isCurrentPlayer && !hasFinished && (
                    <p className="text-xs mt-1 font-bold animate-pulse" style={{ color: colors.primary }}>
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
              className="p-8 rounded-2xl border-2 inline-block"
              style={{
                background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}10)`,
                borderColor: colors.primary,
                boxShadow: `0 0 40px ${colors.primary}30`
              }}
            >
              <p className="text-6xl mb-4">🏆</p>
              <h2 className="text-3xl font-orbitron font-bold mb-2" style={{ color: colors.text }}>
                You Finished!
              </h2>
              <p className="text-xl font-raleway mb-4" style={{ color: colors.textSecondary }}>
                Position: {getMedalEmoji(myPlayer?.position)} #{myPlayer?.position}
              </p>
              <p className="text-sm font-poppins mt-4" style={{ color: colors.textSecondary }}>
                Waiting for other players to finish...
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 flex justify-center items-center gap-8">
              {/* Draw Pile */}
              <div className="text-center">
                <div
                  className={`w-32 h-48 rounded-lg flex items-center justify-center border-4 ${
                    isMyTurn ? 'border-dashed cursor-pointer hover:scale-105 hover:shadow-2xl' : 'border-solid cursor-not-allowed'
                  } transition-all`}
                  style={{
                    borderColor: isMyTurn ? `${colors.primary}` : `${colors.primary}40`,
                    background: isMyTurn ? `${colors.primary}20` : `${colors.primary}10`,
                    boxShadow: isMyTurn ? `0 0 30px ${colors.primary}30` : 'none'
                  }}
                  onClick={isMyTurn ? handleDrawCard : undefined}
                  title={isMyTurn ? "Click to draw a card" : "Wait for your turn"}
                >
                  <div>
                    <p className="text-6xl mb-2">🎴</p>
                    <p className="text-xs font-poppins font-bold" style={{ color: colors.text }}>
                      {gameState?.deck?.length || 0} cards
                    </p>
                  </div>
                </div>
                <p className="mt-2 font-raleway font-bold" style={{ color: colors.text }}>
                  Draw Pile
                </p>
              </div>

              {/* Current Card */}
              <div className="text-center">
                {gameState?.currentCard && (
                  <div
                    className="w-32 h-48 rounded-lg flex items-center justify-center text-6xl font-black shadow-2xl"
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
                <p className="mt-2 font-raleway font-bold" style={{ color: colors.text }}>
                  Current Card
                </p>
                <p className="text-sm font-poppins font-bold capitalize" style={{ color: colors.primary }}>
                  Color: {gameState?.currentColor || 'N/A'}
                </p>
              </div>
            </div>

            {/* Turn Indicator */}
            <div 
              className="mb-6 p-4 rounded-lg border text-center transition-all"
              style={{
                background: isMyTurn ? `${colors.primary}20` : `${colors.secondary}10`,
                borderColor: isMyTurn ? colors.primary : `${colors.secondary}40`,
                boxShadow: isMyTurn ? `0 0 20px ${colors.primary}30` : 'none'
              }}
            >
              <p className="text-2xl font-orbitron font-bold" style={{ color: colors.text }}>
                {isMyTurn ? '🎯 It\'s your turn!' : `⏳ Waiting for ${gameState?.currentPlayer}...`}
              </p>
            </div>

            {/* Your Hand */}
            <div 
              className="p-6 rounded-2xl border"
              style={{
                background: colors.surface,
                borderColor: `${colors.primary}30`
              }}
            >
              <h2 className="text-2xl font-orbitron font-bold mb-4" style={{ color: colors.text }}>
                Your Hand ({myHand.length} cards)
              </h2>

              {myHand.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 mb-4" style={{ borderColor: colors.primary }}></div>
                  <p className="text-xl font-poppins" style={{ color: colors.textSecondary }}>
                    Loading your cards...
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-4 justify-center">
                  {myHand.map((card, index) => {
                    const playable = isMyTurn && canPlayCard(card);
                    const cardColor = getCardColor(card);
                    
                    return (
                      <div
                        key={card.id || `${card.color}-${card.value}-${index}`}
                        className={`w-24 h-36 rounded-lg flex items-center justify-center text-4xl font-black transition-all ${
                          playable 
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
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
            onClick={() => setShowColorPicker(false)}
          >
            <div 
              className="p-8 rounded-2xl border"
              style={{
                background: colors.surface,
                borderColor: colors.primary,
                boxShadow: `0 0 60px ${colors.primary}60`
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-orbitron font-bold mb-6 text-center" style={{ color: colors.text }}>
                Choose a Color
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {['red', 'blue', 'green', 'yellow'].map((color) => (
                  <button
                    key={color}
                    className="w-32 h-32 rounded-xl font-raleway font-bold text-white text-xl hover:scale-110 transition-transform capitalize"
                    style={{
                      background: {
                        red: '#ef4444',
                        blue: '#3b82f6',
                        green: '#10b981',
                        yellow: '#eab308'
                      }[color],
                      boxShadow: `0 0 40px ${
                        {
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
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          >
            <div 
              className="p-8 rounded-2xl border max-w-2xl w-full mx-4"
              style={{
                background: colors.surface,
                borderColor: colors.primary,
                boxShadow: `0 0 60px ${colors.primary}60`
              }}
            >
              <div className="text-center mb-8">
                <h2 
                  className="text-5xl font-orbitron font-black mb-2"
                  style={{
                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  🎉 Game Over! 🎉
                </h2>
                <p className="text-lg font-raleway" style={{ color: colors.textSecondary }}>
                  Final Rankings
                </p>
              </div>

              <div className="space-y-3 mb-8">
                {gameOverData.rankings?.map((player, index) => (
                  <div
                    key={player.name}
                    className="p-4 rounded-lg border-2 transition-all"
                    style={{
                      background: index === 0 
                        ? `linear-gradient(135deg, ${colors.primary}30, ${colors.secondary}20)`
                        : player.name === username
                        ? `${colors.secondary}20`
                        : 'rgba(0, 0, 0, 0.3)',
                      borderColor: index === 0 
                        ? colors.primary
                        : player.name === username
                        ? colors.secondary
                        : `${colors.primary}30`
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-4xl">{getMedalEmoji(player.position)}</span>
                        <div>
                          <p className="text-xl font-orbitron font-bold" style={{ color: colors.text }}>
                            #{player.position} - {player.name} {player.name === username && '(You)'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black" style={{ color: colors.primary }}>
                          {player.points}
                        </p>
                        <p className="text-xs font-poppins" style={{ color: colors.textSecondary }}>
                          points
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleRestartGame}
                  className="flex-1 px-8 py-4 rounded-lg font-raleway font-bold text-lg transition-all hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                    color: '#fff',
                    boxShadow: `0 0 30px ${colors.primary}60`
                  }}
                >
                  🔄 Play Again
                </button>
                <button
                  onClick={() => {
                    setShowGameOver(false);
                    onLeaveRoom();
                  }}
                  className="flex-1 px-8 py-4 rounded-lg font-raleway font-bold text-lg transition-all hover:scale-105 border"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(239, 68, 68, 0.5)',
                    color: '#ef4444'
                  }}
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
