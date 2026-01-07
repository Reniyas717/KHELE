const GameRoom = require('../models/GameRoom');

// UNO card colors and values
const COLORS = ['red', 'blue', 'green', 'yellow'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
const WILD_CARDS = ['wild', 'wild_draw4'];

function createDeck() {
  const deck = [];
  
  // Add colored cards
  for (const color of COLORS) {
    // One 0 per color
    deck.push({ color, value: '0', id: `${color}_0_0` });
    
    // Two of each 1-9, skip, reverse, draw2
    for (const value of VALUES.slice(1)) {
      deck.push({ color, value, id: `${color}_${value}_0` });
      deck.push({ color, value, id: `${color}_${value}_1` });
    }
  }
  
  // Add wild cards (4 of each)
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', value: 'wild', id: `wild_${i}` });
    deck.push({ color: 'wild', value: 'wild_draw4', id: `wild_draw4_${i}` });
  }
  
  console.log(`📦 Created deck with ${deck.length} cards`);
  return deck;
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  console.log('🔀 Deck shuffled');
  return shuffled;
}

function initUNOGame(playerNames) {
  // Validate input
  if (!playerNames || !Array.isArray(playerNames)) {
    console.error('❌ Invalid playerNames:', playerNames);
    throw new Error('playerNames must be an array');
  }
  
  console.log('🎮 Initializing UNO game for players:', playerNames);
  
  // Create and shuffle deck
  let deck = shuffleDeck(createDeck());
  
  // Deal 7 cards to each player
  const hands = {};
  for (const player of playerNames) {
    hands[player] = deck.splice(0, 7);
    console.log(`🃏 Dealt 7 cards to ${player}`);
  }
  
  // Find a valid starting card (not wild or action card)
  let discardPile = [];
  let startingCardIndex = deck.findIndex(card => 
    card.color !== 'wild' && 
    !['skip', 'reverse', 'draw2'].includes(card.value)
  );
  
  if (startingCardIndex === -1) {
    startingCardIndex = 0; // fallback to first card
  }
  
  const startingCard = deck.splice(startingCardIndex, 1)[0];
  discardPile.push(startingCard);
  
  console.log('🎴 Starting card:', startingCard);
  
  const gameState = {
    deck,
    discardPile,
    hands,
    currentPlayerIndex: 0,
    currentPlayer: playerNames[0],
    direction: 1, // 1 = clockwise, -1 = counter-clockwise
    players: playerNames.map((username, index) => ({
      username,
      cardCount: 7,
      hasCalledUno: false
    })),
    currentColor: startingCard.color,
    currentValue: startingCard.value,
    gameOver: false,
    winner: null
  };
  
  console.log('✅ UNO game initialized:', {
    playerCount: playerNames.length,
    currentPlayer: gameState.currentPlayer,
    topCard: { color: gameState.currentColor, value: gameState.currentValue }
  });
  
  return gameState;
}

function canPlayCard(card, currentColor, currentValue) {
  // Wild cards can always be played
  if (card.color === 'wild') {
    return true;
  }
  // Match color or value
  return card.color === currentColor || card.value === currentValue;
}

