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
    score: 0,
    finished: false,
    position: null
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
    mustDraw: false, // If player must draw before playing
    canStackDraw: false // If current player can stack a draw card
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

// Check if player has a stackable card
function hasStackableCard(player, lastCard) {
  return player.hand.some(card => {
    // Can stack +4 on +4
    if (lastCard.type === 'wild_draw_four' && card.type === 'wild_draw_four') {
      return true;
    }
    
    // Can stack +4 on +2 (but NOT +2 on +4)
    if (lastCard.type === 'draw_two' && card.type === 'wild_draw_four') {
      return true;
    }
    
    // Can stack +2 on +2 (ONLY if last card was +2)
    if (lastCard.type === 'draw_two' && card.type === 'draw_two') {
      return true;
    }
    
    return false;
  });
}

// Check if a card can be played
function canPlayCard(card, currentCard, currentColor, gameState) {
  // If there's a draw count pending, ONLY stackable draw cards can be played
  if (gameState.drawCount > 0) {
    const lastCard = gameState.currentCard;
    
    // Can ONLY stack +4 on +4
    if (lastCard.type === 'wild_draw_four') {
      if (card.type === 'wild_draw_four') {
        console.log('✅ Stacking +4 on +4');
        return true;
      }
      console.log('❌ Cannot stack - only +4 can be stacked on +4');
      return false;
    }
    
    // Can stack +4 OR +2 on +2
    if (lastCard.type === 'draw_two') {
      if (card.type === 'wild_draw_four') {
        console.log('✅ Stacking +4 on +2');
        return true;
      }
      if (card.type === 'draw_two') {
        console.log('✅ Stacking +2 on +2');
        return true;
      }
      console.log('❌ Cannot stack - only +4 or +2 can be stacked on +2');
      return false;
    }
    
    // Cannot play other cards when draw is pending
    console.log('❌ Cannot play - must draw or stack draw card');
    return false;
  }
  
  // Wild cards can always be played (when no draw penalty)
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
    players: gameState.players.map(p => ({ name: p.name, finished: p.finished, cards: p.hand.length })),
    drawCount: gameState.drawCount
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
  
  // Skip if player already finished
  if (player.finished) {
    console.log('❌ Player already finished:', playerName);
    
    // Auto-skip to next active player
    const nextPlayerIndex = getNextActivePlayerIndex(gameState, 1);
    gameState.currentPlayerIndex = nextPlayerIndex;
    gameState.currentPlayer = gameState.players[nextPlayerIndex].name;
    
    console.log(`⏭️ Auto-skipped finished player. Next player: ${gameState.currentPlayer}`);
    
    return { 
      success: true, 
      gameState,
      autoSkipped: true,
      message: 'Player already finished - turn auto-skipped'
    };
  }
  
  const card = player.hand[cardIndex];
  if (!card) {
    console.log('❌ Invalid card index:', cardIndex);
    return { success: false, message: 'Invalid card' };
  }
  
  console.log('🎴 Attempting to play:', card);
  console.log('🎯 Current card:', gameState.currentCard, 'Color:', gameState.currentColor);
  
  // Check if card can be played (with stacking rules)
  if (!canPlayCard(card, gameState.currentCard, gameState.currentColor, gameState)) {
    console.log('❌ Card cannot be played - no match');
    
    // If draw count is pending, they must draw
    if (gameState.drawCount > 0) {
      return { success: false, message: `You must draw ${gameState.drawCount} cards! No stackable cards available.` };
    }
    
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
      player.hand.splice(cardIndex, 0, card);
      gameState.discardPile.pop();
      return { success: false, message: 'Must choose a valid color for wild card' };
    }
    gameState.currentColor = chosenColor;
    console.log('🎨 Color changed to:', chosenColor);
    
    if (card.type === 'wild_draw_four') {
      gameState.drawCount += 4;
      console.log(`➕ Draw count increased to: ${gameState.drawCount}`);
    }
  } else {
    gameState.currentColor = card.color;
    
    // Handle +2 stacking
    if (card.type === 'draw_two') {
      gameState.drawCount += 2;
      console.log(`➕ Draw count increased to: ${gameState.drawCount}`);
    }
  }
  
  // Handle action cards (non-draw cards)
  let skipNext = false;
  
  switch (card.type) {
    case 'skip':
      skipNext = true;
      console.log('⏭️ Skip card played - next player skipped');
      break;
      
    case 'reverse':
      gameState.direction *= -1;
      console.log('🔄 Reverse card played - direction changed');
      if (gameState.players.filter(p => !p.finished).length === 2) {
        skipNext = true;
      }
      break;
  }
  
  // Check if player finished (no cards left)
  if (player.hand.length === 0) {
    console.log('🏆 Player finished:', playerName);
    
    // Calculate points for this player based on remaining cards of others
    let points = 0;
    gameState.players.forEach(p => {
      if (p.name !== playerName && !p.finished) {
        p.hand.forEach(c => {
          if (c.type === 'number') {
            points += c.value;
          } else if (c.type === 'skip' || c.type === 'reverse' || c.type === 'draw_two') {
            points += 20;
          } else if (c.type === 'wild' || c.type === 'wild_draw_four') {
            points += 50;
          }
        });
      }
    });
    
    player.score += points;
    player.finished = true;
    
    // Assign position based on number of finished players
    const finishedCount = gameState.players.filter(p => p.finished).length;
    player.position = finishedCount;
    
    console.log(`✅ ${playerName} finished in position #${finishedCount} with ${points} points`);
    console.log(`📊 Finished players: ${finishedCount}/${gameState.players.length}`);
    
    // Count remaining active players
    const remainingPlayers = gameState.players.filter(p => !p.finished);
    const totalPlayers = gameState.players.length;
    
    console.log(`🔍 Checking game over: ${finishedCount} finished out of ${totalPlayers} total`);
    console.log(`🔍 Remaining active players: ${remainingPlayers.length}`);
    
    // Game is over when (n-1) players have finished (only 1 or 0 players remain)
    if (remainingPlayers.length <= 1) {
      console.log('🏁 Game Over - only 1 or 0 players remaining!');
      
      // Assign last position to remaining player(s)
      remainingPlayers.forEach(p => {
        p.finished = true;
        p.position = totalPlayers;
        console.log(`🏅 Assigning last position to ${p.name}: #${p.position}`);
      });
      
      // Create rankings
      const rankings = gameState.players
        .sort((a, b) => a.position - b.position)
        .map(p => ({
          name: p.name,
          position: p.position,
          points: p.score
        }));
      
      console.log('🏆 Final rankings:', rankings);
      
      return {
        success: true,
        gameState,
        playerFinished: playerName,
        finishedPosition: finishedCount,
        pointsEarned: points,
        gameOver: true,
        rankings
      };
    }
    
    console.log(`⏭️ Game continues - ${remainingPlayers.length} players still playing`);
    
    // Move to next active player
    const nextPlayerIndex = getNextActivePlayerIndex(gameState, skipNext ? 2 : 1);
    gameState.currentPlayerIndex = nextPlayerIndex;
    gameState.currentPlayer = gameState.players[nextPlayerIndex].name;
    
    console.log(`➡️ Next player: ${gameState.currentPlayer}`);
    
    return {
      success: true,
      gameState,
      playerFinished: playerName,
      finishedPosition: finishedCount,
      pointsEarned: points,
      remainingPlayers: remainingPlayers.length
    };
  }
  
  // Move to next active player
  const nextPlayerIndex = getNextActivePlayerIndex(gameState, skipNext ? 2 : 1);
  gameState.currentPlayerIndex = nextPlayerIndex;
  gameState.currentPlayer = gameState.players[nextPlayerIndex].name;
  
  console.log('✅ Card played successfully');
  console.log(`   Next player: ${gameState.currentPlayer}`);
  console.log(`   Pending draw count: ${gameState.drawCount}`);
  
  // AUTO-DRAW: If next player has draw penalty and can't stack, auto-draw for them
  if (gameState.drawCount > 0) {
    const nextPlayer = gameState.players[nextPlayerIndex];
    
    // Skip if next player has already finished
    if (nextPlayer.finished) {
      console.log(`⏭️ Next player ${nextPlayer.name} already finished, skipping auto-draw`);
      gameState.drawCount = 0;
      
      const afterFinishedIndex = getNextActivePlayerIndex(gameState, 1);
      gameState.currentPlayerIndex = afterFinishedIndex;
      gameState.currentPlayer = gameState.players[afterFinishedIndex].name;
      
      return { success: true, gameState };
    }
    
    if (!hasStackableCard(nextPlayer, gameState.currentCard)) {
      console.log(`🎴 AUTO-DRAW: ${nextPlayer.name} has no stackable cards, auto-drawing ${gameState.drawCount} cards`);
      
      // Draw cards automatically
      for (let i = 0; i < gameState.drawCount; i++) {
        if (gameState.deck.length === 0) {
          reshuffleDeck(gameState);
        }
        if (gameState.deck.length > 0) {
          nextPlayer.hand.push(gameState.deck.pop());
        }
      }
      
      console.log(`✅ AUTO-DRAW: ${nextPlayer.name} drew ${gameState.drawCount} cards. Hand size: ${nextPlayer.hand.length}`);
      
      const drawnCount = gameState.drawCount;
      gameState.drawCount = 0;
      
      // Move to next player after auto-draw
      const afterDrawIndex = getNextActivePlayerIndex(gameState, 1);
      gameState.currentPlayerIndex = afterDrawIndex;
      gameState.currentPlayer = gameState.players[afterDrawIndex].name;
      
      console.log(`⏭️ After AUTO-DRAW, next player: ${gameState.currentPlayer}`);
      
      return {
        success: true,
        gameState,
        autoDrawn: {
          playerName: nextPlayer.name,
          cardsDrawn: drawnCount
        }
      };
    }
  }
  
  return { success: true, gameState };
}

