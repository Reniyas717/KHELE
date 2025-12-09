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
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Missing roomCode or username' } }));
      return;
    }

    console.log(`\n🚪 ${username} attempting to join room ${roomCode}`);

    // Remove old connection if exists
    const oldWs = clients.get(username);
    if (oldWs && oldWs !== ws && oldWs.readyState === WebSocket.OPEN) {
      console.log(`⚠️ Closing old connection for ${username}`);
      oldWs.close();
    }

    // Store new connection FIRST
    clients.set(username, ws);
    console.log(`✅ Stored connection for ${username}`);
    
    // Add to room connections
    if (!roomConnections.has(roomCode)) {
      roomConnections.set(roomCode, new Set());
    }
    roomConnections.get(roomCode).add(username);
    console.log(`📋 Room ${roomCode} now has users:`, Array.from(roomConnections.get(roomCode)));

    // Get room from database
    const room = await GameRoom.findOne({ roomCode, isActive: true });
    if (!room) {
      console.error(`❌ Room ${roomCode} not found`);
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Room not found' } }));
      return;
    }

    // Add player to database if not already there
    const existingPlayer = room.players.find(p => p.username === username);
    if (!existingPlayer) {
      console.log(`➕ Adding ${username} to room database`);
      room.players.push({
        username: username,
        score: 0
      });
      await room.save();
      console.log(`✅ Player added. Room now has ${room.players.length} players:`, room.players.map(p => p.username));
    } else {
      console.log(`ℹ️ ${username} already in database`);
    }

    // Reload room to get fresh data
    const updatedRoom = await GameRoom.findOne({ roomCode, isActive: true });

    // Send confirmation to the joining player
    ws.send(JSON.stringify({ 
      type: 'JOINED_ROOM', 
      payload: { 
        roomCode, 
        room: {
          roomCode: updatedRoom.roomCode,
          host: updatedRoom.host,
          players: updatedRoom.players,
          isActive: updatedRoom.isActive,
          currentGame: updatedRoom.currentGame,
          gameState: updatedRoom.gameState
        }
      } 
    }));
    console.log(`✅ Sent JOINED_ROOM confirmation to ${username}`);

    // Wait a moment for the connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Broadcast to ALL users in the room (including the one who just joined)
    const playerJoinedMessage = {
      type: 'PLAYER_JOINED',
      payload: { 
        username, 
        players: updatedRoom.players
      }
    };

    console.log(`📢 Broadcasting PLAYER_JOINED for ${username}`);
    broadcastToRoom(roomCode, playerJoinedMessage);

    // Send ROOM_UPDATE to ensure everyone has the latest state
    const roomUpdateMessage = {
      type: 'ROOM_UPDATE',
      payload: { 
        room: {
          roomCode: updatedRoom.roomCode,
          host: updatedRoom.host,
          players: updatedRoom.players,
          isActive: updatedRoom.isActive,
          currentGame: updatedRoom.currentGame
        }
      }
    };

    console.log(`📢 Broadcasting ROOM_UPDATE`);
    broadcastToRoom(roomCode, roomUpdateMessage);

    console.log(`✅ ${username} successfully joined room ${roomCode}\n`);
  } catch (error) {
    console.error('❌ Error in handleJoinRoom:', error);
    ws.send(JSON.stringify({ type: 'ERROR', payload: { message: error.message } }));
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
    const { roomCode, gameType } = payload;
    
    console.log(`\n🎮 ========== STARTING GAME ==========`);
    console.log(`🏠 Room: ${roomCode}`);
    console.log(`🎯 Game Type: ${gameType}`);
    
    const room = await GameRoom.findOne({ roomCode, isActive: true });
    if (!room) {
      console.error(`❌ Room ${roomCode} not found`);
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Room not found' } }));
      return;
    }

    if (room.players.length < 2) {
      console.error(`❌ Not enough players (${room.players.length})`);
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Need at least 2 players' } }));
      return;
    }

    console.log(`👥 Players in room:`, room.players.map(p => p.username));

    // Initialize game based on type
    let gameState;
    if (gameType === 'scribble') {
      gameState = initScribbleGame(room.players.map(p => p.username));
      room.gameState = gameState;
      room.currentGame = 'scribble';
      console.log('✅ Scribble game initialized');
    } else if (gameType === 'uno') {
      gameState = initUNOGame(room.players.map(p => p.username));
      room.gameState = gameState;
      room.currentGame = 'uno';
      console.log('✅ UNO game initialized');
      console.log('🃏 Verifying all players have cards:');
      gameState.players.forEach(p => {
        console.log(`   - ${p.name}: ${p.hand.length} cards`);
      });
    }

    await room.save();
    console.log('💾 Game state saved to database');
    
    // Broadcast game started to ALL players
    const gameStartPayload = {
      type: 'GAME_STARTED',
      payload: { 
        gameType: gameType,
        gameState: gameState
      }
    };

    console.log(`📢 Broadcasting GAME_STARTED to all players in room ${roomCode}`);
    
    const users = roomConnections.get(roomCode);
    if (!users || users.size === 0) {
      console.error(`❌ No connected users found in room ${roomCode}`);
      return;
    }

    console.log(`👥 Broadcasting to ${users.size} users:`, Array.from(users));

    // Send to each player individually and confirm
    let successCount = 0;
    for (const playerUsername of users) {
      const playerWs = clients.get(playerUsername);
      if (playerWs && playerWs.readyState === WebSocket.OPEN) {
        try {
          playerWs.send(JSON.stringify(gameStartPayload));
          console.log(`  ✅ Sent to ${playerUsername}`);
          successCount++;
          
          // For UNO, also send individual hand
          if (gameType === 'uno') {
            const player = gameState.players.find(p => p.name === playerUsername);
            if (player && player.hand) {
              const handPayload = {
                type: 'YOUR_HAND',
                payload: { hand: player.hand, playerName: playerUsername }
              };
              playerWs.send(JSON.stringify(handPayload));
              console.log(`  🃏 Sent ${player.hand.length} cards to ${playerUsername}`);
            }
          }
        } catch (error) {
          console.error(`  ❌ Failed to send to ${playerUsername}:`, error.message);
        }
      } else {
        console.error(`  ❌ Connection not ready for ${playerUsername}`);
      }
    }

    console.log(`📊 Broadcast complete: ${successCount}/${users.size} successful`);
    console.log('========================================\n');
  } catch (error) {
    console.error('❌ Error in handleStartGame:', error);
    ws.send(JSON.stringify({ type: 'ERROR', payload: { message: error.message } }));
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
async function handleDrawLine(ws, payload) {
  const { roomCode, line } = payload;
  broadcastToRoom(roomCode, {
    type: 'DRAW_LINE',
    payload: { line }
  });
}

async function handleClearCanvas(ws, payload) {
  const { roomCode } = payload;
  broadcastToRoom(roomCode, {
    type: 'CLEAR_CANVAS',
    payload: {}
  });
}

async function handleChatMessage(ws, payload) {
  const { roomCode, username, message } = payload;
  broadcastToRoom(roomCode, {
    type: 'CHAT_MESSAGE',
    payload: { username, message }
  });
}

async function handleGuessWord(ws, payload) {
  try {
    const { roomCode, username, guess } = payload;
    
    const room = await GameRoom.findOne({ roomCode });
    if (!room) return;

    const result = handleGuess(room.gameState, username, guess);
    
    if (result.correct) {
      room.gameState = result.gameState;
      await room.save();

      broadcastToRoom(roomCode, {
        type: 'CORRECT_GUESS',
        payload: { username, gameState: result.gameState }
      });

      if (result.gameState.allGuessed) {
        broadcastToRoom(roomCode, {
          type: 'ROUND_COMPLETE',
          payload: { gameState: result.gameState }
        });
      }
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
    
    console.log(`📝 SELECT_WORD received for room ${roomCode}, word: ${word}`);
    
    const room = await GameRoom.findOne({ roomCode, isActive: true });
    if (!room) {
      console.error('❌ Room not found');
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Room not found' } }));
      return;
    }

    if (!room.gameState) {
      console.error('❌ No game state');
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'No active game' } }));
      return;
    }

    const { selectWord } = require('./controllers/scribbleGame');
    const result = selectWord(room.gameState, word);
    
    if (result.success) {
      room.gameState = result.gameState;
      await room.save();

      console.log('✅ Word selected, broadcasting to room');
      
      broadcastToRoom(roomCode, {
        type: 'WORD_SELECTED',
        payload: { gameState: result.gameState }
      });
    } else {
      console.error('❌ Word selection failed:', result.message);
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: result.message } }));
    }
  } catch (error) {
    console.error('❌ Error in handleSelectWord:', error);
    ws.send(JSON.stringify({ type: 'ERROR', payload: { message: error.message } }));
  }
}

module.exports = initWebSocket;