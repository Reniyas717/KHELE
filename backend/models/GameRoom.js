
const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    default: 0
  }
});

const gameRoomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  host: {
    type: String,
    required: true
  },
  gameType: {
    type: String,
    enum: ['scribble', 'uno'],
    required: true
  },
  players: [playerSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  gameState: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  currentGame: {
    type: String,
    enum: ['scribble', 'uno', null],
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('GameRoom', gameRoomSchema);