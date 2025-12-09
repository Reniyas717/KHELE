const GameRoom = require('../models/GameRoom');

// Card colors and types
const COLORS = ['red', 'blue', 'green', 'yellow'];
const SPECIAL_CARDS = ['skip', 'reverse', 'draw2'];
const WILD_CARDS = ['wild', 'wild_draw4'];

// Initialize a new UNO game
function initUNOGame(players) {
  console.log('\n🃏 ========== Initializing UNO Game ==========');
  console.log('👥 Players:', players);
  
  if (!players || players.length < 2) {
    console.error('❌ Need at least 2 players');
    throw new Error('Need at least 2 players');
  }

  // Create deck
  const deck = createDeck();
  console.log('📦 Created deck with', deck.length, 'cards');
  
  // Shuffle deck thoroughly
  shuffleDeck(deck);
  shuffleDeck(deck); // Shuffle twice for better randomization
  console.log('🔀 Deck shuffled');
  
  // Deal 7 cards to each player
  const gamePlayers = players.map((playerName, playerIndex) => {
    const hand = [];
    for (let i = 0; i < 7; i++) {
      if (deck.length > 0) {
        const card = deck.pop();
        hand.push(card);
      } else {
        console.error(`❌ Ran out of cards while dealing to ${playerName}`);
      }
    }
    console.log(`🎴 Player ${playerIndex + 1}: ${playerName} received ${hand.length} cards`);
    console.log(`   First 3 cards:`, hand.slice(0, 3).map(c => `${c.color || 'wild'} ${c.type} ${c.value !== undefined ? c.value : ''}`));
    
    return {
      name: playerName,
      hand: hand,
      score: 0
    };
  });

  // Find a number card to start
  let topCard;
  let attempts = 0;
  const maxAttempts = 50;
  
  do {
    if (deck.length === 0 || attempts >= maxAttempts) {
      console.log('⚠️ Creating default starting card');
      topCard = { type: 'number', color: 'red', value: 5 };
      break;
    }
    topCard = deck.pop();
    attempts++;
  } while (topCard.type !== 'number');
  
  console.log('🎯 Starting card:', `${topCard.color} ${topCard.type} ${topCard.value}`);

  const gameState = {
    players: gamePlayers,
    deck: deck,
    discardPile: [topCard],
    currentPlayerIndex: 0,
    currentColor: topCard.color,
    direction: 1,
    drawCount: 0
  };

  console.log('✅ UNO game initialized successfully');
  console.log('📊 Summary:');
  gamePlayers.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.name}: ${p.hand.length} cards`);
  });
  console.log(`   Deck remaining: ${deck.length} cards`);
  console.log(`   Starting player: ${gamePlayers[0].name}`);
  console.log('==========================================\n');
  
  return gameState;
}

// Create a full UNO deck
function createDeck() {
  const deck = [];
  const colors = ['red', 'blue', 'green', 'yellow'];
  
  // Number cards (0-9)
  colors.forEach(color => {
    // One 0 card
    deck.push({ type: 'number', color, value: 0 });
    // Two of each 1-9
    for (let i = 1; i <= 9; i++) {
      deck.push({ type: 'number', color, value: i });
      deck.push({ type: 'number', color, value: i });
    }
  });
  
  // Action cards (2 of each per color)
  colors.forEach(color => {
    for (let i = 0; i < 2; i++) {
      deck.push({ type: 'skip', color });
      deck.push({ type: 'reverse', color });
      deck.push({ type: 'draw2', color });
    }
  });
  
  // Wild cards (4 of each)
  for (let i = 0; i < 4; i++) {
    deck.push({ type: 'wild', color: null });
    deck.push({ type: 'wild_draw4', color: null });
  }
  
  return deck;
}

// Shuffle deck
function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

// Play a card
function playCard(gameState, playerName, cardIndex, chosenColor = null) {
  const playerIndex = gameState.players.findIndex(p => p.name === playerName);
  
  if (playerIndex === -1) {
    return { success: false, message: 'Player not found' };
  }
  
  if (playerIndex !== gameState.currentPlayerIndex) {
    return { success: false, message: 'Not your turn' };
  }
  
  const player = gameState.players[playerIndex];
  const card = player.hand[cardIndex];
  
  if (!card) {
    return { success: false, message: 'Invalid card' };
  }
  
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];
  
  // Check if card can be played
  const isWild = card.type === 'wild' || card.type === 'wild_draw4';
  const matchesColor = card.color === gameState.currentColor;
  const matchesValue = card.type === 'number' && topCard.type === 'number' && card.value === topCard.value;
  const matchesType = card.type === topCard.type && card.type !== 'number';
  
  if (!isWild && !matchesColor && !matchesValue && !matchesType) {
    return { success: false, message: 'Card cannot be played' };
  }
  
  // Remove card from hand
  player.hand.splice(cardIndex, 1);
  gameState.discardPile.push(card);
  
  // Update current color
  if (isWild && chosenColor) {
    gameState.currentColor = chosenColor;
  } else if (!isWild) {
    gameState.currentColor = card.color;
  }
  
  // Handle special cards
  let skipNext = false;
  
  if (card.type === 'skip') {
    skipNext = true;
  } else if (card.type === 'reverse') {
    gameState.direction *= -1;
    if (gameState.players.length === 2) {
      skipNext = true;
    }
  } else if (card.type === 'draw2') {
    const nextPlayerIndex = getNextPlayerIndex(gameState);
    const nextPlayer = gameState.players[nextPlayerIndex];
    for (let i = 0; i < 2; i++) {
      if (gameState.deck.length > 0) {
        nextPlayer.hand.push(gameState.deck.pop());
      }
    }
    skipNext = true;
  } else if (card.type === 'wild_draw4') {
    const nextPlayerIndex = getNextPlayerIndex(gameState);
    const nextPlayer = gameState.players[nextPlayerIndex];
    for (let i = 0; i < 4; i++) {
      if (gameState.deck.length > 0) {
        nextPlayer.hand.push(gameState.deck.pop());
      }
    }
    skipNext = true;
  }
  
  // Check for winner
  if (player.hand.length === 0) {
    return {
      success: true,
      gameState,
      winner: playerName,
      message: `${playerName} wins!`
    };
  }
  
  // Move to next player
  gameState.currentPlayerIndex = getNextPlayerIndex(gameState);
  if (skipNext) {
    gameState.currentPlayerIndex = getNextPlayerIndex(gameState);
  }
  
  return {
    success: true,
    gameState,
    message: `${playerName} played a card`
  };
}

// Draw a card (when player can't or won't play)
function drawCard(gameState, playerName) {
  const playerIndex = gameState.players.findIndex(p => p.name === playerName);
  
  if (playerIndex === -1) {
    return { success: false, message: 'Player not found' };
  }
  
  if (playerIndex !== gameState.currentPlayerIndex) {
    return { success: false, message: 'Not your turn' };
  }
  
  const player = gameState.players[playerIndex];
  
  // Reshuffle if needed
  if (gameState.deck.length === 0) {
    const topCard = gameState.discardPile.pop();
    gameState.deck = [...gameState.discardPile];
    shuffleDeck(gameState.deck);
    gameState.discardPile = [topCard];
  }
  
  if (gameState.deck.length > 0) {
    const drawnCard = gameState.deck.pop();
    player.hand.push(drawnCard);
  }
  
  // Move to next player
  gameState.currentPlayerIndex = getNextPlayerIndex(gameState);
  
  return {
    success: true,
    gameState,
    message: `${playerName} drew a card`
  };
}

function getNextPlayerIndex(gameState) {
  const current = gameState.currentPlayerIndex;
  const total = gameState.players.length;
  const next = (current + gameState.direction + total) % total;
  return next;
}

module.exports = {
  initUNOGame,
  playCard,
  drawCard
};