// Update getNextActivePlayerIndex with better safety

// Get next ACTIVE player index (skip finished players)
function getNextActivePlayerIndex(gameState, steps = 1) {
  const { players, currentPlayerIndex, direction } = gameState;
  const totalPlayers = players.length;
  
  // Count active players
  const activePlayers = players.filter(p => !p.finished);
  
  console.log(`🔍 Finding next active player. Active: ${activePlayers.length}/${totalPlayers}`);
  
  // If only 0 or 1 active players remain, game should be over
  if (activePlayers.length <= 1) {
    console.log('⚠️ Game should be over - 1 or 0 active players!');
    return currentPlayerIndex; // Return current, game should end
  }
  
  let nextIndex = currentPlayerIndex;
  let stepsRemaining = steps;
  let safetyCounter = 0;
  const maxIterations = totalPlayers * steps * 3; // Increased safety limit
  
  while (stepsRemaining > 0 && safetyCounter < maxIterations) {
    nextIndex = (nextIndex + direction + totalPlayers) % totalPlayers;
    safetyCounter++;
    
    // Skip finished players
    if (!players[nextIndex].finished) {
      stepsRemaining--;
    }
  }
  
  if (safetyCounter >= maxIterations) {
    console.error('⚠️ Safety limit reached in getNextActivePlayerIndex');
    console.error('   This might indicate all players are finished!');
  }
  
  console.log(`🔄 Next active player: ${nextIndex} (${players[nextIndex].name}), Finished: ${players[nextIndex].finished}`);
  
  return nextIndex;
}

