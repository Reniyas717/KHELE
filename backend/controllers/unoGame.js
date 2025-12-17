const GameRoom = require('../models/GameRoom');

// Card colors and types
const COLORS = ['red', 'blue', 'green', 'yellow'];
const TYPES = ['number', 'skip', 'reverse', 'draw_two', 'wild', 'wild_draw_four'];

// Initialize UNO game with official rules
function initUNOGame(playerNames) {
  console.log('🎮 Initializing UNO game for players:', playerNames);
  
  const deck = createDeck();
  console.log(`📦 Created deck with ${deck.length} cards`);
  
  const shuffledDeck = shuffleDeck(deck);
  console.log('🔀 Deck shuffled');
  
  // Deal 7 cards to each player (official UNO rules)
  const players = playerNames.map(name => ({
    name,
    hand: [],
    score: 0
  }));
  
  // Deal 7 cards to each player
  for (let i = 0; i < 7; i++) {
    players.forEach(player => {
      player.hand.push(shuffledDeck.pop());
    });
  }
  
  console.log('🎴 Dealt 7 cards to each player');
  players.forEach(p => {
    console.log(`   ${p.name}: ${p.hand.length} cards`);
  });
  
  // Draw starting card (must not be wild or action card)
  let startingCard;
  do {
    startingCard = shuffledDeck.pop();
  } while (
    startingCard.type === 'wild' || 
    startingCard.type === 'wild_draw_four' ||
    startingCard.type === 'skip' ||
    startingCard.type === 'reverse' ||
    startingCard.type === 'draw_two'
  );
  
  console.log('🎯 Starting card:', startingCard);
  
  const gameState = {
    players,
    deck: shuffledDeck,
    discardPile: [startingCard],
    currentCard: startingCard,
    currentColor: startingCard.color,
    currentPlayerIndex: 0,
    currentPlayer: playerNames[0],
    direction: 1, // 1 for clockwise, -1 for counter-clockwise
    drawCount: 0, // For stacking +2 and +4 cards
    mustDraw: false // If player must draw before playing
  };
  
  console.log('✅ UNO game initialized');
  console.log(`   Current player: ${gameState.currentPlayer}`);
  console.log(`   Cards in deck: ${gameState.deck.length}`);
  
  return gameState;
}

// Create a complete UNO deck
function createDeck() {
  const deck = [];
  
  // Number cards: 0 (1 of each color), 1-9 (2 of each color)
  COLORS.forEach(color => {
    // One 0 card per color
    deck.push({ color, type: 'number', value: 0 });
    
    // Two of each 1-9 per color
    for (let value = 1; value <= 9; value++) {
      deck.push({ color, type: 'number', value });
      deck.push({ color, type: 'number', value });
    }
    
    // Two Skip cards per color
    deck.push({ color, type: 'skip' });
    deck.push({ color, type: 'skip' });
    
    // Two Reverse cards per color
    deck.push({ color, type: 'reverse' });
    deck.push({ color, type: 'reverse' });
    
    // Two Draw Two cards per color
    deck.push({ color, type: 'draw_two' });
    deck.push({ color, type: 'draw_two' });
  });
  
  // Four Wild cards
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', type: 'wild' });
  }
  
  // Four Wild Draw Four cards
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', type: 'wild_draw_four' });
  }
  
  return deck;
}

// Shuffle deck
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Check if a card can be played
function canPlayCard(card, currentCard, currentColor) {
  // Wild cards can always be played
  if (card.type === 'wild' || card.type === 'wild_draw_four') {
    return true;
  }
  
  // Match color
  if (card.color === currentColor) {
    return true;
  }
  
  // Match type (for action cards)
  if (card.type === currentCard.type && card.type !== 'number') {
    return true;
  }
  
  // Match value (for number cards)
  if (card.type === 'number' && currentCard.type === 'number' && card.value === currentCard.value) {
    return true;
  }
  
  return false;
}

