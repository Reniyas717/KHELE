const express = require('express');
const router = express.Router();
const GameRoom = require('../models/GameRoom');
const { initializeScribbleGame } = require('../controllers/scribbleGame');
const { initializeUNOGame } = require('../controllers/unoGame');

// Create a new room (NO AUTH)
router.post('/create', async (req, res) => {
  try {
    const { gameType, username } = req.body;
    
    console.log('📝 Create room request:', { gameType, username });
    
    if (!gameType || !username) {
      return res.status(400).json({ error: 'gameType and username are required' });
    }
    
    // ADDED truthordare to valid types
    if (!['scribble', 'uno', 'truthordare'].includes(gameType)) {
      return res.status(400).json({ error: 'Invalid game type. Must be scribble, uno, or truthordare' });
    }
    
    // Generate unique 6-character code
    let roomCode;
    let attempts = 0;
    let roomExists = true;
    
    // Try to find a unique room code
    while (roomExists && attempts < 10) {
      roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existing = await GameRoom.findOne({ roomCode, isActive: true });
      roomExists = !!existing;
      attempts++;
    }
    
    if (roomExists) {
      return res.status(500).json({ error: 'Failed to generate unique room code' });
    }
    
    console.log('🎲 Generated room code:', roomCode);
    
    const room = new GameRoom({
      roomCode,
      host: username,
      gameType,
      status: 'waiting',
      isActive: true,
      players: [{
        username: username,
        score: 0,
        status: 'waiting',
        hand: [],
        hasGuessed: false
      }],
      gameState: null
    });

    await room.save();
    console.log('✅ Room created and saved:', { 
      roomCode, 
      host: username, 
      gameType,
      _id: room._id 
    });

    res.json({ 
      roomCode, 
      room: {
        roomCode: room.roomCode,
        host: room.host,
        gameType: room.gameType,
        status: room.status,
        players: room.players.map(p => ({
          username: p.username,
          score: p.score,
          status: p.status
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room: ' + error.message });
  }
});

// Join a room (NO AUTH)
router.post('/join', async (req, res) => {
  try {
    const { roomCode, username } = req.body;
    
    console.log('🚪 Join room request:', { roomCode, username });
    
    if (!roomCode || !username) {
      return res.status(400).json({ error: 'roomCode and username are required' });
    }
    
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('🔍 Looking for room:', normalizedCode);
    
    // Find active room
    const room = await GameRoom.findOne({ 
      roomCode: normalizedCode, 
      isActive: true 
    });
    
    if (!room) {
      console.log('❌ Room not found:', normalizedCode);
      
      // Debug: Show all active rooms
      const allRooms = await GameRoom.find({ isActive: true }).select('roomCode gameType host');
      console.log('📋 Active rooms:', allRooms);
      
      return res.status(404).json({ error: 'Room not found or inactive' });
    }

    console.log('✅ Room found:', {
      roomCode: room.roomCode,
      gameType: room.gameType,
      host: room.host,
      playerCount: room.players.length
    });

    // Check if game already started
    if (room.status === 'in-progress') {
      return res.status(400).json({ error: 'Game already in progress' });
    }

    // Check if player already in room
    const existingPlayer = room.players.find(p => p.username === username);
    
    if (!existingPlayer) {
      room.players.push({
        username: username,
        score: 0,
        status: 'waiting',
        hand: [],
        hasGuessed: false
      });
      await room.save();
      console.log('➕ Player added to room:', username);
    } else {
      console.log('♻️ Player already in room:', username);
    }

    res.json({ 
      room: {
        roomCode: room.roomCode,
        host: room.host,
        gameType: room.gameType,
        status: room.status,
        players: room.players.map(p => ({
          username: p.username,
          score: p.score,
          status: p.status
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error joining room:', error);
    res.status(500).json({ error: 'Failed to join room: ' + error.message });
  }
});

// Get room details (NO AUTH)
router.get('/:roomCode', async (req, res) => {
  try {
    const normalizedCode = req.params.roomCode.toUpperCase().trim();
    
    console.log('🔍 Get room request:', normalizedCode);
    
    const room = await GameRoom.findOne({ 
      roomCode: normalizedCode,
      isActive: true 
    });

    if (!room) {
      console.log('❌ Room not found:', normalizedCode);
      return res.status(404).json({ error: 'Room not found' });
    }

    console.log('✅ Room details sent:', normalizedCode);

    res.json({ 
      room: {
        roomCode: room.roomCode,
        host: room.host,
        gameType: room.gameType,
        status: room.status,
        players: room.players.map(p => ({
          username: p.username,
          score: p.score,
          status: p.status
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room: ' + error.message });
  }
});

// Start game (NO AUTH)
router.post('/start', async (req, res) => {
  try {
    const { roomCode, username } = req.body;
    
    console.log('🎮 Start game request:', { roomCode, username });
    
    if (!roomCode || !username) {
      return res.status(400).json({ error: 'roomCode and username are required' });
    }

    const normalizedCode = roomCode.toUpperCase().trim();
    const room = await GameRoom.findOne({ 
      roomCode: normalizedCode,
      isActive: true 
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.host !== username) {
      return res.status(403).json({ error: 'Only host can start the game' });
    }

    if (room.players.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 players to start' });
    }

    console.log('✅ Starting game:', { roomCode: normalizedCode, gameType: room.gameType });

    // This will be handled by WebSocket, just validate here
    res.json({ 
      message: 'Game start request accepted',
      room: {
        roomCode: room.roomCode,
        host: room.host,
        gameType: room.gameType,
        players: room.players.map(p => ({
          username: p.username,
          score: p.score
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error starting game:', error);
    res.status(500).json({ error: 'Failed to start game: ' + error.message });
  }
});

// Debug endpoint
router.get('/debug/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('🔧 Debug request for:', normalizedCode);
    
    const room = await GameRoom.findOne({ roomCode: normalizedCode });
    
    if (!room) {
      const allRooms = await GameRoom.find({}).select('roomCode isActive gameType host players');
      return res.json({
        message: 'Room not found',
        searchedCode: normalizedCode,
        allRooms: allRooms
      });
    }

    const debug = {
      roomCode: room.roomCode,
      host: room.host,
      gameType: room.gameType,
      status: room.status,
      isActive: room.isActive,
      playerCount: room.players.length,
      players: room.players.map(p => ({ 
        username: p.username, 
        score: p.score,
        cardCount: p.hand?.length || 0
      })),
      gameState: room.gameState ? {
        exists: true,
        type: room.gameType,
        details: room.gameType === 'uno' ? {
          deckSize: room.gameState.deck?.length,
          currentPlayerIndex: room.gameState.currentPlayerIndex,
          currentColor: room.gameState.currentColor
        } : {
          currentDrawer: room.gameState.currentDrawer,
          round: room.gameState.round,
          drawingStarted: room.gameState.drawingStarted
        }
      } : null,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt
    };

    res.json(debug);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// List all active rooms (for debugging)
router.get('/', async (req, res) => {
  try {
    const rooms = await GameRoom.find({ isActive: true })
      .select('roomCode gameType host players.username status createdAt')
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({ 
      count: rooms.length,
      rooms: rooms.map(r => ({
        roomCode: r.roomCode,
        gameType: r.gameType,
        host: r.host,
        playerCount: r.players.length,
        players: r.players.map(p => p.username),
        status: r.status,
        createdAt: r.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint for Truth or Dare API (to avoid CORS)
router.get('/truthordare/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { rating } = req.query;
    
    console.log(`🎭 Fetching ${type} question with rating: ${rating}`);
    
    if (!['truth', 'dare'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be truth or dare' });
    }
    
    const validRating = rating?.toLowerCase() || 'pg';
    const url = `https://api.truthordarebot.xyz/v1/${type}?rating=${validRating}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ Error fetching from Truth or Dare API:', error);
    
    // Return fallback questions
    const fallbacks = {
      truth: {
        pg: [
          "What's the most embarrassing thing you've ever done?",
          "What's your biggest secret?",
          "Who do you have a crush on?",
          "What's the worst lie you've ever told?",
          "What's your most embarrassing moment in school?"
        ],
        r: [
          "What's the most embarrassing thing you've done while drunk?",
          "Have you ever lied to your significant other?",
          "What's your biggest fantasy?",
          "Have you ever cheated in a relationship?",
          "What's the worst thing you've said about a friend?"
        ]
      },
      dare: {
        pg: [
          "Do 20 pushups right now",
          "Sing your favorite song",
          "Dance for 30 seconds",
          "Do your best celebrity impression",
          "Speak in an accent for the next 3 rounds"
        ],
        r: [
          "Take a shot of hot sauce",
          "Text your ex right now",
          "Post an embarrassing photo on social media",
          "Call someone and sing them a love song",
          "Do 30 pushups without stopping"
        ]
      }
    };
    
    const type = req.params.type;
    const rating = req.query.rating?.toLowerCase() || 'pg';
    const questions = fallbacks[type][rating === 'r' ? 'r' : 'pg'];
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    
    res.json({ 
      question: randomQuestion,
      type: type.toUpperCase(),
      rating: rating.toUpperCase()
    });
  }
});

module.exports = router;