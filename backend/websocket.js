const WebSocket = require('ws');
const GameRoom = require('./models/GameRoom');
const { initScribbleGame, handleGuess, nextRound } = require('./controllers/scribbleGame');
const { initUNOGame, playCard, drawCard } = require('./controllers/unoGame');

// Store active connections
const clients = new Map(); // username -> ws
const roomConnections = new Map(); // roomCode -> Set of usernames

function initWebSocket(server) {
  const wss = new WebSocket.Server({ 
    server,
    path: '/ws' // Add explicit path
  });

  wss.on('connection', (ws, req) => {
    console.log('🔌 New WebSocket connection');
    
    let currentUsername = null;
    let currentRoomCode = null;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        console.log('📨 Received message:', data.type, 'from', data.payload?.username);

        switch (data.type) {
          case 'JOIN_ROOM':
            currentUsername = data.payload.username;
            currentRoomCode = data.payload.roomCode;
            await handleJoinRoom(ws, data.payload);
            break;
          case 'LEAVE_ROOM':
            await handleLeaveRoom(ws, data.payload);
            break;
          case 'START_GAME':
            await handleStartGame(ws, data.payload);
            break;
          case 'DRAW_LINE':
            await handleDrawLine(ws, data.payload);
            break;
          case 'CLEAR_CANVAS':
            await handleClearCanvas(ws, data.payload);
            break;
          case 'CHAT_MESSAGE':
            await handleChatMessage(ws, data.payload);
            break;
          case 'GUESS_WORD':
            await handleGuessWord(ws, data.payload);
            break;
          case 'NEXT_ROUND':
            await handleNextRound(ws, data.payload);
            break;
          case 'PLAY_CARD':
            await handlePlayCard(ws, data.payload);
            break;
          case 'DRAW_CARD':
            await handleDrawCard(ws, data.payload);
            break;
          case 'REQUEST_HAND':
            await handleRequestHand(ws, data.payload);
            break;
          default:
            console.log('⚠️ Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('❌ WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: error.message } }));
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket disconnected:', currentUsername);
      
      // Clean up using stored username
      if (currentUsername) {
        clients.delete(currentUsername);
        
        // Remove from room connections
        if (currentRoomCode) {
          const users = roomConnections.get(currentRoomCode);
          if (users) {
            users.delete(currentUsername);
            if (users.size === 0) {
              roomConnections.delete(currentRoomCode);
            }
            
            // Notify others in room
            broadcastToRoom(currentRoomCode, {
              type: 'PLAYER_LEFT',
              payload: { username: currentUsername }
            });
          }
        }
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  });

  console.log('✅ WebSocket server initialized on path /ws');
}

