const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    default: 0
  },
  hand: {
    type: Array,
    default: []
  },
  status: {
    type: String,
    default: 'waiting'
  },
  hasGuessed: {
    type: Boolean,
    default: false
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
  status: {
    type: String,
    enum: ['waiting', 'in-progress', 'finished'],
    default: 'waiting'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  gameState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

// Add index for faster lookups
gameRoomSchema.index({ roomCode: 1, isActive: 1 });

module.exports = mongoose.model('GameRoom', gameRoomSchema);