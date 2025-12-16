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

  console.log('🎮 UNOGame state:', {
    username,
    currentPlayer: gameState?.currentPlayer,
    isMyTurn: gameState?.currentPlayer === username,
    myHandSize: myHand.length,
    isLoading,
    gameState
  });

  // Request hand when component mounts or game starts
  useEffect(() => {
    if (isConnected && roomCode && username) {
      console.log('🤚 Requesting hand for', username);
      setIsLoading(true);
      sendMessage('REQUEST_HAND', { roomCode, username });
      
      // Retry after 1 second if still loading
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
      console.log(`✅ Setting hand with ${hand.length} cards`);
      setMyHand(hand);
      setIsLoading(false);
    });

    const unsubCardPlayed = on('CARD_PLAYED', (data) => {
      console.log('🎴 CARD_PLAYED received:', data);
      const newGameState = data.payload?.gameState || data.gameState;
      setGameState(newGameState);
      
      // Request updated hand after card played
      setTimeout(() => {
        console.log('🔄 Requesting updated hand after card played');
        sendMessage('REQUEST_HAND', { roomCode, username });
      }, 100);
    });

    const unsubCardDrawn = on('CARD_DRAWN', (data) => {
      console.log('🎴 CARD_DRAWN received:', data);
      const newGameState = data.payload?.gameState || data.gameState;
      setGameState(newGameState);
      
      // Request updated hand after card drawn
      setTimeout(() => {
        console.log('🔄 Requesting updated hand after card drawn');
        sendMessage('REQUEST_HAND', { roomCode, username });
      }, 100);
    });

    const unsubGameOver = on('GAME_OVER', (data) => {
      console.log('🏆 GAME_OVER received:', data);
      const winner = data.payload?.winner || data.winner;
      alert(`Game Over! ${winner} wins!`);
    });

    return () => {
      console.log('🧹 Cleaning up UNO listeners');
      unsubHandUpdate?.();
      unsubCardPlayed?.();
      unsubCardDrawn?.();
      unsubGameOver?.();
      listenersSetup.current = false;
    };
  }, [isConnected, on, roomCode, username]);

  const handlePlayCard = (cardIndex) => {
    const card = myHand[cardIndex];
    
    if (!card) {
      console.error('❌ Invalid card index:', cardIndex);
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
    sendMessage('PLAY_CARD', {
      roomCode,
      username,
      cardIndex,
      chosenColor: null
    });
  };

  const handleColorChoice = (color) => {
    console.log('🎨 Color chosen:', color);
    
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
    console.log('🎴 Drawing card');
    sendMessage('DRAW_CARD', {
      roomCode,
      username
    });
  };

  const canPlayCard = (card) => {
    if (!gameState?.currentCard) return false;
    
    const current = gameState.currentCard;
    
    // Wild cards can always be played
    if (card.type === 'wild' || card.type === 'wild_draw_four') {
      return true;
    }

    // Match color
    if (card.color === gameState.currentColor) {
      return true;
    }

    // Match type
    if (card.type === current.type) {
      return true;
    }

    // Match value for number cards
    if (card.value !== undefined && card.value === current.value) {
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

        {/* Players */}
        <div className="mb-8">
          <h2 className="text-xl font-orbitron font-bold mb-4" style={{ color: colors.text }}>
            Players
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {gameState?.players?.map((player, index) => (
              <div
                key={player.name || index}
                className="p-4 rounded-lg border-2"
                style={{
                  background: player.name === gameState.currentPlayer
                    ? `${colors.primary}20`
                    : 'rgba(0, 0, 0, 0.3)',
                  borderColor: player.name === gameState.currentPlayer
                    ? colors.primary
                    : `${colors.primary}30`
                }}
              >
                <p className="font-raleway font-bold" style={{ color: colors.text }}>
                  {player.name} {player.name === username && '(You)'}
                </p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  Score: {player.score || 0}
                </p>
                {player.name === gameState.currentPlayer && (
                  <p className="text-xs mt-1" style={{ color: colors.primary }}>
                    🔴 Current Turn
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Game Board */}
        <div className="mb-8 flex justify-center items-center gap-8">
          {/* Draw Pile */}
          <div className="text-center">
            <div
              className="w-32 h-48 rounded-lg flex items-center justify-center border-4 border-dashed cursor-pointer hover:scale-105 transition-transform"
              style={{
                borderColor: `${colors.primary}60`,
                background: `${colors.primary}10`
              }}
              onClick={isMyTurn ? handleDrawCard : undefined}
            >
              <div>
                <p className="text-6xl mb-2">🎴</p>
                <p className="text-xs font-poppins" style={{ color: colors.textSecondary }}>
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
                  background: getCardColor(gameState.currentCard),
                  color: '#fff',
                  boxShadow: `0 0 40px ${getCardColor(gameState.currentCard)}60`
                }}
              >
                {getCardDisplay(gameState.currentCard)}
              </div>
            )}
            <p className="mt-2 font-raleway font-bold" style={{ color: colors.text }}>
              Current Card
            </p>
            <p className="text-sm font-poppins" style={{ color: colors.textSecondary }}>
              Color: <span className="capitalize">{gameState?.currentColor || 'N/A'}</span>
            </p>
          </div>
        </div>

        {/* Turn Indicator */}
        <div 
          className="mb-6 p-4 rounded-lg border text-center"
          style={{
            background: isMyTurn ? `${colors.primary}20` : `${colors.secondary}10`,
            borderColor: isMyTurn ? colors.primary : `${colors.secondary}40`
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
              <p className="text-sm mt-2 font-poppins" style={{ color: colors.textSecondary }}>
                This should only take a moment
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
                return (
                  <div
                    key={index}
                    className={`w-24 h-36 rounded-lg flex items-center justify-center text-4xl font-black cursor-pointer transition-all ${
                      playable ? 'hover:scale-110 hover:-translate-y-2' : 'opacity-50 cursor-not-allowed'
                    }`}
                    style={{
                      background: getCardColor(card),
                      color: '#fff',
                      boxShadow: playable ? `0 0 20px ${getCardColor(card)}60` : 'none',
                      border: playable ? `3px solid ${colors.glow}` : '3px solid transparent'
                    }}
                    onClick={() => playable && handlePlayCard(index)}
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
