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
  console.log('✏️ Initializing Scribble game for players:', players);
  
  const wordOptions = getRandomWords(3);
  console.log('📝 Generated word options:', wordOptions);
  
  const gameState = {
    players: players.map(username => ({
      username,
      score: 0,
      hasGuessed: false
    })),
    currentDrawerIndex: 0,
    currentDrawer: players[0],
    wordOptions: wordOptions,
    currentWord: null,
    round: 1,
    maxRounds: 3,
    timeLeft: 90,
    allGuessed: false,
    drawingStarted: false
  };

  console.log('✅ Scribble game state created');
  console.log('👤 Current drawer:', gameState.currentDrawer);
  console.log('📝 Word options:', gameState.wordOptions);
  
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
  
  // Reset hasGuessed for all players except drawer
  gameState.players.forEach(player => {
    player.hasGuessed = player.username === gameState.currentDrawer;
  });
  
  console.log('✅ Word set successfully:', {
    currentWord: gameState.currentWord,
    roundActive: gameState.roundActive
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
    
    // Award points (more points for guessing earlier)
    const playersWhoGuessed = gameState.players.filter(p => p.hasGuessed && p.username !== gameState.currentDrawer).length;
    const points = Math.max(100 - (playersWhoGuessed - 1) * 20, 20);
    player.score += points;
    
    console.log(`✅ Correct guess! ${username} earned ${points} points`);
    
    // Check if all players have guessed
    const allGuessed = gameState.players
      .filter(p => p.username !== gameState.currentDrawer)
      .every(p => p.hasGuessed);
    
    if (allGuessed) {
      console.log('🎉 All players have guessed!');
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
  
  // Reset hasGuessed for all players
  gameState.players.forEach(p => p.hasGuessed = false);
  
  // Move to next drawer
  const currentIndex = gameState.players.findIndex(p => p.username === gameState.currentDrawer);
  const nextIndex = (currentIndex + 1) % gameState.players.length;
  
  // If we've gone through all players, increment round
  if (nextIndex === 0) {
    gameState.round += 1;
  }
  
  // Check if game is over
  if (gameState.round > gameState.maxRounds) {
    const winner = gameState.players.reduce((max, p) => 
      p.score > max.score ? p : max
    );
    
    return {
      gameOver: true,
      winner: winner.username,
      finalScores: gameState.players.map(p => ({
        username: p.username,
        score: p.score
      }))
    };
  }
  
  // Set new drawer
  gameState.currentDrawer = gameState.players[nextIndex].username;
  gameState.currentWord = null;
  gameState.drawingStarted = false;
  gameState.allGuessed = false;
  gameState.wordOptions = getRandomWords(3);
  
  return { gameState };
}

module.exports = {
  initScribbleGame,
  handleGuess,
  nextRound,
  selectWord,
  getRandomWords
};
