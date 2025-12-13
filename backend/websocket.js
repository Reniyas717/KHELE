const WebSocket = require('ws');
const GameRoom = require('./models/GameRoom');
const { initScribbleGame, handleGuess, nextRound, selectWord } = require('./controllers/scribbleGame');
const { initUNOGame, playCard, drawCard } = require('./controllers/unoGame');

// Store active connections
const clients = new Map(); // username -> ws
const roomConnections = new Map(); // roomCode -> Set of usernames

function initWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('🔌 New WebSocket connection');
    
    let currentUsername = null;
    let currentRoomCode = null;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        console.log('📨 Received:', data.type, 'from', data.payload?.username || 'unknown');

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
          case 'REQUEST_GAME_STATE':
            await handleRequestGameState(ws, data.payload);
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
          case 'SELECT_WORD':
            await handleSelectWord(ws, data.payload);
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
      console.log(`🔌 WebSocket closed for ${currentUsername}`);
      if (currentUsername && currentRoomCode) {
        handleLeaveRoom(ws, { roomCode: currentRoomCode, username: currentUsername });
      }
      if (currentUsername) {
        clients.delete(currentUsername);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  });

  console.log('✅ WebSocket server initialized');
}

// Broadcast to all users in a room
function broadcastToRoom(roomCode, message) {
  const users = roomConnections.get(roomCode);
  if (!users) {
    console.log(`⚠️ No users found in room ${roomCode}`);
    return;
  }

  console.log(`📢 Broadcasting ${message.type} to ${users.size} users in ${roomCode}`);
  
  let successCount = 0;
  let failCount = 0;

  users.forEach(username => {
    const ws = clients.get(username);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        console.log(`  ✅ Sent to ${username}`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Failed to send to ${username}:`, error.message);
        failCount++;
      }
    } else {
      console.log(`  ⚠️ WebSocket not open for ${username}`);
      failCount++;
    }
  });

  console.log(`📊 Broadcast complete: ${successCount} success, ${failCount} failed`);
}

async function handleJoinRoom(ws, payload) {
  try {
    const { roomCode, username } = payload;
    
    if (!roomCode || !username) {
      console.error('❌ Missing roomCode or username');
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Missing roomCode or username' }
      }));
      return;
    }

    console.log('🔍 Join attempt:', { roomCode, username });

    const room = await GameRoom.findOne({ roomCode: roomCode.toUpperCase() });
    
    if (!room) {
      console.error('❌ Room not found:', roomCode);
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Room not found' }
      }));
      return;
    }

    console.log('🎯 Room found:', roomCode);

    // Add player if not already in room
    if (!room.players.find(p => p.username === username)) {
      room.players.push({ username, score: 0 });
      await room.save();
      console.log('✅ Player added to room:', username);
    }

    // Store connection
    clients.set(username, ws);
    
    if (!roomConnections.has(roomCode)) {
      roomConnections.set(roomCode, new Set());
    }
    roomConnections.get(roomCode).add(username);

    // Send confirmation to the joining player with FULL room data
    ws.send(JSON.stringify({
      type: 'ROOM_JOINED',
      payload: {
        room: {
          roomCode: room.roomCode,
          host: room.host,
          gameType: room.gameType,
          players: room.players,
          gameStarted: room.gameStarted,
          gameState: room.gameState
        }
      }
    }));

    // Notify all OTHER players in room with FULL room data
    broadcastToRoom(roomCode, {
      type: 'PLAYER_JOINED',
      payload: {
        username,
        room: {
          roomCode: room.roomCode,
          host: room.host,
          gameType: room.gameType,
          players: room.players,
          gameStarted: room.gameStarted,
          gameState: room.gameState
        }
      }
    });

    console.log('✅ User joined room:', { username, roomCode, totalPlayers: room.players.length });

  } catch (error) {
    console.error('❌ Error in handleJoinRoom:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: 'Failed to join room' }
    }));
  }
}

async function handleLeaveRoom(ws, payload) {
  try {
    const { roomCode, username } = payload;
    console.log(`\n👋 ${username} leaving room ${roomCode}`);

    // Remove from room connections FIRST
    const users = roomConnections.get(roomCode);
    if (users) {
      users.delete(username);
      console.log(`📋 Removed ${username} from room connections`);
      if (users.size === 0) {
        roomConnections.delete(roomCode);
        console.log(`🗑️ Room ${roomCode} is now empty`);
      }
    }

    // Remove from clients
    clients.delete(username);
    console.log(`🗑️ Removed ${username} from clients`);

    // Update database with retry logic for version conflicts
    let retries = 3;
    while (retries > 0) {
      try {
        // Get fresh room data
        const room = await GameRoom.findOne({ roomCode, isActive: true });
        if (!room) {
          console.log('⚠️ Room not found or already inactive');
          return;
        }

        // Remove player
        room.players = room.players.filter(p => p.username !== username);
        console.log(`📋 Players remaining:`, room.players.map(p => p.username));
        
        // If no players left, deactivate room
        if (room.players.length === 0) {
          room.isActive = false;
          console.log(`🔒 Room ${roomCode} deactivated`);
        }
        // If host left, assign new host
        else if (room.host === username) {
          room.host = room.players[0].username;
          console.log(`👑 New host: ${room.host}`);
        }
        
        // Save with version check
        await room.save();
        console.log('💾 Room saved successfully');

        // Broadcast to remaining players
        if (room.players.length > 0) {
          console.log(`📢 Broadcasting PLAYER_LEFT to remaining players`);
          
          const updatePayload = {
            username, 
            players: room.players,
            host: room.host
          };

          broadcastToRoom(roomCode, {
            type: 'PLAYER_LEFT',
            payload: updatePayload
          });

          // Small delay then send ROOM_UPDATE
          setTimeout(() => {
            broadcastToRoom(roomCode, {
              type: 'ROOM_UPDATE',
              payload: { 
                room: {
                  roomCode: room.roomCode,
                  host: room.host,
                  players: room.players,
                  isActive: room.isActive
                }
              }
            });
          }, 100);
        }

        console.log(`✅ ${username} successfully left room ${roomCode}\n`);
        return; // Success, exit retry loop

      } catch (saveError) {
        if (saveError.name === 'VersionError' && retries > 1) {
          console.log(`⚠️ Version conflict, retrying... (${retries - 1} attempts left)`);
          retries--;
          await new Promise(resolve => setTimeout(resolve, 100)); // Wait before retry
          continue;
        } else {
          throw saveError; // Give up
        }
      }
    }

  } catch (error) {
    console.error('❌ Error in handleLeaveRoom:', error);
    // Even if database fails, still broadcast the leave event
    broadcastToRoom(roomCode, {
      type: 'PLAYER_LEFT',
      payload: { username }
    });
  }
}

async function handleStartGame(ws, payload) {
  try {
    const { roomCode } = payload;
    console.log('🎮 Starting game in room:', roomCode);

    const room = await GameRoom.findOne({ roomCode });
    if (!room) {
      console.error('❌ Room not found');
      return;
    }

    if (room.players.length < 2) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Need at least 2 players to start' }
      }));
      return;
    }

    room.gameStarted = true;

    // Initialize game based on type
    if (room.gameType === 'scribble') {
      const playerUsernames = room.players.map(p => p.username);
      room.gameState = initScribbleGame(playerUsernames);
      console.log('✅ Scribble game initialized');
    } else if (room.gameType === 'uno') {
      const playerUsernames = room.players.map(p => p.username);
      room.gameState = initUNOGame(playerUsernames);
      console.log('✅ UNO game initialized');
    }

    await room.save();

    // Broadcast game start to all players with FULL game state
    broadcastToRoom(roomCode, {
      type: 'GAME_STARTED',
      payload: {
        gameType: room.gameType,
        gameState: room.gameState,
        room: {
          roomCode: room.roomCode,
          host: room.host,
          gameType: room.gameType,
          players: room.players,
          gameStarted: room.gameStarted,
          gameState: room.gameState
        }
      }
    });

    console.log('✅ Game started and broadcasted');

  } catch (error) {
    console.error('❌ Error starting game:', error);
  }
}

async function handleRequestGameState(ws, payload) {
  try {
    const { roomCode } = payload;
    
    console.log(`📡 Handling REQUEST_GAME_STATE for room ${roomCode}`);
    
    const room = await GameRoom.findOne({ roomCode, isActive: true });
    if (!room) {
      console.log('❌ Room not found:', roomCode);
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Room not found' } }));
      return;
    }

    if (!room.gameState || !room.currentGame) {
      console.log('⚠️ No active game in room:', roomCode);
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'No active game' } }));
      return;
    }

    console.log(`✅ Sending game state for ${room.currentGame}`);

    ws.send(JSON.stringify({
      type: 'GAME_STARTED',
      payload: { 
        gameType: room.currentGame,
        gameState: room.gameState 
      }
    }));
  } catch (error) {
    console.error('❌ Error in handleRequestGameState:', error);
    ws.send(JSON.stringify({ type: 'ERROR', payload: { message: error.message } }));
  }
}

// Scribble Game Handlers
async function handleGuessWord(ws, payload) {
  try {
    const { roomCode, username, guess } = payload;
    console.log('🎯 Guess received:', { roomCode, username, guess });

    const room = await GameRoom.findOne({ roomCode });
    if (!room || !room.gameState.scribble) {
      console.error('❌ Room or game state not found');
      return;
    }

    const result = handleGuess(room.gameState.scribble, username, guess);

    if (result.correct) {
      // Save updated scores
      await room.save();

      // Broadcast correct guess to all players
      broadcastToRoom(roomCode, {
        type: 'CORRECT_GUESS',
        username,
        points: result.points,
        gameState: room.gameState.scribble
      });

      console.log('✅ Correct guess broadcast:', { username, points: result.points });
    } else {
      // Broadcast the guess as a chat message (wrong guess)
      if (result.message && result.message !== 'You cannot guess your own drawing!' && result.message !== 'You already guessed!') {
        broadcastToRoom(roomCode, {
          type: 'CHAT_MESSAGE',
          username,
          message: result.message
        });
      } else if (result.message) {
        // Send error only to the guesser
        ws.send(JSON.stringify({
          type: 'CHAT_MESSAGE',
          username: 'System',
          message: result.message,
          isSystem: true
        }));
      }
    }

  } catch (error) {
    console.error('❌ Error in handleGuessWord:', error);
  }
}

async function handleNextRound(ws, payload) {
  try {
    const { roomCode } = payload;
    
    const room = await GameRoom.findOne({ roomCode });
    if (!room) return;

    const result = nextRound(room.gameState);
    
    if (result.gameOver) {
      broadcastToRoom(roomCode, {
        type: 'GAME_OVER',
        payload: { winner: result.winner, finalScores: result.finalScores }
      });
    } else {
      room.gameState = result.gameState;
      await room.save();

      broadcastToRoom(roomCode, {
        type: 'NEXT_ROUND',
        payload: { gameState: result.gameState }
      });
    }
  } catch (error) {
    console.error('Error in handleNextRound:', error);
  }
}

// UNO Game Handlers
async function handlePlayCard(ws, payload) {
  try {
    const { roomCode, username, cardIndex, chosenColor } = payload;
    
    const room = await GameRoom.findOne({ roomCode });
    if (!room) return;

    const result = playCard(room.gameState, username, cardIndex, chosenColor);
    
    if (result.success) {
      room.gameState = result.gameState;
      await room.save();

      broadcastToRoom(roomCode, {
        type: 'CARD_PLAYED',
        payload: { gameState: result.gameState, message: result.message }
      });

      if (result.winner) {
        broadcastToRoom(roomCode, {
          type: 'GAME_OVER',
          payload: { winner: result.winner }
        });
      }
    } else {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: result.message }
      }));
    }
  } catch (error) {
    console.error('Error in handlePlayCard:', error);
  }
}

async function handleDrawCard(ws, payload) {
  try {
    const { roomCode, username } = payload;
    
    const room = await GameRoom.findOne({ roomCode });
    if (!room) return;

    const result = drawCard(room.gameState, username);
    
    if (result.success) {
      room.gameState = result.gameState;
      await room.save();

      broadcastToRoom(roomCode, {
        type: 'CARD_DRAWN',
        payload: { gameState: result.gameState, message: result.message }
      });
    }
  } catch (error) {
    console.error('Error in handleDrawCard:', error);
  }
}

async function handleRequestHand(ws, payload) {
  try {
    const { roomCode, username } = payload;
    
    console.log(`\n🤚 ========== REQUEST_HAND ==========`);
    console.log(`👤 Player: ${username}`);
    console.log(`🏠 Room: ${roomCode}`);
    
    const room = await GameRoom.findOne({ roomCode, isActive: true });
    if (!room) {
      console.error('❌ Room not found');
      ws.send(JSON.stringify({ 
        type: 'ERROR', 
        payload: { message: 'Room not found' } 
      }));
      return;
    }

    if (!room.gameState) {
      console.error('❌ No game state in room');
      ws.send(JSON.stringify({ 
        type: 'ERROR', 
        payload: { message: 'No active game' } 
      }));
      return;
    }

    if (!room.gameState.players) {
      console.error('❌ No players in game state');
      ws.send(JSON.stringify({ 
        type: 'ERROR', 
        payload: { message: 'No players in game' } 
      }));
      return;
    }

    const player = room.gameState.players.find(p => p.name === username);
    if (!player) {
      console.error(`❌ Player ${username} not found in game`);
      console.log('📋 Available players:', room.gameState.players.map(p => p.name));
      ws.send(JSON.stringify({ 
        type: 'ERROR', 
        payload: { message: 'Player not found in game' } 
      }));
      return;
    }

    if (!player.hand || !Array.isArray(player.hand)) {
      console.error(`❌ Player ${username} has no hand or hand is not an array!`);
      ws.send(JSON.stringify({ 
        type: 'ERROR', 
        payload: { message: 'Invalid hand data' } 
      }));
      return;
    }

    console.log(`✅ Found player with ${player.hand.length} cards`);
    console.log(`📋 Sample cards:`, player.hand.slice(0, 3).map(c => `${c.color || 'wild'} ${c.type} ${c.value !== undefined ? c.value : ''}`));

    const response = {
      type: 'YOUR_HAND',
      payload: { 
        hand: player.hand,
        playerName: username
      }
    };

    ws.send(JSON.stringify(response));
    console.log(`✅ Successfully sent ${player.hand.length} cards to ${username}`);
    console.log('===================================\n');
  } catch (error) {
    console.error('❌ Error in handleRequestHand:', error);
    ws.send(JSON.stringify({ 
      type: 'ERROR', 
      payload: { message: 'Failed to get hand: ' + error.message } 
    }));
  }
}

async function handleSelectWord(ws, payload) {
  try {
    const { roomCode, word } = payload;
    console.log('📝 Word selected:', { roomCode, word });

    const room = await GameRoom.findOne({ roomCode });
    if (!room || !room.gameState.scribble) {
      console.error('❌ Room or scribble state not found');
      return;
    }

    // Update game state with selected word
    room.gameState.scribble.currentWord = word;
    room.gameState.scribble.drawingStarted = true;
    room.gameState.scribble.wordOptions = [];
    room.gameState.scribble.drawingStartTime = Date.now();
    
    await room.save();

    console.log('✅ Word selected and saved:', word);

    // Broadcast to all players that word was selected
    broadcastToRoom(roomCode, {
      type: 'WORD_SELECTED',
      gameState: room.gameState.scribble
    });

  } catch (error) {
    console.error('❌ Error in handleSelectWord:', error);
  }
}

async function handleDrawLine(ws, payload) {
  try {
    const { roomCode, line } = payload;
    
    // Broadcast the line to all OTHER users in the room (not the sender)
    const users = roomConnections.get(roomCode);
    if (!users) return;

    users.forEach(username => {
      const userWs = clients.get(username);
      if (userWs && userWs !== ws && userWs.readyState === WebSocket.OPEN) {
        userWs.send(JSON.stringify({
          type: 'DRAW_LINE',
          line: line
        }));
      }
    });

  } catch (error) {
    console.error('❌ Error in handleDrawLine:', error);
  }
}

async function handleClearCanvas(ws, payload) {
  try {
    const { roomCode } = payload;
    
    // Broadcast clear to all OTHER users in the room
    const users = roomConnections.get(roomCode);
    if (!users) return;

    users.forEach(username => {
      const userWs = clients.get(username);
      if (userWs && userWs !== ws && userWs.readyState === WebSocket.OPEN) {
        userWs.send(JSON.stringify({
          type: 'CLEAR_CANVAS'
        }));
      }
    });

  } catch (error) {
    console.error('❌ Error in handleClearCanvas:', error);
  }
}

module.exports = initWebSocket;