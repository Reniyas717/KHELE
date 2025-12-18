// Word bank from the gist
const WORD_BANK = [
  'airplane', 'apple', 'arm', 'banana', 'bear', 'bed', 'bicycle', 'bird', 'book', 'bread',
  'bridge', 'bucket', 'butterfly', 'camera', 'candle', 'car', 'cat', 'chair', 'church', 'clock',
  'cloud', 'computer', 'cow', 'cup', 'dog', 'door', 'dragon', 'drums', 'duck', 'ear',
  'elephant', 'eye', 'face', 'fan', 'fish', 'flower', 'foot', 'fork', 'frog', 'ghost',
  'glasses', 'guitar', 'hammer', 'hand', 'hat', 'heart', 'horse', 'house', 'ice cream', 'key',
  'knife', 'ladder', 'lamp', 'laptop', 'leaf', 'leg', 'light bulb', 'lion', 'lips', 'microphone',
  'monkey', 'moon', 'mountain', 'mouse', 'mouth', 'mushroom', 'nose', 'ocean', 'octopus', 'pants',
  'pencil', 'phone', 'piano', 'pig', 'pizza', 'planet', 'rabbit', 'radio', 'rainbow', 'ring',
  'rocket', 'scissors', 'shark', 'sheep', 'shirt', 'shoe', 'snake', 'snowman', 'spider', 'spoon',
  'star', 'sun', 'table', 'teeth', 'tiger', 'toothbrush', 'tree', 'triangle', 'truck', 'umbrella',
  'volcano', 'watch', 'watermelon', 'whale', 'wheel', 'window', 'zebra'
];

