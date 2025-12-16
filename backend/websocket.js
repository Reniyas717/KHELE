const WebSocket = require('ws');
const GameRoom = require('./models/GameRoom');
const { initScribbleGame, handleGuess, nextRound, selectWord } = require('./controllers/scribbleGame');
const { initUNOGame, playCard, drawCard } = require('./controllers/unoGame');

// Store active connections
const clients = new Map(); // username -> { ws, roomCode }
const roomConnections = new Map(); // roomCode -> Set of usernames

function initWebSocket(server) {
  const wss = new WebSocket.Server({ 
    server,
    path: '/ws'
  });

  wss.on('connection', (ws) => {
    console.log('🔌 New WebSocket connection');
    
    let currentUsername = null;
    let currentRoomCode = null;

    // Send connection confirmation
    ws.send(JSON.stringify({ 
      type: 'CONNECTED',
      payload: { message: 'WebSocket connected' }
    }));

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        console.log('📨 Received:', data.type, 'from', data.payload?.username || currentUsername || 'unknown');

        switch (data.type) {
          case 'JOIN_ROOM':
            const result = await handleJoinRoom(ws, data.payload);
            if (result.success) {
              currentUsername = data.payload.username;
              currentRoomCode = data.payload.roomCode;
            }
            break;
            
          case 'LEAVE_ROOM':
            await handleLeaveRoom(ws, data.payload);
            currentUsername = null;
            currentRoomCode = null;
            break;
            
          case 'START_GAME':
            await handleStartGame(ws, data.payload);
            break;
            
          case 'SELECT_WORD':
            await handleSelectWord(ws, data.payload);
            break;
            
          case 'DRAW_LINE':
            await handleDrawLine(ws, data.payload);
            break;
            
          case 'CLEAR_CANVAS':
            await handleClearCanvas(ws, data.payload);
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
            await handleDrawCardAction(ws, data.payload);
            break;
            
          case 'REQUEST_HAND':
            await handleRequestHand(ws, data.payload);
            break;
            
          default:
            console.log('⚠️ Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('❌ WebSocket message error:', error);
        ws.send(JSON.stringify({ 
          type: 'ERROR', 
          payload: { message: error.message } 
        }));
      }
    });

    ws.on('close', () => {
      console.log(`🔌 WebSocket closed for ${currentUsername}`);
      if (currentUsername && currentRoomCode) {
        handleLeaveRoom(ws, { 
          roomCode: currentRoomCode, 
          username: currentUsername 
        }).catch(err => console.error('Error in close handler:', err));
      }
      if (currentUsername) {
        clients.delete(currentUsername);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  });

  console.log('✅ WebSocket server initialized on /ws');
  return wss;
}

// Broadcast to all users in a room
function broadcastToRoom(roomCode, message, excludeUsername = null) {
  const users = roomConnections.get(roomCode);
  if (!users) {
    console.log(`⚠️ No users in room ${roomCode}`);
    return;
  }

  console.log(`📢 Broadcasting ${message.type} to room ${roomCode} (${users.size} users)`);
  if (excludeUsername) {
    console.log(`   Excluding: ${excludeUsername}`);
  }
  
  let successCount = 0;
  users.forEach(username => {
    if (username === excludeUsername) {
      console.log(`   ⏭️ Skipping ${username}`);
      return;
    }
    
    const clientData = clients.get(username);
    if (clientData && clientData.ws && clientData.ws.readyState === WebSocket.OPEN) {
      try {
        clientData.ws.send(JSON.stringify(message));
        successCount++;
        console.log(`   ✅ Sent to ${username}`);
      } catch (error) {
        console.error(`   ❌ Failed to send to ${username}:`, error.message);
      }
    } else {
      console.log(`   ⚠️ ${username} connection not ready`);
    }
  });
  
  console.log(`✅ Broadcast complete: ${successCount}/${users.size} successful`);
}

async function handleJoinRoom(ws, payload) {
  try {
    const { roomCode, username } = payload;
    
    if (!roomCode || !username) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Missing roomCode or username' }
      }));
      return { success: false };
    }

    const normalizedCode = roomCode.toUpperCase().trim();
    console.log('🔍 JOIN_ROOM:', { roomCode: normalizedCode, username });

    const room = await GameRoom.findOne({ 
      roomCode: normalizedCode,
      isActive: true 
    });
    
    if (!room) {
      console.error('❌ Room not found:', normalizedCode);
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Room not found' }
      }));
      return { success: false };
    }

    console.log('✅ Room found:', normalizedCode);

    // Check if player already exists
    const existingPlayer = room.players.find(p => p.username === username);
    const isNewPlayer = !existingPlayer;

    // Add player if not exists
    if (isNewPlayer) {
      room.players.push({
        username,
        score: 0,
        status: 'waiting',
        hand: [],
        hasGuessed: false
      });
      await room.save();
      console.log('➕ New player added:', username);
    } else {
      console.log('♻️ Existing player reconnecting:', username);
    }

    // Store connection BEFORE sending any messages
    clients.set(username, { ws, roomCode: normalizedCode });
    
    if (!roomConnections.has(normalizedCode)) {
      roomConnections.set(normalizedCode, new Set());
    }
    roomConnections.get(normalizedCode).add(username);

    console.log(`📊 Room ${normalizedCode} now has ${roomConnections.get(normalizedCode).size} connected clients:`, 
      Array.from(roomConnections.get(normalizedCode)));

    // Get updated room data
    const updatedRoom = await GameRoom.findOne({ 
      roomCode: normalizedCode,
      isActive: true 
    });

    const roomData = {
      roomCode: updatedRoom.roomCode,
      host: updatedRoom.host,
      gameType: updatedRoom.gameType,
      status: updatedRoom.status,
      players: updatedRoom.players.map(p => ({
        username: p.username,
        score: p.score,
        status: p.status
      }))
    };

    // Send ROOM_JOINED to the joining player
    ws.send(JSON.stringify({
      type: 'ROOM_JOINED',
      payload: { room: roomData }
    }));
    console.log(`✅ Sent ROOM_JOINED to ${username}`);

    // Notify ALL players (including the one who just joined) about the updated player list
    // This ensures everyone has the same view
    setTimeout(() => {
      console.log(`📢 Broadcasting PLAYER_JOINED for ${username}`);
      broadcastToRoom(normalizedCode, {
        type: 'PLAYER_JOINED',
        payload: {
          username,
          room: roomData
        }
      }); // NO exclusion - send to everyone including the joiner
    }, 100); // Small delay to ensure connection is fully established

    console.log('✅ JOIN complete:', { 
      username, 
      roomCode: normalizedCode, 
      totalPlayers: updatedRoom.players.length,
      connectedClients: roomConnections.get(normalizedCode).size 
    });
    
    return { success: true };

  } catch (error) {
    console.error('❌ Error in handleJoinRoom:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: 'Failed to join room: ' + error.message }
    }));
    return { success: false };
  }
}

