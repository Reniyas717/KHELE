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

function initUNOGame(players) {
  // Validate input
  if (!players || !Array.isArray(players)) {
    console.error('❌ Invalid players:', players);
    throw new Error('players must be an array');
  }

  // Extract player names for hands
  const playerNames = players.map(p => typeof p === 'string' ? p : p.username);

  console.log('🎮 Initializing UNO game for players:', playerNames);

  // Create and shuffle deck
  let deck = shuffleDeck(createDeck());

  // Deal 7 cards to each player
  const hands = {};
  for (const name of playerNames) {
    hands[name] = deck.splice(0, 7);
    console.log(`🃏 Dealt 7 cards to ${name}`);
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
    players: players.map((player, index) => {
      // Handle both string names and player objects
      const isString = typeof player === 'string';
      const username = isString ? player : player.username;

      console.log(`🔍 Processing player ${index}:`, {
        type: isString ? 'string' : 'object',
        username,
        hasIsBot: !isString && 'isBot' in player,
        isBotValue: !isString ? player.isBot : undefined
      });

      if (isString) {
        return {
          username: player,
          name: player,
          cardCount: 7,
          isBot: false,
          difficulty: 'medium',
          isFinished: false,
          finishPosition: null,
          points: 0
        };
      } else {
        // Player is an object - preserve all bot properties
        const playerObj = {
          username: player.username,
          name: player.username,
          cardCount: 7,
          isBot: player.isBot === true,
          difficulty: player.difficulty || 'medium',
          isFinished: false,
          finishPosition: null,
          points: 0
        };

        console.log(`✅ Created player object:`, playerObj);
        return playerObj;
      }
    }),
    currentColor: startingCard.color,
    currentValue: startingCard.value,
    gameOver: false,
    winner: null,
    drawStack: 0, // Track accumulated draw penalties for stacking
    drawStackActive: false, // Whether stack must be resolved
    rankings: [], // Track finish order: [{username, position, finishTime, points}]
    activePlayers: playerNames.length, // Count of players still in game
    finishedPlayers: [] // List of usernames who finished
  };

  console.log('✅ UNO game initialized:', {
    playerCount: playerNames.length,
    currentPlayer: gameState.currentPlayer,
    topCard: { color: gameState.currentColor, value: gameState.currentValue },
    bots: gameState.players.filter(p => p.isBot).map(p => p.username)
  });

  return gameState;
}

// Calculate points based on finish position
function calculatePoints(position, totalPlayers) {
  // Points decrease by position
  // Example: 5 players → [100, 75, 50, 25, 0]
  const maxPoints = 100;
  if (totalPlayers <= 1) return maxPoints;

  const pointsPerRank = maxPoints / (totalPlayers - 1);
  return Math.max(0, Math.round(maxPoints - (position - 1) * pointsPerRank));
}

// Handle player completion when they run out of cards
function handlePlayerCompletion(gameState, username) {
  const hand = gameState.hands[username];

  if (hand.length !== 0) return false;

  // Mark player as finished
  const playerState = gameState.players.find(p => p.username === username);
  if (!playerState || playerState.isFinished) return false;

  playerState.isFinished = true;
  playerState.cardCount = 0;

  // Calculate position (1-indexed)
  const position = gameState.finishedPlayers.length + 1;
  playerState.finishPosition = position;

  // Calculate points
  const totalPlayers = gameState.players.length;
  const points = calculatePoints(position, totalPlayers);
  playerState.points = points;

  // Add to finished list
  const finishRecord = {
    username,
    position,
    finishTime: Date.now(),
    points
  };

  gameState.finishedPlayers.push(finishRecord);
  gameState.rankings.push(finishRecord); // Keep for compatibility

  gameState.activePlayers--;

  console.log(`🏆 ${username} finished in position ${position} (${points} points)`);
  console.log(`📊 Active players remaining: ${gameState.activePlayers}`);

  // Check if game is over (only 1 active player left)
  if (gameState.activePlayers === 1) {
    handleGameEnd(gameState);
  }

  return true;
}