function playCard(gameState, username, cardId, chosenColor = null) {
  console.log('🃏 Playing card:', { username, cardId, chosenColor });
  
  // Verify it's player's turn
  if (gameState.currentPlayer !== username) {
    return { success: false, message: 'Not your turn' };
  }
  
  // Find card in player's hand
  const hand = gameState.hands[username];
  const cardIndex = hand.findIndex(c => c.id === cardId);
  
  if (cardIndex === -1) {
    return { success: false, message: 'Card not in hand' };
  }
  
  const card = hand[cardIndex];
  
  // Check if card can be played
  if (!canPlayCard(card, gameState.currentColor, gameState.currentValue)) {
    return { success: false, message: 'Cannot play this card' };
  }
  
  // Remove card from hand
  hand.splice(cardIndex, 1);
  
  // Add to discard pile
  gameState.discardPile.push(card);
  
  // Update current color/value
  if (card.color === 'wild') {
    gameState.currentColor = chosenColor || 'red';
  } else {
    gameState.currentColor = card.color;
  }
  gameState.currentValue = card.value;
  
  // Update card count
  const playerState = gameState.players.find(p => p.username === username);
  if (playerState) {
    playerState.cardCount = hand.length;
  }
  
  // Check for win
  if (hand.length === 0) {
    gameState.gameOver = true;
    gameState.winner = username;
    console.log(`🏆 ${username} wins!`);
    return { success: true, gameState, gameOver: true, winner: username };
  }
  
  // Handle action cards
  let skipNext = false;
  let drawAmount = 0;
  
  if (card.value === 'skip') {
    skipNext = true;
  } else if (card.value === 'reverse') {
    gameState.direction *= -1;
    // In 2-player, reverse acts like skip
    if (gameState.players.length === 2) {
      skipNext = true;
    }
  } else if (card.value === 'draw2') {
    drawAmount = 2;
    skipNext = true;
  } else if (card.value === 'wild_draw4') {
    drawAmount = 4;
    skipNext = true;
  }
  
  // Move to next player
  let nextIndex = (gameState.currentPlayerIndex + gameState.direction + gameState.players.length) % gameState.players.length;
  
  // Handle draw cards
  if (drawAmount > 0) {
    const nextPlayer = gameState.players[nextIndex].username;
    for (let i = 0; i < drawAmount; i++) {
      if (gameState.deck.length === 0) {
        // Reshuffle discard pile
        const topCard = gameState.discardPile.pop();
        gameState.deck = shuffleDeck(gameState.discardPile);
        gameState.discardPile = [topCard];
      }
      if (gameState.deck.length > 0) {
        gameState.hands[nextPlayer].push(gameState.deck.pop());
      }
    }
    gameState.players.find(p => p.username === nextPlayer).cardCount = gameState.hands[nextPlayer].length;
    console.log(`📤 ${nextPlayer} drew ${drawAmount} cards`);
  }
  
  // Skip next player if needed
  if (skipNext) {
    nextIndex = (nextIndex + gameState.direction + gameState.players.length) % gameState.players.length;
  }
  
  gameState.currentPlayerIndex = nextIndex;
  gameState.currentPlayer = gameState.players[nextIndex].username;
  
  // Reset UNO call
  if (playerState) {
    playerState.hasCalledUno = hand.length === 1;
  }
  
  console.log('✅ Card played, next player:', gameState.currentPlayer);
  
  return { success: true, gameState };
}

function drawCard(gameState, username) {
  console.log('📥 Drawing card for:', username);
  
  // Verify it's player's turn
  if (gameState.currentPlayer !== username) {
    return { success: false, message: 'Not your turn' };
  }
  
  // Reshuffle if deck is empty
  if (gameState.deck.length === 0) {
    const topCard = gameState.discardPile.pop();
    gameState.deck = shuffleDeck(gameState.discardPile);
    gameState.discardPile = [topCard];
    console.log('🔄 Reshuffled discard pile into deck');
  }
  
  if (gameState.deck.length === 0) {
    return { success: false, message: 'No cards left' };
  }
  
  // Draw card
  const card = gameState.deck.pop();
  gameState.hands[username].push(card);
  
  // Update card count
  const playerState = gameState.players.find(p => p.username === username);
  if (playerState) {
    playerState.cardCount = gameState.hands[username].length;
    playerState.hasCalledUno = false;
  }
  
  // Move to next player
  const nextIndex = (gameState.currentPlayerIndex + gameState.direction + gameState.players.length) % gameState.players.length;
  gameState.currentPlayerIndex = nextIndex;
  gameState.currentPlayer = gameState.players[nextIndex].username;
  
  console.log('✅ Card drawn, next player:', gameState.currentPlayer);
  
  return { success: true, gameState, drawnCard: card };
}

module.exports = {
  initUNOGame,
  playCard,
  drawCard
};
