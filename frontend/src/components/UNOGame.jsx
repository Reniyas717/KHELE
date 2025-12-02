import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export default function UNOGame({ roomCode, username, players, onLeaveRoom }) {
  const [gameState, setGameState] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [myHand, setMyHand] = useState([]);
  const { sendMessage, on } = useWebSocket();

  useEffect(() => {
    // Listen for game updates
    const unsubscribeGameStarted = on('GAME_STARTED', (payload) => {
      console.log('🎮 UNO Game started:', payload);
      setGameState(payload.gameState);
      requestHand();
    });

    const unsubscribeCardPlayed = on('CARD_PLAYED', (payload) => {
      console.log('🃏 Card played:', payload);
      setGameState(payload.gameState);
      requestHand();
    });

    const unsubscribeCardDrawn = on('CARD_DRAWN', (payload) => {
      console.log('📥 Card drawn:', payload);
      setGameState(payload.gameState);
      requestHand();
    });

    const unsubscribeYourHand = on('YOUR_HAND', (payload) => {
      console.log('🤚 Your hand:', payload);
      setMyHand(payload.hand);
    });

    const unsubscribeGameOver = on('GAME_OVER', (payload) => {
      console.log('🏆 Game over:', payload);
      alert(`${payload.winner} wins!`);
    });

    // Request initial hand
    requestHand();

    return () => {
      unsubscribeGameStarted();
      unsubscribeCardPlayed();
      unsubscribeCardDrawn();
      unsubscribeYourHand();
      unsubscribeGameOver();
    };
  }, [roomCode, username]);

  const requestHand = () => {
    sendMessage('REQUEST_HAND', { roomCode, username });
  };

  const handlePlayCard = (cardIndex) => {
    const card = myHand[cardIndex];
    
    // Check if it's a wild card
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
          <h2 className="text-2xl font-bold text-gray-800">Loading UNO Game...</h2>
          <p className="text-gray-600 mt-2">Please wait while we set up the game</p>
        </div>
      </div>
    );
  }

  const topCard = gameState.discardPile?.[gameState.discardPile.length - 1];
  const currentPlayer = gameState.players?.[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.name === username;

  // Get card color for styling
  const getCardColor = (card) => {
    if (!card) return 'gray';
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
                    {player.hand?.length || 0}
                  </span>
                </div>
                {index === gameState.currentPlayerIndex && (
                  <p className="text-xs text-green-600 mt-1">Current Turn</p>
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
              <p className="text-xs text-gray-600">
                Color: <span className="capitalize">{gameState.currentColor}</span>
              </p>
            </div>
          </div>

          {/* Turn Indicator */}
          <div className="mt-6 text-center">
            <p className={`text-xl font-bold ${isMyTurn ? 'text-green-600' : 'text-gray-600'}`}>
              {isMyTurn ? "🎯 It's your turn!" : `⏳ Waiting for ${currentPlayer?.name}...`}
            </p>
          </div>
        </div>

        {/* Your Hand */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold mb-4">Your Hand ({myHand.length} cards)</h2>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {myHand.map((card, index) => (
              <button
                key={index}
                onClick={() => handlePlayCard(index)}
                disabled={!isMyTurn}
                className={`flex-shrink-0 w-24 h-36 rounded-xl ${getCardColor(card)} border-4 border-white shadow-lg flex items-center justify-center text-4xl font-bold text-white transition-transform ${
                  isMyTurn ? 'hover:scale-110 cursor-pointer' : 'cursor-not-allowed opacity-50'
                }`}
              >
                {getCardDisplay(card)}
              </button>
            ))}
          </div>
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
                    className={`w-24 h-24 rounded-xl ${getCardColor({ color })} border-4 border-white shadow-lg hover:scale-110 transition-transform`}
                  >
                    <span className="text-white text-sm capitalize">{color}</span>
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