// Handle game end when only 1 player has cards remaining
function handleGameEnd(gameState) {
  // Find last remaining player and mark them as finished
  const lastPlayer = gameState.players.find(p => !p.isFinished);

  if (lastPlayer) {
    lastPlayer.isFinished = true;
    lastPlayer.finishPosition = gameState.finishedPlayers.length + 1;
    lastPlayer.points = 0; // Last place gets 0 points

    const finishRecord = {
      username: lastPlayer.username,
      position: lastPlayer.finishPosition,
      finishTime: Date.now(),
      points: 0
    };

    gameState.finishedPlayers.push(finishRecord);
    gameState.rankings.push(finishRecord);

    console.log(`📉 ${lastPlayer.username} finished last (0 points)`);
  }

  gameState.gameOver = true;
  gameState.winner = gameState.finishedPlayers[0].username; // 1st place
  gameState.activePlayers = 0;

  console.log('🏆 Game Over! Final Rankings:', gameState.finishedPlayers);
}

// Advance turn, skipping finished players
function advanceTurn(gameState, skipCount = 1) {
  const totalPlayers = gameState.players.length;
  let attempts = 0;
  let nextIndex = gameState.currentPlayerIndex;

  // Advance by skipCount, skipping finished players
  while (attempts < totalPlayers * 2) { // Prevent infinite loop
    nextIndex = (nextIndex + gameState.direction + totalPlayers) % totalPlayers;

    const nextPlayer = gameState.players[nextIndex];

    // Skip finished players
    if (!nextPlayer.isFinished) {
      skipCount--;
      if (skipCount === 0) {
        // Found the next active player
        gameState.currentPlayerIndex = nextIndex;
        gameState.currentPlayer = nextPlayer.username;
        console.log(`➡️ Turn advanced to ${nextPlayer.username}`);
        return true;
      }
    }

    attempts++;
  }

  // Fallback: no active players found (shouldn't happen)
  console.error('❌ No active players found in turn advancement');
  return false;
}

function canPlayCard(card, currentColor, currentValue, drawStack = 0) {
  // CRITICAL: Check stacking rules FIRST (before wild card check)
  // This ensures regular wilds can't be played on draw stacks
  if (drawStack > 0) {
    if (currentValue === 'draw2') {
      // On +2: can play +2 or +4
      return card.value === 'draw2' || card.value === 'wild_draw4';
    } else if (currentValue === 'wild_draw4') {
      // On +4: can ONLY play +4 (NOT +2, NOT regular wild)
      return card.value === 'wild_draw4';
    }
    // If stack exists but current isn't a draw card, can't play anything
    return false;
  }

  // Wild cards can be played (when no stack active)
  if (card.color === 'wild') {
    return true;
  }

  // Normal play: match color or value
  return card.color === currentColor || card.value === currentValue;
}

// Handle forced draw when player can't stack
function handleForcedDraw(gameState, username) {
  const drawAmount = gameState.drawStack;

  if (drawAmount === 0) {
    return { success: false, message: 'No draw stack active' };
  }

  console.log(`📥 ${username} must draw ${drawAmount} cards (cannot stack)`);

  const hand = gameState.hands[username];
  const drawnCards = [];

  // Draw the stacked amount
  for (let i = 0; i < drawAmount; i++) {
    // Reshuffle if needed
    if (gameState.deck.length === 0) {
      const topCard = gameState.discardPile.pop();
      gameState.deck = shuffleDeck(gameState.discardPile);
      gameState.discardPile = [topCard];
      console.log('🔄 Reshuffled discard pile into deck');
    }

    if (gameState.deck.length > 0) {
      const card = gameState.deck.pop();
      hand.push(card);
      drawnCards.push(card);
    }
  }

  // Update player state
  const playerState = gameState.players.find(p => p.username === username);
  if (playerState) {
    playerState.cardCount = hand.length;
    playerState.hasCalledUno = false;
  }

  // Reset draw stack
  gameState.drawStack = 0;
  gameState.drawStackActive = false;

  console.log(`✅ ${username} drew ${drawnCards.length} cards`);

  // Skip this player's turn (they drew, can't play)
  advanceTurn(gameState, 1);

  console.log(`⏭️ ${username}'s turn skipped after forced draw`);

  return { success: true, gameState, drawnCards, forcedDraw: true };
}