async function handleLeaveRoom(ws, payload) {
  try {
    const { roomCode, username } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log(`👋 LEAVE_ROOM: ${username} from ${normalizedCode}`);

    // Remove from connection maps
    const users = roomConnections.get(normalizedCode);
    if (users) {
      users.delete(username);
      if (users.size === 0) {
        roomConnections.delete(normalizedCode);
      }
    }
    clients.delete(username);

    // Update database
    const room = await GameRoom.findOne({ 
      roomCode: normalizedCode,
      isActive: true 
    });
    
    if (!room) {
      console.log('⚠️ Room not found or already inactive');
      return;
    }

    // Remove player from room
    room.players = room.players.filter(p => p.username !== username);
    
    // Only deactivate if no players left OR if game hasn't started and host left
    if (room.players.length === 0) {
      room.isActive = false;
      await room.save();
      console.log(`🗑️ Room ${normalizedCode} deactivated (no players)`);
    } else if (room.host === username && room.status === 'waiting') {
      // Host left during waiting - transfer to next player
      room.host = room.players[0].username;
      await room.save();
      
      console.log(`👑 Host transferred to ${room.host}`);
      
      // Notify remaining players
      broadcastToRoom(normalizedCode, {
        type: 'PLAYER_LEFT',
        payload: {
          username,
          hostChanged: true,
          newHost: room.host,
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
        }
      });
    } else if (room.host === username && room.status === 'in-progress') {
      // Host left during game - end the game
      room.isActive = false;
      room.status = 'finished';
      await room.save();
      
      console.log(`🛑 Game ended (host left): ${normalizedCode}`);
      
      broadcastToRoom(normalizedCode, {
        type: 'ROOM_CLOSED',
        payload: { message: 'Host left the game' }
      });
    } else {
      // Regular player left
      await room.save();
      
      broadcastToRoom(normalizedCode, {
        type: 'PLAYER_LEFT',
        payload: {
          username,
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
        }
      });
    }

    console.log(`✅ LEAVE complete: ${username}`);
  } catch (error) {
    console.error('❌ Error in handleLeaveRoom:', error);
  }
}

