const GameRoom = require('../models/GameRoom');

class ScribbleGame {
  constructor(roomCode) {
    this.roomCode = roomCode;
    this.words = ['elephant', 'pizza', 'guitar', 'rocket', 'rainbow', 'computer', 'mountain', 'butterfly', 'airplane', 'lighthouse'];
    this.currentWord = '';
    this.currentDrawer = null;
    this.guessedPlayers = [];
    this.roundNumber = 1;
    this.maxRounds = 3;
  }

  async initialize(players) {
    this.currentDrawer = players[0].username;
    this.currentWord = this.getRandomWord();
    
    return {
      type: 'scribble',
      currentDrawer: this.currentDrawer,
      roundNumber: this.roundNumber,
      maxRounds: this.maxRounds,
      wordLength: this.currentWord.length,
      guessedPlayers: []
    };
  }

  getRandomWord() {
    return this.words[Math.floor(Math.random() * this.words.length)];
  }

  getCurrentWord() {
    return this.currentWord;
  }

  checkGuess(username, guess) {
    const cleanGuess = guess.toLowerCase().trim();
    const isCorrect = cleanGuess === this.currentWord.toLowerCase();
    
    if (isCorrect && !this.guessedPlayers.includes(username) && username !== this.currentDrawer) {
      this.guessedPlayers.push(username);
      return { correct: true, points: 100 };
    }
    
    return { correct: false, points: 0 };
  }

  async nextRound(players) {
    const currentIndex = players.findIndex(p => p.username === this.currentDrawer);
    const nextIndex = (currentIndex + 1) % players.length;
    
    this.currentDrawer = players[nextIndex].username;
    this.currentWord = this.getRandomWord();
    this.guessedPlayers = [];
    
    if (nextIndex === 0) {
      this.roundNumber++;
    }
    
    return {
      currentDrawer: this.currentDrawer,
      roundNumber: this.roundNumber,
      wordLength: this.currentWord.length,
      guessedPlayers: [],
      gameOver: this.roundNumber > this.maxRounds
    };
  }
}

module.exports = ScribbleGame;
