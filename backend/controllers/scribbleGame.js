// Word list for the game
const WORDS = [
  'cat', 'dog', 'house', 'tree', 'car', 'sun', 'moon', 'star', 'fish', 'bird',
  'apple', 'banana', 'pizza', 'burger', 'coffee', 'phone', 'computer', 'book',
  'mountain', 'beach', 'flower', 'rainbow', 'guitar', 'piano', 'camera', 'clock',
  'rocket', 'airplane', 'bicycle', 'boat', 'train', 'umbrella', 'crown', 'diamond',
  'elephant', 'giraffe', 'penguin', 'butterfly', 'dragon', 'castle', 'bridge',
  'lighthouse', 'windmill', 'telescope', 'microphone', 'headphones', 'sunglasses'
];

// Initialize a new Scribble game
function initScribbleGame(playerUsernames) {
  const players = playerUsernames.map(username => ({
    username: username,
    score: 0,
    hasGuessed: false
  }));

  // Shuffle players to randomize drawing order
  shuffleArray(players);

  return {
    players: players,
    currentDrawerIndex: 0,
    currentDrawer: players[0].username,
    currentWord: getRandomWord(),
    round: 1,
    maxRounds: 3,
    timeLeft: 90, // 90 seconds per round
    allGuessed: false
  };
}

// Get a random word from the list
function getRandomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

// Shuffle array helper
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Handle a player's guess
function handleGuess(gameState, username, guess) {
  // Normalize both strings for comparison (lowercase, trim)
  const normalizedGuess = guess.toLowerCase().trim();
  const normalizedWord = gameState.currentWord.toLowerCase().trim();

  // Check if guess is correct
  if (normalizedGuess === normalizedWord) {
    // Find the player and mark as guessed
    const player = gameState.players.find(p => p.username === username);
    if (player && !player.hasGuessed) {
      player.hasGuessed = true;
      player.score += 10; // Award points

      // Check if all players (except drawer) have guessed
      const nonDrawers = gameState.players.filter(p => p.username !== gameState.currentDrawer);
      const allGuessed = nonDrawers.every(p => p.hasGuessed);
      
      if (allGuessed) {
        gameState.allGuessed = true;
      }

      return { correct: true, word: gameState.currentWord };
    }
  }

  return { correct: false };
}

// Move to next round
function nextRound(gameState) {
  // Move to next drawer
  gameState.currentDrawerIndex = (gameState.currentDrawerIndex + 1) % gameState.players.length;
  gameState.currentDrawer = gameState.players[gameState.currentDrawerIndex].username;
  
  // Reset guess flags
  gameState.players.forEach(p => p.hasGuessed = false);
  gameState.allGuessed = false;

  // Check if we've completed all rounds
  if (gameState.currentDrawerIndex === 0) {
    gameState.round++;
  }

  // Check for game over
  if (gameState.round > gameState.maxRounds) {
    // Find winner (highest score)
    const winner = gameState.players.reduce((prev, current) => 
      (current.score > prev.score) ? current : prev
    );

    const finalScores = {};
    gameState.players.forEach(p => {
      finalScores[p.username] = p.score;
    });

    return { 
      gameOver: true, 
      winner: winner.username,
      scores: finalScores
    };
  }

  // New word for new round
  gameState.currentWord = getRandomWord();
  gameState.timeLeft = 90;

  return { gameOver: false };
}

module.exports = {
  initScribbleGame,
  handleGuess,
  nextRound
};