async function handleStartGame(ws, payload) {
  try {
    const { roomCode, username } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('🎮 START_GAME:', { roomCode: normalizedCode, username });

    const room = await GameRoom.findOne({ 
      roomCode: normalizedCode,
      isActive: true 
    });
    
    if (!room) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Room not found' }
      }));
      return;
    }

    if (room.host !== username) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Only host can start game' }
      }));
      return;
    }

    if (room.players.length < 2) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Need at least 2 players' }
      }));
      return;
    }

    room.status = 'in-progress';

    // Initialize game
    const playerNames = room.players.map(p => p.username);
    
    if (room.gameType === 'scribble') {
      room.gameState = initScribbleGame(playerNames);
      console.log('✅ Scribble game initialized');
    } else if (room.gameType === 'uno') {
      room.gameState = initUNOGame(playerNames);
      
      // Store hands in player records
      room.gameState.players.forEach((gp, index) => {
        room.players[index].hand = gp.hand;
      });
      
      console.log('✅ UNO game initialized');
    }

    await room.save();

    // Broadcast game start to ALL players
    broadcastToRoom(normalizedCode, {
      type: 'GAME_STARTED',
      payload: {
        gameType: room.gameType,
        gameState: room.gameType === 'uno' 
          ? {
              ...room.gameState,
              players: room.gameState.players.map(p => ({
                name: p.name,
                score: p.score,
                hand: [] // Don't send hands in broadcast
              })),
              deck: [] // Don't send deck
            }
          : room.gameState
      }
    });

    console.log('✅ Game started and broadcasted');
  } catch (error) {
    console.error('❌ Error starting game:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: 'Failed to start game: ' + error.message }
    }));
  }
}

async function handleRequestHand(ws, payload) {
  try {
    const { roomCode, username } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log(`🤚 REQUEST_HAND: ${username} in ${normalizedCode}`);
    
    const room = await GameRoom.findOne({ 
      roomCode: normalizedCode,
      isActive: true 
    });
    
    if (!room || !room.gameState) {
      console.error('❌ Room or gameState not found');
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not found' }
      }));
      return;
    }

    console.log('🔍 Game state players:', room.gameState.players?.map(p => p.name));
    
    const player = room.gameState.players?.find(p => p.name === username);
    
    if (!player) {
      console.error('❌ Player not found in game state:', username);
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Player not found in game' }
      }));
      return;
    }

    if (!player.hand) {
      console.error('❌ Player hand is null/undefined');
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Player hand not initialized' }
      }));
      return;
    }

    console.log(`✅ Sending ${player.hand.length} cards to ${username}:`, player.hand.slice(0, 3), '...');

    ws.send(JSON.stringify({
      type: 'HAND_UPDATE',
      payload: {
        hand: player.hand
      }
    }));
  } catch (error) {
    console.error('❌ Error in handleRequestHand:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: error.message }
    }));
  }
}

// Scribble game handlers
async function handleSelectWord(ws, payload) {
  try {
    const { roomCode, word, username } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    
    if (!room || !room.gameState) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not found' }
      }));
      return;
    }

    room.gameState = selectWord(room.gameState, word);
    await room.save();
    
    broadcastToRoom(normalizedCode, {
      type: 'WORD_SELECTED',
      payload: { gameState: room.gameState }
    });

    console.log(`✅ Word selected: ${word} by ${username}`);
  } catch (error) {
    console.error('❌ Error in handleSelectWord:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: error.message }
    }));
  }
}

async function handleDrawLine(ws, payload) {
  const { roomCode, line } = payload;
  broadcastToRoom(roomCode.toUpperCase().trim(), {
    type: 'DRAW_LINE',
    payload: { line }
  });
}

async function handleClearCanvas(ws, payload) {
  const { roomCode } = payload;
  broadcastToRoom(roomCode.toUpperCase().trim(), {
    type: 'CLEAR_CANVAS'
  });
}

