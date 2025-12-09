import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export default function UNOGame({ roomCode, username, players, initialGameState, onLeaveRoom }) {
  const [gameState, setGameState] = useState(initialGameState);
  const [myHand, setMyHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const { sendMessage, on, isConnected } = useWebSocket();
  const setupComplete = useRef(false);
  const handRequested = useRef(false);

  // Update game state and request hand
  useEffect(() => {
    if (initialGameState) {
      console.log('📦 Setting initial game state for UNO');
      setGameState(initialGameState);
      
      // Request hand immediately
      if (!handRequested.current && isConnected) {
        console.log('🤚 Requesting hand immediately');
        requestHand();
        handRequested.current = true;
      }
    }
  }, [initialGameState, isConnected]);

  useEffect(() => {
    if (setupComplete.current) return;
    setupComplete.current = true;

    console.log('🃏 UNOGame mounted for', username);

    const unsubscribeGameStarted = on('GAME_STARTED', (payload) => {
      console.log('🎮 GAME_STARTED received:', payload);
      if (payload.gameState && payload.gameType === 'uno') {
        setGameState(payload.gameState);
        // Request hand after game starts
        setTimeout(() => {
          requestHand();
        }, 500);
      }
    });

    const unsubscribeYourHand = on('YOUR_HAND', (payload) => {
      console.log('🤚 YOUR_HAND received:', payload.hand.length, 'cards');
      setMyHand(payload.hand);
    });

    const unsubscribeCardPlayed = on('CARD_PLAYED', (payload) => {
      console.log('🃏 Card played');
      setGameState(payload.gameState);
      requestHand();
    });

    const unsubscribeCardDrawn = on('CARD_DRAWN', (payload) => {
      console.log('📥 Card drawn');
      setGameState(payload.gameState);
      requestHand();
    });

    const unsubscribeGameOver = on('GAME_OVER', (payload) => {
      setTimeout(() => {
        alert(`🏆 ${payload.winner} wins!`);
        onLeaveRoom();
      }, 500);
    });

    return () => {
      console.log('🧹 Cleaning up UNOGame');
      unsubscribeGameStarted();
      unsubscribeYourHand();
      unsubscribeCardPlayed();
      unsubscribeCardDrawn();
      unsubscribeGameOver();
    };
  }, []);

  const requestHand = () => {
    if (!isConnected) {
      console.log('⚠️ Not connected, retrying in 500ms...');
      setTimeout(requestHand, 500);
      return;
    }
    
    console.log('📤 Sending REQUEST_HAND for', username);
    sendMessage('REQUEST_HAND', { roomCode, username });
  };

  const handlePlayCard = (cardIndex) => {
    const card = myHand[cardIndex];
    
    if (card.type === 'wild' || card.type === 'wild_draw4') {
      setSelectedCard(cardIndex);
      setShowColorPicker(true);
    } else {
      sendMessage('PLAY_CARD', { roomCode, username, cardIndex });
      setSelectedCard(null);
    }
  };

  const handleColorChoice = (color) => {
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
    sendMessage('DRAW_CARD', { roomCode, username });
  };

  // Show loading state while waiting for game state
  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-yellow-500 to-blue-500 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-500 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-800">Loading UNO...</h2>
        </div>
      </div>
    );
  }

  const topCard = gameState.discardPile?.[gameState.discardPile.length - 1];
  const currentPlayer = gameState.players?.[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.name === username;

  const getCardColor = (card) => {
    if (!card) return 'bg-gray-800';
    const color = card.color || gameState.currentColor;
    const colorMap = {
      'red': 'bg-red-500',
      'blue': 'bg-blue-500',
      'green': 'bg-green-500',
      'yellow': 'bg-yellow-400',
    };
    return colorMap[color] || 'bg-gray-800';
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
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-yellow-500 to-blue-500 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-blue-600">
                🃏 UNO
              </h1>
              <p className="text-sm text-gray-600">Room: {roomCode}</p>
            </div>
            <button
              onClick={onLeaveRoom}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              Leave Game
            </button>
          </div>
        </div>

        {/* Players Info */}
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
          <h2 className="text-lg font-bold mb-3">Players</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {gameState.players?.map((player, index) => (
              <div
                key={player.name}
                className={`p-3 rounded-lg ${
                  index === gameState.currentPlayerIndex
                    ? 'bg-green-100 border-2 border-green-500'
                    : 'bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {player.name}
                    {player.name === username && ' (You)'}
                  </span>
                  <span className="text-2xl font-bold text-red-500">
                    {player.name === username ? myHand.length : (player.hand?.length || 0)}
                  </span>
                </div>
                {index === gameState.currentPlayerIndex && (
                  <p className="text-xs text-green-600 mt-1">🎯 Current Turn</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Game Board */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-4">
          <div className="flex items-center justify-center gap-8">
            {/* Draw Pile */}
            <div className="text-center">
              <button
                onClick={handleDrawCard}
                disabled={!isMyTurn}
                className={`w-32 h-48 rounded-2xl border-4 border-dashed flex items-center justify-center text-6xl transition-transform ${
                  isMyTurn
                    ? 'border-gray-400 hover:scale-105 cursor-pointer bg-gray-200'
                    : 'border-gray-300 cursor-not-allowed bg-gray-100'
                }`}
              >
                🎴
              </button>
              <p className="mt-2 text-sm font-semibold">Draw Pile</p>
              <p className="text-xs text-gray-600">{gameState.deck?.length || 0} cards</p>
            </div>

            {/* Current Card */}
            <div className="text-center">
              <div
                className={`w-32 h-48 rounded-2xl ${getCardColor(topCard)} border-4 border-white shadow-2xl flex items-center justify-center text-6xl font-bold text-white`}
              >
                {getCardDisplay(topCard)}
              </div>
              <p className="mt-2 text-sm font-semibold">Current Card</p>
              <p className="text-xs text-gray-600 capitalize">
                Color: {gameState.currentColor}
              </p>
            </div>
          </div>

          {/* Turn Indicator */}
          <div className="mt-6 text-center">
            <p className={`text-xl font-bold ${isMyTurn ? 'text-green-600' : 'text-gray-600'}`}>
              {isMyTurn ? "🎯 It's your turn!" : `⏳ ${currentPlayer?.name}'s turn`}
            </p>
          </div>
        </div>

        {/* Your Hand */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold mb-4">
            Your Hand ({myHand.length} {myHand.length === 1 ? 'card' : 'cards'})
          </h2>
          
          {myHand.length === 0 ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your cards...</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {myHand.map((card, index) => (
                <button
                  key={index}
                  onClick={() => handlePlayCard(index)}
                  disabled={!isMyTurn}
                  className={`flex-shrink-0 w-24 h-36 rounded-xl ${getCardColor(card)} border-4 border-white shadow-lg flex items-center justify-center text-4xl font-bold text-white transition-transform ${
                    isMyTurn ? 'hover:scale-110 cursor-pointer hover:-translate-y-2' : 'cursor-not-allowed opacity-50'
                  }`}
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
            <div className="bg-white rounded-2xl p-8 shadow-2xl">
              <h3 className="text-2xl font-bold mb-4 text-center">Choose a Color</h3>
              <div className="grid grid-cols-2 gap-4">
                {['red', 'blue', 'green', 'yellow'].map(color => (
                  <button
                    key={color}
                    onClick={() => handleColorChoice(color)}
                    className={`w-24 h-24 rounded-xl ${getCardColor({ color })} border-4 border-white shadow-lg hover:scale-110 transition-transform flex items-center justify-center`}
                  >
                    <span className="text-white text-sm capitalize font-bold">{color}</span>
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
