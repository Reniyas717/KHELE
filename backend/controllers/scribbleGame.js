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

function handleGuess(gameState, username, guess) {
  console.log('🔍 Processing guess:', { username, guess, currentWord: gameState.currentWord });

  // Don't let drawer guess
  const player = gameState.players.find(p => p.username === username);
  if (!player) {
    console.log('❌ Player not found');
    return { correct: false };
  }

  if (username === gameState.currentDrawer) {
    console.log('❌ Drawer cannot guess');
    return { correct: false, message: 'You cannot guess your own drawing!' };
  }

  // Check if already guessed
  if (player.hasGuessed) {
    console.log('❌ Player already guessed');
    return { correct: false, message: 'You already guessed!' };
  }

  // Check if guess is correct (case insensitive)
  const isCorrect = guess.toLowerCase().trim() === gameState.currentWord.toLowerCase().trim();
  
  if (isCorrect) {
    console.log('✅ Correct guess!');
    
    // Calculate points based on how many have guessed
    const guessedCount = gameState.players.filter(p => p.hasGuessed).length;
    const basePoints = 100;
    const points = Math.max(basePoints - (guessedCount * 20), 20); // First: 100, Second: 80, Third: 60, etc., min 20
    
    // Award points to guesser
    player.score += points;
    player.hasGuessed = true;

    // Award points to drawer (50 points per correct guess)
    const drawer = gameState.players.find(p => p.username === gameState.currentDrawer);
    if (drawer) {
      drawer.score += 50;
    }

    // Check if everyone guessed
    const nonDrawerPlayers = gameState.players.filter(p => p.username !== gameState.currentDrawer);
    const allGuessed = nonDrawerPlayers.every(p => p.hasGuessed);
    
    if (allGuessed) {
      gameState.allGuessed = true;
      console.log('🎉 Everyone guessed!');
    }

    return { 
      correct: true, 
      points, 
      allGuessed,
      gameState 
    };
  }

  console.log('❌ Incorrect guess');
  return { 
    correct: false, 
    message: guess // Send back the guess for chat display
  };
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

function selectWord(gameState, word) {
  console.log('📝 Word selected:', word);
  gameState.currentWord = word;
  gameState.drawingStarted = true;
  gameState.wordOptions = [];
  return gameState;
}

module.exports = {
  initScribbleGame,
  handleGuess,
  nextRound,
  selectWord,
  getRandomWords
};
