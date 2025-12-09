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
  console.log('📝 selectWord called with word:', word);
  console.log('📋 Available word options:', gameState.wordOptions);
  
  if (!gameState.wordOptions || !gameState.wordOptions.includes(word)) {
    console.error('❌ Invalid word selection:', word);
    return { success: false, message: 'Invalid word selection' };
  }
  
  gameState.currentWord = word;
  gameState.drawingStarted = true;
  gameState.wordOptions = [];
  
  console.log('✅ Word selected successfully:', word);
  console.log('🎨 Drawing started');
  
  return {
    success: true,
    gameState,
    message: `Word selected: ${word}`
  };
}

function handleGuess(gameState, username, guess) {
  const player = gameState.players.find(p => p.username === username);
  
  if (!player) {
    return { correct: false, message: 'Player not found' };
  }
  
  if (username === gameState.currentDrawer) {
    return { correct: false, message: 'Drawer cannot guess' };
  }
  
  if (player.hasGuessed) {
    return { correct: false, message: 'Already guessed' };
  }
  
  const isCorrect = guess.toLowerCase().trim() === gameState.currentWord.toLowerCase().trim();
  
  if (isCorrect) {
    player.hasGuessed = true;
    player.score += 100;
    
    // Award points to drawer
    const drawer = gameState.players.find(p => p.username === gameState.currentDrawer);
    if (drawer) {
      drawer.score += 50;
    }
    
    // Check if all players have guessed
    const allGuessed = gameState.players.every(p => 
      p.username === gameState.currentDrawer || p.hasGuessed
    );
    
    gameState.allGuessed = allGuessed;
    
    return {
      correct: true,
      gameState,
      message: `${username} guessed correctly!`
    };
  }
  
  return { correct: false, message: 'Wrong guess' };
}

function nextRound(gameState) {
  // Move to next drawer
  gameState.currentDrawerIndex = (gameState.currentDrawerIndex + 1) % gameState.players.length;
  
  // Check if round is complete
  if (gameState.currentDrawerIndex === 0) {
    gameState.round++;
  }
  
  // Check if game is over
  if (gameState.round > gameState.maxRounds) {
    const winner = gameState.players.reduce((prev, current) => 
      (prev.score > current.score) ? prev : current
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
  
  // Reset for next round
  gameState.players.forEach(p => p.hasGuessed = false);
  gameState.currentDrawer = gameState.players[gameState.currentDrawerIndex].username;
  gameState.wordOptions = getRandomWords(3);
  gameState.currentWord = null;
  gameState.allGuessed = false;
  gameState.drawingStarted = false;
  gameState.timeLeft = 90;
  
  console.log('🔄 Next round initialized');
  console.log('👤 New drawer:', gameState.currentDrawer);
  console.log('📝 New word options:', gameState.wordOptions);
  
  return {
    gameOver: false,
    gameState
  };
}

module.exports = {
  initScribbleGame,
  selectWord,
  handleGuess,
  nextRound
};