// Play a card
function playCard(gameState, playerName, cardIndex, chosenColor = null) {
  console.log('🎴 playCard called:', { playerName, cardIndex, chosenColor });
  console.log('📊 Current game state:', {
    currentPlayer: gameState.currentPlayer,
    currentPlayerIndex: gameState.currentPlayerIndex,
    players: gameState.players.map(p => p.name)
  });
  
  // Validate turn
  if (gameState.currentPlayer !== playerName) {
    console.log('❌ Not player turn:', { current: gameState.currentPlayer, attempted: playerName });
    return { success: false, message: `Not your turn. Current player: ${gameState.currentPlayer}` };
  }
  
  const player = gameState.players.find(p => p.name === playerName);
  if (!player) {
    console.log('❌ Player not found:', playerName);
    return { success: false, message: 'Player not found' };
  }
  
  const card = player.hand[cardIndex];
  if (!card) {
    console.log('❌ Invalid card index:', cardIndex);
    return { success: false, message: 'Invalid card' };
  }
  
  console.log('🎴 Attempting to play:', card);
  console.log('🎯 Current card:', gameState.currentCard, 'Color:', gameState.currentColor);
  
  // Check if card can be played
  if (!canPlayCard(card, gameState.currentCard, gameState.currentColor)) {
    console.log('❌ Card cannot be played - no match');
    return { success: false, message: 'Card cannot be played - does not match color or value' };
  }
  
  // Remove card from hand
  player.hand.splice(cardIndex, 1);
  console.log(`✅ Card removed from ${playerName}'s hand. Remaining: ${player.hand.length}`);
  
  // Add to discard pile
  gameState.discardPile.push(card);
  gameState.currentCard = card;
  
  // Handle wild cards
  if (card.type === 'wild' || card.type === 'wild_draw_four') {
    if (!chosenColor || !COLORS.includes(chosenColor)) {
      console.log('❌ Invalid color choice for wild card');
      // Put card back in hand
      player.hand.splice(cardIndex, 0, card);
      gameState.discardPile.pop();
      return { success: false, message: 'Must choose a valid color for wild card' };
    }
    gameState.currentColor = chosenColor;
    console.log('🎨 Color changed to:', chosenColor);
    
    // Wild Draw Four: next player draws 4 cards
    if (card.type === 'wild_draw_four') {
      gameState.drawCount = 4;
      console.log('➕ Next player must draw 4 cards');
    }
  } else {
    gameState.currentColor = card.color;
  }
  
  // Handle action cards
  let skipNext = false;
  
  switch (card.type) {
    case 'skip':
      skipNext = true;
      console.log('⏭️ Skip card played - next player skipped');
      break;
      
    case 'reverse':
      gameState.direction *= -1;
      console.log('🔄 Reverse card played - direction changed');
      // If only 2 players, reverse acts like skip
      if (gameState.players.length === 2) {
        skipNext = true;
      }
      break;
      
    case 'draw_two':
      gameState.drawCount += 2;
      console.log('➕ Draw Two card played - next player must draw 2 cards');
      break;
  }
  
  // Check for winner BEFORE moving to next player
  if (player.hand.length === 0) {
    console.log('🏆 WINNER:', playerName);
    return { 
      success: true, 
      gameState, 
      winner: playerName 
    };
  }
  
  // Handle forced draw (Draw Two or Wild Draw Four)
  if (gameState.drawCount > 0) {
    // Move to next player
    const nextPlayerIndex = getNextPlayerIndex(gameState, skipNext ? 2 : 1);
    const nextPlayer = gameState.players[nextPlayerIndex];
    
    console.log(`🎴 Forcing ${nextPlayer.name} to draw ${gameState.drawCount} cards`);
    
    for (let i = 0; i < gameState.drawCount; i++) {
      if (gameState.deck.length === 0) {
        reshuffleDeck(gameState);
      }
      if (gameState.deck.length > 0) {
        nextPlayer.hand.push(gameState.deck.pop());
      }
    }
    
    console.log(`✅ ${nextPlayer.name} drew ${gameState.drawCount} cards. Hand size: ${nextPlayer.hand.length}`);
    gameState.drawCount = 0;
    
    // Skip the penalized player's turn
    const afterPenaltyIndex = getNextPlayerIndex(gameState, skipNext ? 2 : 1);
    gameState.currentPlayerIndex = afterPenaltyIndex;
    gameState.currentPlayer = gameState.players[afterPenaltyIndex].name;
    console.log('⏭️ Skipping penalized player. Next player:', gameState.currentPlayer);
  } else {
    // Move to next player normally
    const nextPlayerIndex = getNextPlayerIndex(gameState, skipNext ? 2 : 1);
    gameState.currentPlayerIndex = nextPlayerIndex;
    gameState.currentPlayer = gameState.players[nextPlayerIndex].name;
    console.log('➡️ Next player:', gameState.currentPlayer);
  }
  
  console.log('✅ Card played successfully');
  console.log(`   Current player now: ${gameState.currentPlayer}`);
  console.log(`   Deck: ${gameState.deck.length} cards`);
  console.log(`   Discard: ${gameState.discardPile.length} cards`);
  
  return { success: true, gameState };
}