// Draw a card
function drawCard(gameState, playerName) {
  console.log('🎴 drawCard called for:', playerName);
  console.log('📊 Current game state:', {
    currentPlayer: gameState.currentPlayer,
    currentPlayerIndex: gameState.currentPlayerIndex,
    drawCount: gameState.drawCount,
    players: gameState.players.map(p => ({ name: p.name, finished: p.finished }))
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
  
  // Skip if player already finished
  if (player.finished) {
    console.log('❌ Player already finished - moving to next active player');
    
    // Move to next active player automatically
    const nextPlayerIndex = getNextActivePlayerIndex(gameState, 1);
    gameState.currentPlayerIndex = nextPlayerIndex;
    gameState.currentPlayer = gameState.players[nextPlayerIndex].name;
    
    console.log(`⏭️ Skipped finished player. Next player: ${gameState.currentPlayer}`);
    
    return { 
      success: true, 
      gameState,
      skipped: true,
      message: 'Player already finished - turn skipped'
    };
  }
  
  // Determine how many cards to draw (forced draw or normal draw)
  const cardsToDraw = gameState.drawCount > 0 ? gameState.drawCount : 1;
  
  console.log(`🎴 ${playerName} drawing ${cardsToDraw} card(s)...`);
  
  for (let i = 0; i < cardsToDraw; i++) {
    // Reshuffle if deck is empty
    if (gameState.deck.length === 0) {
      console.log('🔀 Deck empty, reshuffling...');
      reshuffleDeck(gameState);
    }
    
    if (gameState.deck.length === 0) {
      console.log('❌ No cards available');
      return { success: false, message: 'No cards available in deck' };
    }
    
    const drawnCard = gameState.deck.pop();
    player.hand.push(drawnCard);
  }
  
  console.log(`✅ ${playerName} drew ${cardsToDraw} card(s). Hand size: ${player.hand.length}`);
  
  // Reset draw count after drawing
  if (gameState.drawCount > 0) {
    console.log(`🔄 Resetting draw count from ${gameState.drawCount} to 0`);
    gameState.drawCount = 0;
  }
  
  // Player MUST move to next turn after drawing (official UNO rules)
  const nextPlayerIndex = getNextActivePlayerIndex(gameState, 1);
  gameState.currentPlayerIndex = nextPlayerIndex;
  gameState.currentPlayer = gameState.players[nextPlayerIndex].name;
  
  console.log('⏭️ Turn ends after drawing. Next player:', gameState.currentPlayer);
  
  return { success: true, gameState };
}

// Get next player index (old function - keep for compatibility)
function getNextPlayerIndex(gameState, steps = 1) {
  return getNextActivePlayerIndex(gameState, steps);
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

module.exports = {
  initUNOGame,
  playCard,
  drawCard,
  canPlayCard,
  getNextPlayerIndex,
  getNextActivePlayerIndex,
  reshuffleDeck,
  hasStackableCard
};
