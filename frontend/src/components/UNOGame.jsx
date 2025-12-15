import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';

export default function UNOGame({ roomCode, username, players, initialGameState, onLeaveRoom }) {
  const { colors } = useTheme();
  const [gameState, setGameState] = useState(null);
  const [myHand, setMyHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const { sendMessage, on, isConnected } = useWebSocket();
  const setupComplete = useRef(false);
  const handRequestTimer = useRef(null);

  // Initialize game state and extract hand immediately
  useEffect(() => {
    if (initialGameState) {
      console.log('\n🃏 ========== UNO GAME INITIALIZED ==========');
      console.log('📦 Initial game state received');
      console.log('👤 My username:', username);
      
      setGameState(initialGameState);
      
      // Extract MY hand from the game state
      if (initialGameState.players && Array.isArray(initialGameState.players)) {
        console.log('👥 All players in game state:', initialGameState.players.map(p => p.name));
        
        const myPlayer = initialGameState.players.find(p => p.name === username);
        if (myPlayer) {
          console.log(`✅ Found myself in players list: ${myPlayer.name}`);
          if (myPlayer.hand && Array.isArray(myPlayer.hand) && myPlayer.hand.length > 0) {
            console.log(`🎴 Found my hand: ${myPlayer.hand.length} cards`);
            console.log('🃏 Sample cards:', myPlayer.hand.slice(0, 3).map(c => `${c.color || 'wild'} ${c.type} ${c.value ?? ''}`));
            setMyHand(myPlayer.hand);
          } else {
            console.log('⚠️ My hand is empty or invalid, will request');
          }
        } else {
          console.error('❌ Could not find myself in players list!');
          console.log('Available players:', initialGameState.players.map(p => p.name));
        }
      } else {
        console.error('❌ No players array in initial game state');
      }
      
      console.log('==========================================\n');
    }
  }, [initialGameState, username]);

  // Setup WebSocket listeners
  useEffect(() => {
    if (setupComplete.current) return;
    setupComplete.current = true;

    console.log('🔧 Setting up UNO WebSocket listeners');

    const unsubscribeGameStarted = on('GAME_STARTED', (payload) => {
      console.log('\n🎮 GAME_STARTED event received');
      if (payload.gameState && payload.gameType === 'uno') {
        console.log('📦 Setting game state');
        setGameState(payload.gameState);
        
        // Extract hand from game state
        const myPlayer = payload.gameState.players?.find(p => p.name === username);
        if (myPlayer && myPlayer.hand) {
          console.log(`✅ Found my hand: ${myPlayer.hand.length} cards`);
          setMyHand(myPlayer.hand);
        }
      }
    });

    const unsubscribeYourHand = on('YOUR_HAND', (payload) => {
      console.log('\n🤚 YOUR_HAND event received');
      console.log('👤 For player:', payload.playerName);
      console.log('🎴 Cards count:', payload.hand?.length || 0);
      
      // Only update if this message is for me
      if (payload.playerName === username || !payload.playerName) {
        if (payload.hand && Array.isArray(payload.hand)) {
          console.log('✅ Updating my hand with', payload.hand.length, 'cards');
          setMyHand(payload.hand);
        }
      } else {
        console.log('⚠️ This hand is for someone else, ignoring');
      }
    });

    const unsubscribeCardPlayed = on('CARD_PLAYED', (payload) => {
      console.log('🃏 CARD_PLAYED event');
      if (payload.gameState) {
        setGameState(payload.gameState);
        
        // Update hand from game state
        const myPlayer = payload.gameState.players?.find(p => p.name === username);
        if (myPlayer && myPlayer.hand) {
          setMyHand(myPlayer.hand);
        }
      }
    });

    const unsubscribeCardDrawn = on('CARD_DRAWN', (payload) => {
      console.log('📥 CARD_DRAWN event');
      if (payload.gameState) {
        setGameState(payload.gameState);
        
        // Update hand from game state
        const myPlayer = payload.gameState.players?.find(p => p.name === username);
        if (myPlayer && myPlayer.hand) {
          setMyHand(myPlayer.hand);
        }
      }
    });

    const unsubscribeGameOver = on('GAME_OVER', (payload) => {
      setTimeout(() => {
        alert(`🏆 ${payload.winner} wins!`);
        onLeaveRoom();
      }, 500);
    });

    return () => {
      console.log('🧹 Cleaning up UNO WebSocket listeners');
      unsubscribeGameStarted();
      unsubscribeYourHand();
      unsubscribeCardPlayed();
      unsubscribeCardDrawn();
      unsubscribeGameOver();
      if (handRequestTimer.current) {
        clearInterval(handRequestTimer.current);
      }
    };
  }, [username]);

  // Request hand if we don't have cards after 1 second
  useEffect(() => {
    if (gameState && myHand.length === 0 && isConnected) {
      console.log('⚠️ No cards yet, requesting hand...');
      
      // Request immediately
      requestHand();
      
      // Set up polling to request hand every second until we get cards
      handRequestTimer.current = setInterval(() => {
        if (myHand.length === 0) {
          console.log('⏰ Still no cards, requesting again...');
          requestHand();
        } else {
          console.log('✅ Got cards, stopping requests');
          clearInterval(handRequestTimer.current);
        }
      }, 1000);

      return () => {
        if (handRequestTimer.current) {
          clearInterval(handRequestTimer.current);
        }
      };
    }
  }, [gameState, myHand.length, isConnected]);

  const requestHand = () => {
    if (!isConnected) {
      console.log('⚠️ Not connected, cannot request hand');
      return;
    }
    
    console.log(`📤 Sending REQUEST_HAND for ${username}`);
    sendMessage('REQUEST_HAND', { roomCode, username });
  };

  const handlePlayCard = (cardIndex) => {
    const card = myHand[cardIndex];
    
    if (!card) {
      console.error('❌ Invalid card index:', cardIndex);
      return;
    }
    
    console.log(`🎴 Playing card at index ${cardIndex}:`, card);
    
    if (card.type === 'wild' || card.type === 'wild_draw4') {
      setSelectedCard(cardIndex);
      setShowColorPicker(true);
    } else {
      console.log('📤 Sending PLAY_CARD');
      sendMessage('PLAY_CARD', { roomCode, username, cardIndex });
      setSelectedCard(null);
    }
  };

  const handleColorChoice = (color) => {
    console.log(`🌈 Chosen color: ${color}`);
    console.log('📤 Sending PLAY_CARD with color');
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
    console.log('📥 Drawing card');
    sendMessage('DRAW_CARD', { roomCode, username });
  };

  if (!gameState) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: colors.background }}
      >
        <div 
          className="rounded-3xl shadow-2xl p-8 text-center border"
          style={{
            background: colors.surface,
            borderColor: `${colors.primary}30`,
            backdropFilter: 'blur(20px)'
          }}
        >
          <div 
            className="animate-spin rounded-full h-16 w-16 border-b-4 mx-auto mb-4"
            style={{ borderColor: colors.primary }}
          ></div>
          <h2 className="text-2xl font-orbitron font-bold" style={{ color: colors.text }}>
            Loading UNO Game...
          </h2>
          <p className="font-poppins mt-2" style={{ color: colors.textSecondary }}>
            Please wait...
          </p>
        </div>
      </div>
    );
  }

  const topCard = gameState.discardPile?.[gameState.discardPile.length - 1];
  const currentPlayer = gameState.players?.[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.name === username;

  const getCardColor = (card) => {
    if (!card) return colors.surface;
    const color = card.color || gameState.currentColor;
    const colorMap = {
      'red': '#ef4444',
      'blue': '#3b82f6',
      'green': '#22c55e',
      'yellow': '#eab308',
    };
    return colorMap[color] || colors.surface;
  };

  const getCardDisplay = (card) => {
    if (!card) return '?';
    if (card.type === 'number') return card.value;
    if (card.type === 'skip') return '🚫';
    if (card.type === 'reverse') return '🔄';
    if (card.type === 'draw2') return '+2';
    if (card.type === 'wild') return '🌈';
    if (card.type === 'wild_draw4') return '+4';
    return '?';
  };

  return (
    <div 
      className="min-h-screen p-4"
      style={{ backgroundColor: colors.background }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div 
          className="rounded-2xl shadow-xl p-4 mb-4 border"
          style={{
            background: colors.surface,
            borderColor: `${colors.primary}30`,
            backdropFilter: 'blur(20px)'
          }}
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 
                className="text-3xl font-orbitron font-black"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                🃏 UNO
              </h1>
              <p className="text-sm font-poppins" style={{ color: colors.textSecondary }}>
                Room: {roomCode}
              </p>
            </div>
            <button
              onClick={onLeaveRoom}
              className="px-4 py-2 rounded-lg font-raleway font-semibold transition-colors border"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.5)',
                color: '#ef4444'
              }}
            >
              Leave Game
            </button>
          </div>
        </div>

        {/* Players Info */}
        <div 
          className="rounded-2xl shadow-xl p-4 mb-4 border"
          style={{
            background: colors.surface,
            borderColor: `${colors.primary}30`,
            backdropFilter: 'blur(20px)'
          }}
        >
          <h2 className="text-lg font-orbitron font-bold mb-3" style={{ color: colors.text }}>
            Players
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {gameState.players?.map((player, index) => (
              <div
                key={player.name}
                className="p-3 rounded-lg border-2"
                style={{
                  background: index === gameState.currentPlayerIndex
                    ? `${colors.primary}20`
                    : 'rgba(0, 0, 0, 0.3)',
                  borderColor: index === gameState.currentPlayerIndex
                    ? colors.primary
                    : `${colors.primary}30`
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-raleway font-semibold" style={{ color: colors.text }}>
                    {player.name}
                    {player.name === username && ' (You)'}
                  </span>
                  <span className="text-2xl font-bold" style={{ color: colors.primary }}>
                    {player.name === username ? myHand.length : (player.hand?.length || 0)}
                  </span>
                </div>
                {index === gameState.currentPlayerIndex && (
                  <p className="text-xs font-poppins mt-1" style={{ color: colors.primary }}>
                    🎯 Current Turn
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Game Board */}
        <div 
          className="rounded-2xl shadow-xl p-8 mb-4 border"
          style={{
            background: colors.surface,
            borderColor: `${colors.primary}30`,
            backdropFilter: 'blur(20px)'
          }}
        >
          <div className="flex items-center justify-center gap-8">
            {/* Draw Pile */}
            <div className="text-center">
              <button
                onClick={handleDrawCard}
                disabled={!isMyTurn}
                className="w-32 h-48 rounded-2xl border-4 border-dashed flex items-center justify-center text-6xl transition-transform hover:scale-105"
                style={{
                  borderColor: isMyTurn ? `${colors.primary}60` : `${colors.primary}30`,
                  background: isMyTurn ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.2)',
                  cursor: isMyTurn ? 'pointer' : 'not-allowed'
                }}
              >
                🎴
              </button>
              <p className="mt-2 text-sm font-raleway font-semibold" style={{ color: colors.text }}>
                Draw Pile
              </p>
              <p className="text-xs font-poppins" style={{ color: colors.textSecondary }}>
                {gameState.deck?.length || 0} cards
              </p>
            </div>

            {/* Current Card */}
            <div className="text-center">
              <div
                className="w-32 h-48 rounded-2xl border-4 shadow-2xl flex items-center justify-center text-6xl font-bold text-white"
                style={{
                  background: getCardColor(topCard),
                  borderColor: 'rgba(255, 255, 255, 0.3)'
                }}
              >
                {getCardDisplay(topCard)}
              </div>
              <p className="mt-2 text-sm font-raleway font-semibold" style={{ color: colors.text }}>
                Current Card
              </p>
              <p className="text-xs font-poppins capitalize" style={{ color: colors.textSecondary }}>
                Color: {gameState.currentColor}
              </p>
            </div>
          </div>

          {/* Turn Indicator */}
          <div className="mt-6 text-center">
            <p 
              className="text-xl font-orbitron font-bold"
              style={{ 
                color: isMyTurn ? colors.primary : colors.textSecondary,
                animation: isMyTurn ? 'pulse 2s infinite' : 'none'
              }}
            >
              {isMyTurn ? "🎯 It's your turn!" : `⏳ Waiting for ${currentPlayer?.name}...`}
            </p>
          </div>
        </div>

        {/* Your Hand */}
        <div 
          className="rounded-2xl shadow-xl p-6 border"
          style={{
            background: colors.surface,
            borderColor: `${colors.primary}30`,
            backdropFilter: 'blur(20px)'
          }}
        >
          <h2 className="text-xl font-orbitron font-bold mb-4" style={{ color: colors.text }}>
            Your Hand ({myHand.length} {myHand.length === 1 ? 'card' : 'cards'})
          </h2>
          
          {myHand.length === 0 ? (
            <div className="text-center py-12">
              <div 
                className="animate-spin rounded-full h-16 w-16 border-b-4 mx-auto mb-4"
                style={{ borderColor: colors.primary }}
              ></div>
              <p className="font-poppins text-lg font-semibold" style={{ color: colors.text }}>
                Loading your cards...
              </p>
              <p className="font-poppins text-sm mt-2" style={{ color: colors.textSecondary }}>
                This should only take a moment
              </p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {myHand.map((card, index) => (
                <button
                  key={index}
                  onClick={() => handlePlayCard(index)}
                  disabled={!isMyTurn}
                  className="flex-shrink-0 w-24 h-36 rounded-xl border-4 shadow-lg flex items-center justify-center text-4xl font-bold text-white transition-all"
                  style={{
                    background: getCardColor(card),
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    cursor: isMyTurn ? 'pointer' : 'not-allowed',
                    opacity: isMyTurn ? 1 : 0.5,
                    transform: isMyTurn ? 'none' : 'scale(0.95)'
                  }}
                  onMouseEnter={(e) => {
                    if (isMyTurn) {
                      e.currentTarget.style.transform = 'scale(1.1) translateY(-8px)';
                      e.currentTarget.style.boxShadow = `0 0 40px ${colors.glow}60`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isMyTurn) {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '';
                    }
                  }}
                  title={isMyTurn ? 'Click to play' : 'Wait for your turn'}
                >
                  {getCardDisplay(card)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Color Picker Modal */}
        {showColorPicker && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div 
              className="rounded-2xl p-8 shadow-2xl border"
              style={{
                background: colors.surface,
                borderColor: `${colors.primary}30`,
                backdropFilter: 'blur(20px)'
              }}
            >
              <h3 className="text-2xl font-orbitron font-bold mb-6 text-center" style={{ color: colors.text }}>
                Choose a Color
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {['red', 'blue', 'green', 'yellow'].map(color => (
                  <button
                    key={color}
                    onClick={() => handleColorChoice(color)}
                    className="w-28 h-28 rounded-xl border-4 shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
                    style={{
                      background: getCardColor({ color }),
                      borderColor: 'rgba(255, 255, 255, 0.3)'
                    }}
                  >
                    <span className="text-white text-lg capitalize font-bold">{color}</span>
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
