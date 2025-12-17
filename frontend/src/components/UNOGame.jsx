import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';

export default function UNOGame({ roomCode, username, players, initialGameState, onLeaveRoom }) {
  const { colors } = useTheme();
  const [gameState, setGameState] = useState(initialGameState);
  const [myHand, setMyHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [gameOverData, setGameOverData] = useState(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const { sendMessage, on, isConnected } = useWebSocket();
  const listenersSetup = useRef(false);

  // Check if current user has finished
  const myPlayer = gameState?.players?.find(p => p.name === username);
  const iHaveFinished = myPlayer?.finished || false;

  console.log('🎮 UNOGame render:', {
    username,
    currentPlayer: gameState?.currentPlayer,
    isMyTurn: gameState?.currentPlayer === username,
    myHandSize: myHand.length,
    iHaveFinished,
    gameStateTimestamp: Date.now()
  });

  // Request hand when component mounts or game starts
  useEffect(() => {
    if (isConnected && roomCode && username) {
      console.log('🤚 Initial hand request for', username);
      setIsLoading(true);
      sendMessage('REQUEST_HAND', { roomCode, username });
      
      const retryTimer = setTimeout(() => {
        if (isLoading) {
          console.log('🔄 Retrying hand request...');
          sendMessage('REQUEST_HAND', { roomCode, username });
        }
      }, 1000);

      return () => clearTimeout(retryTimer);
    }
  }, [isConnected, roomCode, username]);

  // Watch for game over condition
  useEffect(() => {
    if (!gameState?.players) return;
    
    const activePlayers = gameState.players.filter(p => !p.finished);
    const finishedCount = gameState.players.filter(p => p.finished).length;
    
    console.log('🔍 Game state check:', {
      totalPlayers: gameState.players.length,
      finishedCount,
      activePlayers: activePlayers.length,
      shouldGameBeOver: activePlayers.length <= 1
    });
    
    // If game should be over but modal not showing, trigger it
    if (activePlayers.length <= 1 && finishedCount >= gameState.players.length - 1 && !showGameOver) {
      console.log('🚨 Forcing game over modal to show!');
      
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
      
      console.log(`✅ Updating hand: ${hand.length} cards for ${username}`);
      setMyHand(hand);
      
      // IMPORTANT: Also update game state if provided
      if (newGameState) {
        console.log('📊 Updating game state from HAND_UPDATE:', {
          currentPlayer: newGameState.currentPlayer,
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
      
      console.log('📊 Updating game state:', {
        currentPlayer: newGameState.currentPlayer,
        currentCard: newGameState.currentCard,
        currentColor: newGameState.currentColor,
        isMyTurnNow: newGameState.currentPlayer === username
      });
      
      // Update game state FIRST
      setGameState(newGameState);
      
      // Then request updated hand
      setTimeout(() => {
        console.log('🔄 Requesting hand update after card played');
        sendMessage('REQUEST_HAND', { roomCode, username });
      }, 200);
    });

    const unsubCardDrawn = on('CARD_DRAWN', (data) => {
      console.log('🎴 CARD_DRAWN received:', data);
      const newGameState = data.payload?.gameState || data.gameState;
      
      console.log('📊 Updating game state after draw:', {
        currentPlayer: newGameState.currentPlayer,
        currentCard: newGameState.currentCard,
        currentColor: newGameState.currentColor,
        isMyTurnNow: newGameState.currentPlayer === username
      });
      
      // Update game state FIRST
      setGameState(newGameState);
      
      // Then request updated hand
      setTimeout(() => {
        console.log('🔄 Requesting hand update after card drawn');
        sendMessage('REQUEST_HAND', { roomCode, username });
      }, 200);
    });

    const unsubAutoDrawn = on('AUTO_DRAWN', (data) => {
      console.log('🎴 AUTO_DRAWN received:', data);
      const { playerName, cardsDrawn, gameState: newGameState } = data.payload;
      
      // Show notification
      setTimeout(() => {
        if (playerName === username) {
          alert(`You had no stackable cards and automatically drew ${cardsDrawn} cards! 📥`);
        } else {
          alert(`${playerName} had no stackable cards and automatically drew ${cardsDrawn} cards! 📥`);
        }
      }, 300);
      
      // Update game state
      setGameState(newGameState);
      
      // Request updated hand
      setTimeout(() => {
        console.log('🔄 Requesting hand update after auto-draw');
        sendMessage('REQUEST_HAND', { roomCode, username });
      }, 500);
    });

    const unsubPlayerFinished = on('PLAYER_FINISHED', (data) => {
      console.log('🎯 PLAYER_FINISHED received:', data);
      const { playerName, position, points, remainingPlayers } = data.payload;
      
      // Show notification
      setTimeout(() => {
        alert(`${playerName} finished in position #${position} and earned ${points} points! 🎉\n${remainingPlayers} players remaining.`);
      }, 500);
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
      alert(`Error: ${message}`);
    });

    return () => {
      console.log('🧹 Cleaning up UNO listeners');
      unsubHandUpdate?.();
      unsubCardPlayed?.();
      unsubCardDrawn?.();
      unsubAutoDrawn?.();
      unsubPlayerFinished?.();
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

    // Check if it's the player's turn
    const currentPlayer = gameState?.currentPlayer;
    console.log('🎯 Checking turn:', { 
      currentPlayer, 
      username, 
      isMyTurn: currentPlayer === username,
      iHaveFinished,
      myPlayerState: myPlayer
    });
    
    if (currentPlayer !== username) {
      console.log('❌ Not your turn! Current player:', currentPlayer);
      alert(`It's not your turn! Waiting for ${currentPlayer}...`);
      return;
    }

    // Check if card can be played
    if (!canPlayCard(card)) {
      console.log('❌ Cannot play this card');
      
      if (gameState?.drawCount > 0) {
        alert(`Cannot play this card! You must draw ${gameState.drawCount} cards or stack a valid draw card.`);
      } else {
        alert("You can't play this card! It doesn't match color or number.");
      }
      return;
    }

    console.log('🎴 Playing card:', card, 'at index:', cardIndex);

    // Check if it's a wild card
    if (card.type === 'wild' || card.type === 'wild_draw_four') {
      setSelectedCard(cardIndex);
      setShowColorPicker(true);
      return;
    }

    // Play regular card
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

    // Check if it's the player's turn
    const currentPlayer = gameState?.currentPlayer;
    console.log('🎯 Checking turn for draw:', { 
      currentPlayer, 
      username, 
      iHaveFinished,
      myPlayerState: myPlayer 
    });
    
    if (currentPlayer !== username) {
      console.log('❌ Not your turn to draw!');
      alert(`It's not your turn! Waiting for ${currentPlayer}...`);
      return;
    }

    console.log('🎴 Drawing card');
    console.log('📤 Sending DRAW_CARD to server');
    sendMessage('DRAW_CARD', {
      roomCode,
      username
    });
  };

  const handleRestartGame = () => {
    // Send restart request to server
    sendMessage('START_GAME', {
      roomCode,
      username
    });
    
    setShowGameOver(false);
    setGameOverData(null);
  };

  const canPlayCard = (card) => {
    if (!gameState?.currentCard || !gameState?.currentColor) {
      console.log('⚠️ No current card or color');
      return false;
    }
    
    const current = gameState.currentCard;
    const currentColor = gameState.currentColor;
    
    console.log('🔍 Checking playability:', { 
      card, 
      currentCard: current, 
      currentColor,
      drawCount: gameState.drawCount
    });
    
    // If draw count is pending, ONLY stackable cards can be played
    if (gameState.drawCount > 0) {
      console.log('⚠️ Draw penalty active - checking stacking rules');
      
      // Can ONLY stack +4 on +4
      if (current.type === 'wild_draw_four') {
        if (card.type === 'wild_draw_four') {
          console.log('✅ Can stack +4 on +4');
          return true;
        }
        console.log('❌ Cannot stack - only +4 can be stacked on +4');
        return false;
      }
      
      // Can stack +4 OR +2 on +2
      if (current.type === 'draw_two') {
        if (card.type === 'wild_draw_four') {
          console.log('✅ Can stack +4 on +2');
          return true;
        }
        if (card.type === 'draw_two') {
          console.log('✅ Can stack +2 on +2');
          return true;
        }
        console.log('❌ Cannot stack - only +4 or +2 can be stacked on +2');
        return false;
      }
      
      console.log('❌ Draw penalty active - no valid stack');
      return false;
    }
    
    // Wild cards can always be played (when no draw penalty)
    if (card.type === 'wild' || card.type === 'wild_draw_four') {
      console.log('✅ Wild card - can play');
      return true;
    }

    // Match color with current color
    if (card.color === currentColor) {
      console.log('✅ Color match - can play');
      return true;
    }

    // Match type for action cards
    if (card.type === current.type && card.type !== 'number') {
      console.log('✅ Action type match - can play');
      return true;
    }

    // Match value for number cards
    if (card.type === 'number' && current.type === 'number' && card.value === current.value) {
      console.log('✅ Number match - can play');
      return true;
    }

    console.log('❌ No match - cannot play');
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
    return colorMap[card.color] || colorMap.wild;
  };

  const getCardDisplay = (card) => {
    if (card.type === 'wild') return 'W';
    if (card.type === 'wild_draw_four') return '+4';
    if (card.type === 'skip') return '⊘';
    if (card.type === 'reverse') return '⇄';
    if (card.type === 'draw_two') return '+2';
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

  // Count cards for each player
  const getPlayerCardCount = (playerName) => {
    if (playerName === username) {
      return myHand.length;
    }
    const player = gameState?.players?.find(p => p.name === playerName);
    return player?.cardCount || player?.hand?.length || 0;
  };

  console.log('🎯 Render check:', { 
    isMyTurn, 
    currentPlayer: gameState?.currentPlayer, 
    username,
    iHaveFinished
  });

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
            UNO Game
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
            {iHaveFinished && '🏁 FINISHED'}
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
                  {player.score > 0 && (
                    <p className="text-xs mt-1" style={{ color: colors.secondary }}>
                      Score: {player.score}
                    </p>
                  )}
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

        {/* Game Board - Show different UI for finished players */}
        {iHaveFinished ? (
          // Finished Player View
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
                Position: {getMedalEmoji(myPlayer.position)} #{myPlayer.position}
              </p>
              <p className="text-lg font-poppins" style={{ color: colors.primary }}>
                Score: {myPlayer.score} points
              </p>
              <p className="text-sm font-poppins mt-4" style={{ color: colors.textSecondary }}>
                Waiting for other players to finish...
              </p>
            </div>
          </div>
        ) : (
          // Active Player View
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
                      background: gameState.currentColor 
                        ? getCardColor({ color: gameState.currentColor })
                        : getCardColor(gameState.currentCard),
                      color: '#fff',
                      boxShadow: `0 0 40px ${
                        gameState.currentColor 
                          ? getCardColor({ color: gameState.currentColor })
                          : getCardColor(gameState.currentCard)
                      }60`,
                      border: '4px solid rgba(255,255,255,0.3)'
                    }}
                  >
                    {getCardDisplay(gameState.currentCard)}
                  </div>
                )}
                <p className="mt-2 font-raleway font-bold" style={{ color: colors.text }}>
                  Current Card
                </p>
                <p className="text-sm font-poppins font-bold" style={{ color: colors.primary }}>
                  Color: <span className="capitalize">{gameState?.currentColor || 'N/A'}</span>
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
              {gameState?.drawCount > 0 && (
                <p className="text-lg font-raleway mt-2 animate-pulse" style={{ color: '#ef4444' }}>
                  ⚠️ Draw Penalty Active: +{gameState.drawCount} cards! 
                  {isMyTurn && ' (Stack a draw card or draw all cards)'}
                </p>
              )}
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

              {isLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4" style={{ borderColor: colors.primary }}></div>
                  <p className="mt-4 font-poppins" style={{ color: colors.textSecondary }}>
                    Loading your cards...
                  </p>
                </div>
              ) : myHand.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-xl font-poppins" style={{ color: colors.textSecondary }}>
                    No cards in hand
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-4 justify-center">
                  {myHand.map((card, index) => {
                    const playable = isMyTurn && canPlayCard(card);
                    const cardColor = getCardColor(card);
                    
                    return (
                      <div
                        key={`${card.color}-${card.type}-${card.value}-${index}`}
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
                borderColor: colors.primary
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
              onClick={(e) => e.stopPropagation()}
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
                          <p className="text-sm font-poppins" style={{ color: colors.textSecondary }}>
                            {player.position === 1 ? 'Winner!' : `Position ${player.position}`}
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
