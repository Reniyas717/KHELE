const GameRoom = require('../models/GameRoom');

// Word bank for the game
const WORD_BANK = [
  'cat', 'dog', 'house', 'tree', 'car', 'phone', 'book', 'computer',
  'pizza', 'basketball', 'guitar', 'camera', 'rainbow', 'mountain',
  'ocean', 'airplane', 'bicycle', 'umbrella', 'robot', 'castle'
];

function getRandomWords(count = 3) {
  const shuffled = [...WORD_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function initScribbleGame(roomCode) {
  try {
    const normalizedCode = roomCode.toUpperCase().trim();
    console.log('🎨 Initializing Scribble game for room:', normalizedCode);
    
    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    
    if (!room) {
      console.error('❌ Room not found:', normalizedCode);
      throw new Error('Room not found');
    }

    console.log('✅ Room found with players:', room.players.map(p => p.username));

    if (!room.players || room.players.length === 0) {
      console.error('❌ No players in room');
      throw new Error('No players in room');
    }

    // Initialize game state
    const gameState = {
      currentRound: 1,
      maxRounds: room.settings?.maxRounds || 3,
      currentDrawer: room.players[0].username, // Set first player as drawer
      currentDrawerIndex: 0,
      currentWord: '',
      wordOptions: getRandomWords(3),
      roundActive: false,
      roundTimer: room.settings?.drawTime || 80,
      players: room.players.map(p => ({
        username: p.username,
        score: 0,
        hasGuessed: false,
        isDrawing: p.username === room.players[0].username
      }))
    };

    console.log('🎯 Game state initialized:', {
      currentDrawer: gameState.currentDrawer,
      currentDrawerIndex: gameState.currentDrawerIndex,
      players: gameState.players.map(p => ({ username: p.username, isDrawing: p.isDrawing })),
      wordOptions: gameState.wordOptions
    });

    // Save game state to room
    room.gameState = gameState;
    room.markModified('gameState');
    await room.save();

    console.log('💾 Game state saved to database');
    
    // Verify it was saved
    const verifyRoom = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    console.log('✅ Verified saved currentDrawer:', verifyRoom.gameState.currentDrawer);
    console.log('✅ Verified saved players:', verifyRoom.gameState.players.map(p => p.username));

    return gameState;
  } catch (error) {
    console.error('❌ Error initializing Scribble game:', error);
    console.error('❌ Stack:', error.stack);
    throw error;
  }
}

function selectWord(gameState, word) {
  console.log('📝 Selecting word:', word);
  
  gameState.currentWord = word;
  gameState.roundActive = true;
  gameState.wordOptions = []; // Clear word options after selection
  
  // Reset hasGuessed for all players
  gameState.players.forEach(p => {
    p.hasGuessed = false;
  });

  console.log('✅ Word selected, round active');
  
  return gameState;
}

function handleGuess(gameState, username, guess) {
  console.log('🎯 Processing guess:', { username, guess, currentWord: gameState.currentWord });
  
  // Don't allow drawer to guess
  if (username === gameState.currentDrawer) {
    return { 
      success: true, 
      correct: false, 
      message: 'Drawer cannot guess' 
    };
  }

  // Check if player already guessed
  const player = gameState.players.find(p => p.username === username);
  if (player?.hasGuessed) {
    return { 
      success: true, 
      correct: false, 
      message: 'Already guessed correctly' 
    };
  }

  // Check if guess is correct (case-insensitive)
  const isCorrect = guess.toLowerCase().trim() === gameState.currentWord.toLowerCase().trim();
  
  if (isCorrect) {
    // Calculate points (more points for guessing earlier)
    const remainingPlayers = gameState.players.filter(p => 
      !p.hasGuessed && p.username !== gameState.currentDrawer
    ).length;
    const points = Math.max(100, remainingPlayers * 50);
    
    // Update player
    player.hasGuessed = true;
    player.score += points;
    
    // Give points to drawer too
    const drawer = gameState.players.find(p => p.username === gameState.currentDrawer);
    if (drawer) {
      drawer.score += 25;
    }

    console.log(`✅ Correct guess! ${username} earned ${points} points`);
    
    // Check if all players have guessed
    const allGuessed = gameState.players.every(p => 
      p.hasGuessed || p.username === gameState.currentDrawer
    );

    return {
      success: true,
      correct: true,
      points,
      gameState,
      allGuessed
    };
  }

  return {
    success: true,
    correct: false,
    message: 'Wrong guess'
  };
}

function nextRound(gameState) {
  console.log('➡️ Moving to next round');
  
  // Move to next drawer
  gameState.currentDrawerIndex = (gameState.currentDrawerIndex + 1) % gameState.players.length;
  
  // Check if we completed all rounds
  if (gameState.currentDrawerIndex === 0) {
    gameState.currentRound++;
  }

  console.log('📊 Round info:', {
    currentRound: gameState.currentRound,
    maxRounds: gameState.maxRounds,
    currentDrawerIndex: gameState.currentDrawerIndex
  });

  // Check if game is over
  if (gameState.currentRound > gameState.maxRounds) {
    console.log('🏁 Game over!');
    
    const rankings = gameState.players
      .sort((a, b) => b.score - a.score)
      .map((p, index) => ({
        position: index + 1,
        username: p.username,
        score: p.score
      }));

    return {
      gameOver: true,
      rankings
    };
  }

  // Set new drawer
  gameState.currentDrawer = gameState.players[gameState.currentDrawerIndex].username;
  gameState.currentWord = '';
  gameState.wordOptions = getRandomWords(3);
  gameState.roundActive = false;
  
  // Reset all players
  gameState.players.forEach(p => {
    p.hasGuessed = false;
    p.isDrawing = p.username === gameState.currentDrawer;
  });

  console.log('✅ Next round ready:', {
    round: gameState.currentRound,
    drawer: gameState.currentDrawer,
    wordOptions: gameState.wordOptions
  });

  return {
    gameOver: false,
    gameState
  };
}

module.exports = {
  initScribbleGame,
  handleGuess,
  nextRound,
  selectWord
};