// Broadcast to all users in a room
function broadcastToRoom(roomCode, message) {
  const users = roomConnections.get(roomCode);
  if (users) {
    console.log(`📢 Broadcasting ${message.type} to ${users.size} users in ${roomCode}`);
    users.forEach(username => {
      const ws = clients.get(username);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }
}

// Handler functions
async function handleJoinRoom(ws, payload) {
  try {
    const { roomCode, username } = payload;

    if (!roomCode || !username) {
      console.error('❌ Missing roomCode or username');
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Missing roomCode or username' } }));
      return;
    }

    console.log(`🔍 ${username} trying to join room ${roomCode}`);

    // Remove old connection if exists
    const oldWs = clients.get(username);
    if (oldWs && oldWs !== ws) {
      console.log(`⚠️ Closing old connection for ${username}`);
      oldWs.close();
    }

    // Store new connection
    clients.set(username, ws);
    
    if (!roomConnections.has(roomCode)) {
      roomConnections.set(roomCode, new Set());
    }
    roomConnections.get(roomCode).add(username);

    console.log(`📋 Users in room ${roomCode}:`, Array.from(roomConnections.get(roomCode)));

    // Get room from database
    const room = await GameRoom.findOne({ roomCode, isActive: true });
    if (!room) {
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Room not found' } }));
      return;
    }

    // ADD PLAYER TO DATABASE IF NOT ALREADY THERE
    const existingPlayer = room.players.find(p => p.username === username);
    if (!existingPlayer) {
      console.log(`➕ Adding ${username} to room database`);
      room.players.push({
        username: username,
        score: 0
      });
      await room.save();
      console.log(`✅ ${username} added to database`);
    } else {
      console.log(`ℹ️ ${username} already in database`);
    }

    console.log(`✅ Room now has ${room.players.length} players:`, room.players.map(p => p.username));

    // Send success to the player who just joined
    ws.send(JSON.stringify({ 
      type: 'JOINED_ROOM', 
      payload: { roomCode, room } 
    }));

    // Broadcast to ALL players in the room with UPDATED player list
    broadcastToRoom(roomCode, {
      type: 'PLAYER_JOINED',
      payload: { username, players: room.players }
    });

    // Send updated room state to everyone
    broadcastToRoom(roomCode, {
      type: 'ROOM_UPDATE',
      payload: { room }
    });

    console.log(`✅ ${username} successfully joined room ${roomCode}`);
  } catch (error) {
    console.error('❌ Error in handleJoinRoom:', error);
    ws.send(JSON.stringify({ type: 'ERROR', payload: { message: error.message } }));
  }
}

async function handleLeaveRoom(ws, payload) {
  try {
    const { roomCode, username } = payload;
    
    if (!username || !roomCode) {
      console.warn('⚠️ Leave room called without username or roomCode');
      return;
    }

    console.log(`👋 ${username} leaving room ${roomCode}`);
    
    // Remove from connections
    const users = roomConnections.get(roomCode);
    if (users) {
      users.delete(username);
      if (users.size === 0) {
        roomConnections.delete(roomCode);
      }
    }
    
    // Notify others
    broadcastToRoom(roomCode, {
      type: 'PLAYER_LEFT',
      payload: { username }
    });
  } catch (error) {
    console.error('Error in handleLeaveRoom:', error);
  }
}

async function handleStartGame(ws, payload) {
  try {
    const { roomCode, gameType } = payload;
    
    console.log(`🎮 Starting ${gameType} game in room ${roomCode}`);
    
    const room = await GameRoom.findOne({ roomCode });
    if (!room) {
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Room not found' } }));
      return;
    }

    // Initialize game based on type
    if (gameType === 'scribble') {
      const gameState = initScribbleGame(room.players.map(p => p.username));
      room.gameState = gameState;
      room.currentGame = 'scribble';
    } else if (gameType === 'uno') {
      const gameState = initUNOGame(room.players.map(p => p.username));
      room.gameState = gameState;
      room.currentGame = 'uno';
    }

    await room.save();

    // Broadcast game start
    broadcastToRoom(roomCode, {
      type: 'GAME_STARTED',
      payload: { gameType, gameState: room.gameState }
    });

    console.log(`✅ Game started in room ${roomCode}: ${gameType}`);
  } catch (error) {
    console.error('Error in handleStartGame:', error);
    ws.send(JSON.stringify({ type: 'ERROR', payload: { message: error.message } }));
  }
}

async function handleDrawLine(ws, payload) {
  try {
    const { roomCode, line } = payload;
    
    broadcastToRoom(roomCode, {
      type: 'DRAW_LINE',
      payload: { line }
    });
  } catch (error) {
    console.error('Error in handleDrawLine:', error);
  }
}

async function handleClearCanvas(ws, payload) {
  try {
    const { roomCode } = payload;
    
    broadcastToRoom(roomCode, {
      type: 'CLEAR_CANVAS',
      payload: {}
    });
  } catch (error) {
    console.error('Error in handleClearCanvas:', error);
  }
}

async function handleChatMessage(ws, payload) {
  try {
    const { roomCode, username, message } = payload;
    
    broadcastToRoom(roomCode, {
      type: 'CHAT_MESSAGE',
      payload: { username, message }
    });
  } catch (error) {
    console.error('Error in handleChatMessage:', error);
  }
}

async function handleGuessWord(ws, payload) {
  try {
    const { roomCode, username, guess } = payload;
    
    const room = await GameRoom.findOne({ roomCode });
    if (!room || !room.gameState) {
      return;
    }

    const result = handleGuess(room.gameState, username, guess);
    room.markModified('gameState');
    await room.save();

    if (result.correct) {
      broadcastToRoom(roomCode, {
        type: 'CORRECT_GUESS',
        payload: { username, word: result.word, gameState: room.gameState }
      });
    } else {
      broadcastToRoom(roomCode, {
        type: 'CHAT_MESSAGE',
        payload: { username, message: guess }
      });
    }
  } catch (error) {
    console.error('Error in handleGuessWord:', error);
  }
}

async function handleNextRound(ws, payload) {
  try {
    const { roomCode } = payload;
    
    const room = await GameRoom.findOne({ roomCode });
    if (!room || !room.gameState) {
      return;
    }

    const result = nextRound(room.gameState);
    room.markModified('gameState');
    await room.save();

    if (result.gameOver) {
      broadcastToRoom(roomCode, {
        type: 'GAME_OVER',
        payload: { winner: result.winner, finalScores: result.scores }
      });
    } else {
      broadcastToRoom(roomCode, {
        type: 'NEXT_ROUND',
        payload: { gameState: room.gameState }
      });
    }
  } catch (error) {
    console.error('Error in handleNextRound:', error);
  }
}

async function handlePlayCard(ws, payload) {
  try {
    const { roomCode, username, cardIndex, chosenColor } = payload;
    
    const room = await GameRoom.findOne({ roomCode });
    if (!room || !room.gameState) {
      return;
    }

    const result = playCard(room.gameState, username, cardIndex, chosenColor);
    if (result.error) {
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: result.error } }));
      return;
    }

    room.markModified('gameState');
    await room.save();

    if (result.gameOver) {
      broadcastToRoom(roomCode, {
        type: 'GAME_OVER',
        payload: { winner: username }
      });
    } else {
      broadcastToRoom(roomCode, {
        type: 'CARD_PLAYED',
        payload: { gameState: room.gameState }
      });
    }
  } catch (error) {
    console.error('Error in handlePlayCard:', error);
    ws.send(JSON.stringify({ type: 'ERROR', payload: { message: error.message } }));
  }
}

async function handleDrawCard(ws, payload) {
  try {
    const { roomCode, username } = payload;
    
    const room = await GameRoom.findOne({ roomCode });
    if (!room || !room.gameState) {
      return;
    }

    drawCard(room.gameState, username);
    room.markModified('gameState');
    await room.save();

    broadcastToRoom(roomCode, {
      type: 'CARD_DRAWN',
      payload: { gameState: room.gameState }
    });
  } catch (error) {
    console.error('Error in handleDrawCard:', error);
  }
}

async function handleRequestHand(ws, payload) {
  try {
    const { roomCode, username } = payload;
    
    const room = await GameRoom.findOne({ roomCode });
    if (!room || !room.gameState) {
      return;
    }

    const playerHand = room.gameState.players?.find(p => p.name === username)?.hand || [];
    
    ws.send(JSON.stringify({
      type: 'YOUR_HAND',
      payload: { hand: playerHand }
    }));
  } catch (error) {
    console.error('Error in handleRequestHand:', error);
  }
}

module.exports = initWebSocket;