function playCard(gameState, username, cardId, chosenColor = null) {
  console.log('🃏 Playing card:', { username, cardId, chosenColor, currentDrawStack: gameState.drawStack });

  // Verify it's player's turn
  if (gameState.currentPlayer !== username) {
    return { success: false, message: 'Not your turn' };
  }

  // Check if player is already finished
  const playerState = gameState.players.find(p => p.username === username);
  if (playerState && playerState.isFinished) {
    return { success: false, message: 'You have already finished the game' };
  }

  // Find card in player's hand
  const hand = gameState.hands[username];
  const cardIndex = hand.findIndex(c => c.id === cardId);

  if (cardIndex === -1) {
    return { success: false, message: 'Card not in hand' };
  }

  const card = hand[cardIndex];

  // Check if card can be played (with stacking rules)
  if (!canPlayCard(card, gameState.currentColor, gameState.currentValue, gameState.drawStack)) {
    // If there's an active draw stack and player can't stack, force draw
    if (gameState.drawStack > 0) {
      console.log(`❌ ${username} cannot stack, forcing draw`);
      return handleForcedDraw(gameState, username);
    }
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
  if (playerState) {
    playerState.cardCount = hand.length;
  }

  // Check for player completion
  if (hand.length === 0) {
    const completed = handlePlayerCompletion(gameState, username);
    if (completed && gameState.gameOver) {
      console.log(`🎉 Game over! ${gameState.winner} wins!`);
      return { success: true, gameState, playerFinished: true, gameOver: true };
    }
    if (completed) {
      // Player finished but game continues
      console.log(`✅ ${username} completed, game continues`);
      advanceTurn(gameState, 1);
      return { success: true, gameState, playerFinished: true };
    }
  }

  // Handle action cards and stacking
  let skipNext = false;

  if (card.value === 'skip') {
    skipNext = true;
    // Reset draw stack when non-draw card is played
    gameState.drawStack = 0;
    gameState.drawStackActive = false;
    console.log('⏭️ Skip card played');
  } else if (card.value === 'reverse') {
    gameState.direction *= -1;
    // Reset draw stack when non-draw card is played
    gameState.drawStack = 0;
    gameState.drawStackActive = false;
    console.log(`🔄 Direction reversed (now ${gameState.direction === 1 ? 'clockwise' : 'counter-clockwise'})`);
    // In 2-player, reverse acts like skip
    if (gameState.activePlayers === 2) {
      skipNext = true;
    }
  } else if (card.value === 'draw2') {
    // Add to stack
    gameState.drawStack += 2;
    gameState.drawStackActive = true;
    console.log(`📚 Draw stack increased to ${gameState.drawStack}`);
  } else if (card.value === 'wild_draw4') {
    // Add to stack
    gameState.drawStack += 4;
    gameState.drawStackActive = true;
    console.log(`📚 Draw stack increased to ${gameState.drawStack}`);
  } else {
    // Normal card (number or wild) - reset draw stack
    gameState.drawStack = 0;
    gameState.drawStackActive = false;
  }

  // Advance turn (skip finished players)
  advanceTurn(gameState, skipNext ? 2 : 1);

  // Reset UNO call
  if (playerState) {
    playerState.hasCalledUno = hand.length === 1;
  }

  console.log('✅ Card played successfully');

  return { success: true, gameState };
}

function drawCard(gameState, username) {
  console.log('📥 Drawing card for:', username);

  // Verify it's player's turn
  if (gameState.currentPlayer !== username) {
    return { success: false, message: 'Not your turn' };
  }

  // Check if player is already finished
  const playerState = gameState.players.find(p => p.username === username);
  if (playerState && playerState.isFinished) {
    return { success: false, message: 'You have already finished the game' };
  }

  // If there's an active draw stack, player must draw the stack
  if (gameState.drawStack > 0) {
    console.log(`⚠️ Active draw stack detected, forcing draw of ${gameState.drawStack} cards`);
    return handleForcedDraw(gameState, username);
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
  if (playerState) {
    playerState.cardCount = gameState.hands[username].length;
    playerState.hasCalledUno = false;
  }

  // Move to next player (skip finished players)
  advanceTurn(gameState, 1);

  console.log('✅ Card drawn, next player:', gameState.currentPlayer);

  return { success: true, gameState, drawnCard: card };
}

module.exports = {
  initUNOGame,
  playCard,
  drawCard,
  canPlayCard,
  handlePlayerCompletion,
  handleForcedDraw,
  advanceTurn
};
