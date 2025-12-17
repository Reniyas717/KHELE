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
  const { sendMessage, on, isConnected } = useWebSocket();
  const listenersSetup = useRef(false);

  console.log('🎮 UNOGame render:', {
    username,
    currentPlayer: gameState?.currentPlayer,
    isMyTurn: gameState?.currentPlayer === username,
    myHandSize: myHand.length,
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

    const unsubGameOver = on('GAME_OVER', (data) => {
      console.log('🏆 GAME_OVER received:', data);
      const winner = data.payload?.winner || data.winner;
      setTimeout(() => {
        alert(`🎉 Game Over! ${winner} wins! 🎉`);
      }, 500);
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
      unsubGameOver?.();
      unsubError?.();
      listenersSetup.current = false;
    };
  }, [isConnected, on, roomCode, username, sendMessage]);

  const handlePlayCard = (cardIndex) => {
    const card = myHand[cardIndex];
    
    if (!card) {
      console.error('❌ Invalid card index:', cardIndex);
      return;
    }

    // Check if it's the player's turn
    const currentPlayer = gameState?.currentPlayer;
    console.log('🎯 Checking turn:', { currentPlayer, username, isMyTurn: currentPlayer === username });
    
    if (currentPlayer !== username) {
      console.log('❌ Not your turn! Current player:', currentPlayer);
      alert(`It's not your turn! Waiting for ${currentPlayer}...`);
      return;
    }

    // Check if card can be played
    if (!canPlayCard(card)) {
      console.log('❌ Cannot play this card');
      alert("You can't play this card! It doesn't match color or number.");
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
    // Check if it's the player's turn
    const currentPlayer = gameState?.currentPlayer;
    console.log('🎯 Checking turn for draw:', { currentPlayer, username });
    
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
      currentColor 
    });
    
    // Wild cards can always be played
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

  const isMyTurn = gameState?.currentPlayer === username;

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
    username 
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
            ⚡ Your Turn: {isMyTurn ? 'YES' : 'NO'}
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
              
              return (
                <div
                  key={player.name || index}
                  className="p-4 rounded-lg border-2 transition-all"
                  style={{
                    background: isCurrentPlayer
                      ? `${colors.primary}20`
                      : 'rgba(0, 0, 0, 0.3)',
                    borderColor: isCurrentPlayer
                      ? colors.primary
                      : `${colors.primary}30`,
                    boxShadow: isCurrentPlayer ? `0 0 20px ${colors.primary}40` : 'none'
                  }}
                >
                  <p className="font-raleway font-bold" style={{ color: colors.text }}>
                    {player.name} {player.name === username && '(You)'}
                  </p>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    Cards: {cardCount}
                  </p>
                  {isCurrentPlayer && (
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
      </div>
    </div>
  );
}
