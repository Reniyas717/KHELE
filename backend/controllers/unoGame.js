const GameRoom = require('../models/GameRoom');

// Card colors and types
const COLORS = ['red', 'blue', 'green', 'yellow'];
const SPECIAL_CARDS = ['skip', 'reverse', 'draw2'];
const WILD_CARDS = ['wild', 'wild_draw4'];

// Initialize a new UNO game
function initUNOGame(players) {
  const deck = createDeck();
  shuffleDeck(deck);

  // Deal 7 cards to each player
  const gamePlayers = players.map(username => ({
    name: username,
    hand: dealCards(deck, 7),
    hasCalledUno: false
  }));

  // Start with a numbered card
  let topCard;
  do {
    topCard = deck.pop();
  } while (WILD_CARDS.includes(topCard.type) || SPECIAL_CARDS.includes(topCard.type));

  return {
    players: gamePlayers,
    deck: deck,
    discardPile: [topCard],
    currentPlayerIndex: 0,
    direction: 1, // 1 for clockwise, -1 for counter-clockwise
    currentColor: topCard.color,
    drawCount: 0, // For stacking draw cards
    lastAction: null
  };
}

// Create a full UNO deck
function createDeck() {
  const deck = [];

  // Numbered cards (0-9) for each color
  COLORS.forEach(color => {
    // One 0 per color
    deck.push({ color, type: 'number', value: 0 });
    
    // Two of each 1-9 per color
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, type: 'number', value: i });
      deck.push({ color, type: 'number', value: i });
    }

    // Special cards (2 of each per color)
    SPECIAL_CARDS.forEach(special => {
      deck.push({ color, type: special, value: null });
      deck.push({ color, type: special, value: null });
    });
  });

  // Wild cards (4 of each)
  for (let i = 0; i < 4; i++) {
    deck.push({ color: null, type: 'wild', value: null });
    deck.push({ color: null, type: 'wild_draw4', value: null });
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

// Deal cards from deck
function dealCards(deck, count) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      console.warn('Deck is empty!');
      break;
    }
    cards.push(deck.pop());
  }
  return cards;
}

// Play a card
function playCard(gameState, username, cardIndex, chosenColor = null) {
  const playerIndex = gameState.players.findIndex(p => p.name === username);
  
  if (playerIndex === -1) {
    return { error: 'Player not found' };
  }

  if (playerIndex !== gameState.currentPlayerIndex) {
    return { error: 'Not your turn' };
  }

  const player = gameState.players[playerIndex];
  const card = player.hand[cardIndex];

  if (!card) {
    return { error: 'Card not found' };
  }

  const topCard = gameState.discardPile[gameState.discardPile.length - 1];

  // Check if card can be played
  if (!canPlayCard(card, topCard, gameState.currentColor)) {
    return { error: 'Cannot play this card' };
  }

  // Remove card from hand
  player.hand.splice(cardIndex, 1);
  gameState.discardPile.push(card);

  // Handle wild cards
  if (WILD_CARDS.includes(card.type)) {
    gameState.currentColor = chosenColor || COLORS[0];
  } else {
    gameState.currentColor = card.color;
  }

  // Handle special cards
  handleSpecialCard(gameState, card);

  // Check for win
  if (player.hand.length === 0) {
    return { gameOver: true, winner: username };
  }

  // Move to next player (unless skipped by card effect)
  if (!gameState.skipNext) {
    moveToNextPlayer(gameState);
  } else {
    gameState.skipNext = false;
  }

  gameState.lastAction = {
    player: username,
    card: card,
    timestamp: Date.now()
  };

  return { success: true };
}

// Check if a card can be played
function canPlayCard(card, topCard, currentColor) {
  // Wild cards can always be played
  if (WILD_CARDS.includes(card.type)) {
    return true;
  }

  // Match color
  if (card.color === currentColor) {
    return true;
  }

  // Match type or value
  if (card.type === topCard.type) {
    return true;
  }

  if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) {
    return true;
  }

  return false;
}

// Handle special card effects
function handleSpecialCard(gameState, card) {
  switch (card.type) {
    case 'skip':
      moveToNextPlayer(gameState);
      gameState.skipNext = true;
      break;

    case 'reverse':
      gameState.direction *= -1;
      // In 2-player game, reverse acts as skip
      if (gameState.players.length === 2) {
        gameState.skipNext = true;
      }
      break;

    case 'draw2':
      moveToNextPlayer(gameState);
      drawCardsForPlayer(gameState, gameState.currentPlayerIndex, 2);
      gameState.skipNext = true;
      break;

    case 'wild_draw4':
      moveToNextPlayer(gameState);
      drawCardsForPlayer(gameState, gameState.currentPlayerIndex, 4);
      gameState.skipNext = true;
      break;
  }
}

// Draw cards for a player
function drawCardsForPlayer(gameState, playerIndex, count) {
  const player = gameState.players[playerIndex];
  
  for (let i = 0; i < count; i++) {
    if (gameState.deck.length === 0) {
      // Reshuffle discard pile back into deck
      const topCard = gameState.discardPile.pop();
      gameState.deck = gameState.discardPile;
      gameState.discardPile = [topCard];
      shuffleDeck(gameState.deck);
    }

    if (gameState.deck.length > 0) {
      player.hand.push(gameState.deck.pop());
    }
  }
}

// Draw a card (when player can't or won't play)
function drawCard(gameState, username) {
  const playerIndex = gameState.players.findIndex(p => p.name === username);
  
  if (playerIndex === -1 || playerIndex !== gameState.currentPlayerIndex) {
    return { error: 'Invalid action' };
  }

  drawCardsForPlayer(gameState, playerIndex, 1);
  
  // After drawing, player can choose to play the drawn card or pass
  // For now, automatically move to next player
  moveToNextPlayer(gameState);

  return { success: true };
}

// Move to next player
function moveToNextPlayer(gameState) {
  gameState.currentPlayerIndex = 
    (gameState.currentPlayerIndex + gameState.direction + gameState.players.length) % gameState.players.length;
}

module.exports = {
  initUNOGame,
  playCard,
  drawCard
};