async function handleGuessWord(ws, payload) {
  try {
    const { roomCode, username, guess } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    
    if (!room || !room.gameState) {
      return;
    }

    const result = handleGuess(room.gameState, username, guess);
    
    if (result.correct) {
      room.gameState = result.gameState;
      await room.save();
      
      broadcastToRoom(normalizedCode, {
        type: 'CORRECT_GUESS',
        payload: { 
          username, 
          points: result.points, 
          gameState: room.gameState 
        }
      });

      // Check if all players guessed
      const allGuessed = room.gameState.players
        .filter(p => p.username !== room.gameState.currentDrawer)
        .every(p => p.hasGuessed);

      if (allGuessed) {
        setTimeout(() => {
          handleNextRound(ws, { roomCode: normalizedCode });
        }, 3000);
      }
    } else {
      broadcastToRoom(normalizedCode, {
        type: 'CHAT_MESSAGE',
        payload: { username, message: guess, isCorrect: false }
      });
    }
  } catch (error) {
    console.error('❌ Error in handleGuessWord:', error);
  }
}

async function handleNextRound(ws, payload) {
  try {
    const { roomCode } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    
    if (!room || !room.gameState) {
      return;
    }

    const result = nextRound(room.gameState);
    
    if (result.gameOver) {
      broadcastToRoom(normalizedCode, {
        type: 'GAME_OVER',
        payload: result
      });
      
      room.status = 'finished';
      await room.save();
    } else {
      room.gameState = result.gameState;
      await room.save();
      
      broadcastToRoom(normalizedCode, {
        type: 'NEXT_ROUND',
        payload: { gameState: result.gameState }
      });
    }
  } catch (error) {
    console.error('❌ Error in handleNextRound:', error);
  }
}

// UNO game handlers
async function handlePlayCard(ws, payload) {
  try {
    const { roomCode, username, cardIndex, chosenColor } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    const room = await GameRoom.findOne({ 
      roomCode: normalizedCode,
      isActive: true 
    });
    
    if (!room || !room.gameState) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not found' }
      }));
      return;
    }

    const result = playCard(room.gameState, username, cardIndex, chosenColor);
    
    if (result.success) {
      room.gameState = result.gameState;
      
      // Update player hand in room.players
      const playerIndex = room.players.findIndex(p => p.username === username);
      if (playerIndex !== -1) {
        room.players[playerIndex].hand = result.gameState.players.find(p => p.name === username).hand;
      }
      
      await room.save();
      
      broadcastToRoom(normalizedCode, {
        type: 'CARD_PLAYED',
        payload: { 
          username,
          gameState: {
            ...result.gameState,
            players: result.gameState.players.map(p => ({
              name: p.name,
              score: p.score,
              hand: []
            })),
            deck: []
          }
        }
      });
      
      if (result.winner) {
        broadcastToRoom(normalizedCode, {
          type: 'GAME_OVER',
          payload: { winner: result.winner }
        });
        
        room.status = 'finished';
        await room.save();
      }
    } else {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: result.message }
      }));
    }
  } catch (error) {
    console.error('❌ Error in handlePlayCard:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: error.message }
    }));
  }
}

async function handleDrawCardAction(ws, payload) {
  try {
    const { roomCode, username } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    const room = await GameRoom.findOne({ 
      roomCode: normalizedCode,
      isActive: true 
    });
    
    if (!room || !room.gameState) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not found' }
      }));
      return;
    }

    const result = drawCard(room.gameState, username);
    
    if (result.success) {
      room.gameState = result.gameState;
      
      // Update player hand in room.players
      const playerIndex = room.players.findIndex(p => p.username === username);
      if (playerIndex !== -1) {
        room.players[playerIndex].hand = result.gameState.players.find(p => p.name === username).hand;
      }
      
      await room.save();
      
      broadcastToRoom(normalizedCode, {
        type: 'CARD_DRAWN',
        payload: { 
          username,
          gameState: {
            ...result.gameState,
            players: result.gameState.players.map(p => ({
              name: p.name,
              score: p.score,
              hand: []
            })),
            deck: []
          }
        }
      });
    } else {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: result.message }
      }));
    }
  } catch (error) {
    console.error('❌ Error in handleDrawCardAction:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: error.message }
    }));
  }
}

module.exports = initWebSocket;