// Draw a card
function drawCard(gameState, playerName) {
  console.log('🎴 drawCard called for:', playerName);
  console.log('📊 Current game state:', {
    currentPlayer: gameState.currentPlayer,
    currentPlayerIndex: gameState.currentPlayerIndex
  });
  
  if (gameState.currentPlayer !== playerName) {
    console.log('❌ Not player turn');
    return { success: false, message: `Not your turn. Current player: ${gameState.currentPlayer}` };
  }
  
  const player = gameState.players.find(p => p.name === playerName);
  if (!player) {
    console.log('❌ Player not found');
    return { success: false, message: 'Player not found' };
  }
  
  // Reshuffle if deck is empty
  if (gameState.deck.length === 0) {
    console.log('🔀 Deck empty, reshuffling...');
    reshuffleDeck(gameState);
  }
  
  if (gameState.deck.length === 0) {
    console.log('❌ No cards available');
    return { success: false, message: 'No cards available' };
  }
  
  const drawnCard = gameState.deck.pop();
  player.hand.push(drawnCard);
  console.log(`✅ ${playerName} drew a card. Hand size: ${player.hand.length}`);
  console.log(`   Drew:`, drawnCard);
  console.log(`   Deck remaining: ${gameState.deck.length} cards`);
  
  // Check if drawn card can be played immediately
  const canPlay = canPlayCard(drawnCard, gameState.currentCard, gameState.currentColor);
  console.log(`   Can play drawn card: ${canPlay}`);
  
  // Player MUST move to next turn after drawing (official UNO rules)
  // They cannot play the card they just drew in the same turn
  const nextPlayerIndex = getNextPlayerIndex(gameState, 1);
  gameState.currentPlayerIndex = nextPlayerIndex;
  gameState.currentPlayer = gameState.players[nextPlayerIndex].name;
  console.log('⏭️ Turn ends after drawing. Next player:', gameState.currentPlayer);
  
  return { success: true, gameState };
}

// Get next player index
function getNextPlayerIndex(gameState, steps = 1) {
  const { players, currentPlayerIndex, direction } = gameState;
  const totalPlayers = players.length;
  
  let nextIndex = currentPlayerIndex;
  for (let i = 0; i < steps; i++) {
    nextIndex = (nextIndex + direction + totalPlayers) % totalPlayers;
  }
  
  return nextIndex;
}

// Reshuffle discard pile into deck
function reshuffleDeck(gameState) {
  console.log('🔀 Reshuffling discard pile into deck');
  
  if (gameState.discardPile.length <= 1) {
    console.log('⚠️ Not enough cards to reshuffle');
    return;
  }
  
  // Keep current card, shuffle the rest back into deck
  const currentCard = gameState.discardPile.pop();
  gameState.deck = shuffleDeck(gameState.discardPile);
  gameState.discardPile = [currentCard];
  
  console.log(`✅ Reshuffled ${gameState.deck.length} cards back into deck`);
}

// Handle UNO WebSocket messages
async function handleUNOMessage(type, payload, username, roomCode, broadcastToRoom) {
  try {
    const room = await GameRoom.findOne({ roomCode, isActive: true });
    
    if (!room || !room.gameState) {
      console.error('❌ Room or game state not found');
      return;
    }
    
    let result;
    
    switch (type) {
      case 'PLAY_CARD':
        result = playCard(
          room.gameState, 
          username, 
          payload.cardIndex, 
          payload.chosenColor
        );
        
        if (result.success) {
          // Update room game state in database
          room.gameState = result.gameState;
          await room.save();
          
          // Broadcast updated game state to room
          broadcastToRoom(roomCode, {
            type: 'GAME_STATE_UPDATED',
            payload: result.gameState
          });
        }
        break;
        
      case 'DRAW_CARD':
        result = drawCard(room.gameState, username);
        
        if (result.success) {
          // Update room game state in database
          room.gameState = result.gameState;
          await room.save();
          
          // Broadcast updated game state to room
          broadcastToRoom(roomCode, {
            type: 'GAME_STATE_UPDATED',
            payload: result.gameState
          });
        }
        break;
        
      // Handle other message types (e.g., JOIN_ROOM, LEAVE_ROOM) as needed
    }
  } catch (error) {
    console.error('❌ Error handling UNO message:', error);
  }
}

module.exports = {
  initUNOGame,
  playCard,
  drawCard,
  canPlayCard,
  getNextPlayerIndex,
  reshuffleDeck
};
