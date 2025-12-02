const express = require('express');
const router = express.Router();
const GameRoom = require('../models/GameRoom');

// Create a new room (NO AUTH)
router.post('/create', async (req, res) => {
  try {
    const { gameType, username } = req.body;
    
    if (!gameType || !username) {
      return res.status(400).json({ error: 'gameType and username are required' });
    }
    
    // Generate unique 6-character code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const room = new GameRoom({
      roomCode,
      host: username,
      gameType,
      players: [{
        username: username,
        score: 0
      }]
    });

    await room.save();
    console.log('✅ Room created and saved:', { roomCode, host: username, gameType });

    res.json({ roomCode, room });
  } catch (error) {
    console.error('❌ Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Join a room (NO AUTH)
router.post('/join', async (req, res) => {
  try {
    const { roomCode, username } = req.body;
    
    if (!roomCode || !username) {
      return res.status(400).json({ error: 'roomCode and username are required' });
    }
    
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('🔍 Join attempt:', { 
      originalCode: roomCode, 
      normalizedCode, 
      username 
    });
    
    const room = await GameRoom.findOne({ 
      roomCode: normalizedCode, 
      isActive: true 
    });
    
    console.log('🎯 Room found:', room ? `YES - ${room.roomCode}` : 'NO');

    if (!room) {
      return res.status(404).json({ error: 'Room not found or inactive' });
    }

    // Check if player already in room
    const existingPlayer = room.players.find(p => p.username === username);
    if (!existingPlayer) {
      room.players.push({
        username: username,
        score: 0
      });
      await room.save();
      console.log('✅ Player added to room:', username);
    } else {
      console.log('ℹ️ Player already in room:', username);
    }

    res.json({ room });
  } catch (error) {
    console.error('❌ Error joining room:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Get room details (NO AUTH)
router.get('/:roomCode', async (req, res) => {
  try {
    const room = await GameRoom.findOne({ 
      roomCode: req.params.roomCode.toUpperCase(),
      isActive: true 
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ room });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

module.exports = router;