function getRandomWords(count = 3) {
  const shuffled = [...WORD_BANK].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function initScribbleGame(players) {
  // Shuffle players for drawing order
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
  
  const gameState = {
    players: shuffledPlayers.map(username => ({
      username,
      score: 0,
      hasGuessed: false
    })),
    currentDrawer: shuffledPlayers[0],
    currentDrawerIndex: 0,
    currentWord: null,
    wordOptions: getRandomWords(3), // 3 word choices
    round: 1,
    maxRounds: players.length * 3, // Each player draws 3 times
    roundActive: false,
    roundTimer: 60, // 60 seconds per round
    roundStartTime: null,
    scores: {}
  };
  
  console.log('🎮 Scribble game initialized:', {
    players: shuffledPlayers,
    maxRounds: gameState.maxRounds,
    firstDrawer: gameState.currentDrawer
  });
  
  return gameState;
}

function selectWord(gameState, word) {
  console.log('📝 selectWord called:', { word, currentDrawer: gameState.currentDrawer });
  
  if (!gameState.wordOptions || !gameState.wordOptions.includes(word)) {
    console.error('❌ Invalid word selection:', word);
    return gameState;
  }

  // Set the word
  gameState.currentWord = word;
  gameState.wordOptions = []; // Clear options after selection
  gameState.roundActive = true;
  gameState.roundStartTime = Date.now();
  
  // Reset hasGuessed for all players
  gameState.players.forEach(player => {
    if (player.username === gameState.currentDrawer) {
      player.hasGuessed = true; // Drawer is marked as "guessed"
    } else {
      player.hasGuessed = false;
    }
  });
  
  console.log('✅ Word set successfully:', {
    currentWord: gameState.currentWord,
    roundActive: gameState.roundActive,
    roundStartTime: gameState.roundStartTime,
    playersWhoNeedToGuess: gameState.players.filter(p => !p.hasGuessed).length
  });
  
  return gameState;
}

function handleGuess(gameState, username, guess) {
  console.log('🔍 Processing guess:', { 
    username, 
    guess, 
    currentWord: gameState.currentWord,
    roundActive: gameState.roundActive
  });

  // Check if game state is valid
  if (!gameState.currentWord) {
    console.error('❌ No current word set in game state');
    return { success: false, correct: false, message: 'No word to guess' };
  }

  if (!gameState.roundActive) {
    console.error('❌ Round is not active');
    return { success: false, correct: false, message: 'Round not active' };
  }

  // Find the player
  const player = gameState.players.find(p => p.username === username);
  
  if (!player) {
    console.error('❌ Player not found:', username);
    return { success: false, correct: false, message: 'Player not found' };
  }

  // Check if player is the drawer
  if (username === gameState.currentDrawer) {
    console.log('⚠️ Drawer cannot guess');
    return { success: false, correct: false, message: 'Drawer cannot guess' };
  }

  // Check if player has already guessed
  if (player.hasGuessed) {
    console.log('⚠️ Player already guessed:', username);
    return { success: false, correct: false, message: 'Already guessed' };
  }

  // Check if guess is correct (case insensitive)
  const isCorrect = guess.toLowerCase().trim() === gameState.currentWord.toLowerCase().trim();
  
  console.log('🎯 Guess comparison:', {
    guess: guess.toLowerCase().trim(),
    currentWord: gameState.currentWord.toLowerCase().trim(),
    isCorrect
  });

  if (isCorrect) {
    // Mark player as having guessed
    player.hasGuessed = true;
    
    // Award points based on time and order
    const timeElapsed = Date.now() - gameState.roundStartTime;
    const timeBonus = Math.max(0, Math.floor((gameState.roundTimer * 1000 - timeElapsed) / 100));
    const playersWhoGuessed = gameState.players.filter(p => p.hasGuessed && p.username !== gameState.currentDrawer).length;
    const orderBonus = Math.max(100 - (playersWhoGuessed - 1) * 20, 20);
    const points = orderBonus + timeBonus;
    
    player.score += points;
    
    console.log(`✅ Correct guess! ${username} earned ${points} points (order: ${orderBonus}, time: ${timeBonus})`);
    
    // Check if all non-drawer players have guessed
    const totalPlayers = gameState.players.length;
    const playersWhoNeedToGuess = totalPlayers - 1; // Everyone except drawer
    const playersWhoHaveGuessed = gameState.players.filter(p => p.hasGuessed && p.username !== gameState.currentDrawer).length;
    
    console.log('📊 Guess progress:', {
      totalPlayers,
      playersWhoNeedToGuess,
      playersWhoHaveGuessed,
      allGuessed: playersWhoHaveGuessed >= playersWhoNeedToGuess
    });
    
    const allGuessed = playersWhoHaveGuessed >= playersWhoNeedToGuess;
    
    if (allGuessed) {
      console.log('🎉 All players have guessed correctly!');
      gameState.roundActive = false;
    }
    
    return {
      success: true,
      correct: true,
      points,
      gameState,
      allGuessed
    };
  } else {
    console.log('❌ Wrong guess');
    return {
      success: true,
      correct: false,
      gameState
    };
  }
}

function nextRound(gameState) {
  console.log('➡️ Moving to next round');
  
  // End current round
  gameState.roundActive = false;
  gameState.currentWord = null;
  gameState.roundStartTime = null;
  
  // Reset hasGuessed for all players
  gameState.players.forEach(player => {
    player.hasGuessed = false;
  });
  
  // Check if game is over
  if (gameState.round >= gameState.maxRounds) {
    console.log('🏁 Game Over!');
    
    const finalScores = gameState.players
      .sort((a, b) => b.score - a.score)
      .map((player, index) => ({
        position: index + 1,
        username: player.username,
        score: player.score
      }));
    
    return {
      gameOver: true,
      gameState,
      finalScores
    };
  }
  
  // Move to next drawer
  gameState.round++;
  gameState.currentDrawerIndex = (gameState.currentDrawerIndex + 1) % gameState.players.length;
  gameState.currentDrawer = gameState.players[gameState.currentDrawerIndex].username;
  gameState.wordOptions = getRandomWords(3);
  
  console.log('✅ Next round ready:', {
    round: gameState.round,
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
  selectWord,
  getRandomWords
};
