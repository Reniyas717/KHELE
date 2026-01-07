const WebSocket = require('ws');
const GameRoom = require('./models/GameRoom');
const { initScribbleGame, handleGuess, nextRound, selectWord } = require('./controllers/scribbleGame');
const { initUNOGame, playCard, drawCard } = require('./controllers/unoGame');

// Store active connections
const clients = new Map(); // username -> { ws, roomCode }
const roomConnections = new Map(); // roomCode -> Set of usernames

// Store active timers
const roundTimers = new Map(); // roomCode -> timer reference

function initWebSocket(server) {
  const wss = new WebSocket.Server({ 
    server,
    path: '/ws'
  });

  wss.on('connection', (ws) => {
    console.log('🔌 New WebSocket connection');
    
    let currentUsername = null;
    let currentRoomCode = null;

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
            
          case 'CANVAS_DRAW':
            await handleCanvasDraw(ws, data.payload);
            break;
            
          case 'CANVAS_CLEAR':
            await handleCanvasClear(ws, data.payload);
            break;
            
          case 'SEND_MESSAGE':
            await handleSendMessage(ws, data.payload);
            break;
            
          case 'SUBMIT_GUESS':
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
            
          case 'TOD_SETTINGS_UPDATE':
            await handleTODSettingsUpdate(ws, data.payload);
            break;
            
          case 'TOD_GAME_START':
            await handleTODGameStart(ws, data.payload);
            break;
            
          case 'TOD_SPIN_WHEEL':
            await handleTODSpinWheel(ws, data.payload);
            break;
            
          case 'TOD_CARD_SELECTED':
            await handleTODCardSelected(ws, data.payload);
            break;
            
          case 'TOD_RATING_SUBMITTED':
            await handleTODRatingSubmitted(ws, data.payload);
            break;
            
          case 'TOD_NEXT_ROUND':
            await handleTODNextRound(ws, data.payload);
            break;
            
          case 'GAME_STARTED':
            await handleGameStartedBroadcast(ws, data.payload);
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

    const existingPlayer = room.players.find(p => p.username === username);
    const isNewPlayer = !existingPlayer;

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

    clients.set(username, { ws, roomCode: normalizedCode });
    
    if (!roomConnections.has(normalizedCode)) {
      roomConnections.set(normalizedCode, new Set());
    }
    roomConnections.get(normalizedCode).add(username);

    console.log(`📊 Room ${normalizedCode} now has ${roomConnections.get(normalizedCode).size} connected clients`);

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

    ws.send(JSON.stringify({
      type: 'ROOM_JOINED',
      payload: { room: roomData }
    }));
    console.log(`✅ Sent ROOM_JOINED to ${username}`);

    setTimeout(() => {
      broadcastToRoom(normalizedCode, {
        type: 'PLAYER_JOINED',
        payload: {
          username,
          room: roomData
        }
      });
    }, 100);

    console.log('✅ JOIN complete');
    
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

    // Clear timer if host leaves
    const room = await GameRoom.findOne({ 
      roomCode: normalizedCode,
      isActive: true 
    });
    
    if (room && room.host === username) {
      if (roundTimers.has(normalizedCode)) {
        clearTimeout(roundTimers.get(normalizedCode));
        roundTimers.delete(normalizedCode);
        console.log('⏱️ Timer cleared - host left');
      }
    }

    const users = roomConnections.get(normalizedCode);
    if (users) {
      users.delete(username);
      if (users.size === 0) {
        roomConnections.delete(normalizedCode);
        // Clear timer if room is empty
        if (roundTimers.has(normalizedCode)) {
          clearTimeout(roundTimers.get(normalizedCode));
          roundTimers.delete(normalizedCode);
          console.log('⏱️ Timer cleared - room empty');
        }
      }
    }
    clients.delete(username);

    if (!room) {
      console.log('⚠️ Room not found or already inactive');
      return;
    }

    room.players = room.players.filter(p => p.username !== username);
    
    if (room.players.length === 0) {
      room.isActive = false;
      await room.save();
      console.log(`🗑️ Room ${normalizedCode} deactivated (no players)`);
    } else if (room.host === username && room.status === 'waiting') {
      room.host = room.players[0].username;
      await room.save();
      
      console.log(`👑 Host transferred to ${room.host}`);
      
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
      room.isActive = false;
      room.status = 'finished';
      await room.save();
      
      console.log(`🛑 Game ended (host left): ${normalizedCode}`);
      
      broadcastToRoom(normalizedCode, {
        type: 'ROOM_CLOSED',
        payload: { message: 'Host left the game' }
      });
    } else {
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
  const { roomCode, username, gameType } = payload;
  console.log('🎮 Starting game:', { roomCode, username, gameType });

  try {
    const normalizedCode = roomCode.toUpperCase().trim();
    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    
    if (!room) {
      console.error('❌ Room not found:', normalizedCode);
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Room not found' }
      }));
      return;
    }

    console.log('🔍 Room found:', {
      host: room.host,
      requestingUser: username,
      isHost: room.host === username,
      players: room.players.map(p => p.username)
    });

    // Check if user is host
    if (room.host !== username) {
      console.error('❌ Not host:', { host: room.host, user: username });
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Only host can start the game' }
      }));
      return;
    }

    console.log('✅ User is host, initializing game...');

    // Update room status
    room.status = 'in-progress';
    
    // Initialize game based on type
    let gameState = null;
    const actualGameType = gameType || room.gameType;
    
    console.log('🎯 Initializing game type:', actualGameType);
    
    // Get player names array from room
    const playerNames = room.players.map(p => p.username);
    console.log('👥 Player names:', playerNames);
    
    if (actualGameType === 'scribble') {
      // Pass roomCode - scribbleGame fetches room internally
      gameState = await initScribbleGame(normalizedCode);
    } else if (actualGameType === 'uno') {
      // Pass player names array to UNO game
      gameState = await initUNOGame(playerNames);
    }
    
    // Save game state to room
    if (gameState) {
      room.gameState = gameState;
      room.markModified('gameState');
    }
    
    await room.save();
    
    console.log('💾 Room status updated to in-progress');

    // Broadcast GAME_STARTED to all players with the gameType
    console.log('📢 Broadcasting GAME_STARTED to all players...');
    broadcastToRoom(normalizedCode, {
      type: 'GAME_STARTED',
      payload: {
        roomCode: normalizedCode,
        gameType: actualGameType,
        game: actualGameType,
        gameState: gameState || null
      }
    });

    console.log('✅ GAME_STARTED broadcast complete');

  } catch (error) {
    console.error('❌ Error in handleStartGame:', error);
    console.error('❌ Error stack:', error.stack);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: 'Failed to start game: ' + error.message }
    }));
  }
}

// Handle canvas drawing
async function handleCanvasDraw(ws, payload) {
  try {
    const { roomCode, drawData } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('🎨 CANVAS_DRAW received:', normalizedCode);
    
    const connections = roomConnections.get(normalizedCode);
    if (!connections) {
      console.log('❌ No connections found for room:', normalizedCode);
      return;
    }
    
    // Broadcast to all OTHER players
    connections.forEach((username) => {
      const client = clients.get(username);
      if (client && client.ws !== ws && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'CANVAS_DRAW',
          payload: { drawData }
        }));
      }
    });
    
    console.log(`✅ Canvas draw broadcasted to ${connections.size - 1} players`);
  } catch (error) {
    console.error('❌ Error in handleCanvasDraw:', error);
  }
}

// Handle canvas clear
async function handleCanvasClear(ws, payload) {
  try {
    const { roomCode } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('🧹 CANVAS_CLEAR received:', normalizedCode);
    
    broadcastToRoom(normalizedCode, {
      type: 'CANVAS_CLEAR',
      payload: {}
    });
    
    console.log('✅ Canvas clear broadcasted');
  } catch (error) {
    console.error('❌ Error in handleCanvasClear:', error);
  }
}

// Handle chat messages - only visible to those who guessed correctly
async function handleSendMessage(ws, payload) {
  try {
    const { roomCode, username, message } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('💬 SEND_MESSAGE:', { roomCode: normalizedCode, username, message });
    
    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    
    if (!room || !room.gameState) {
      console.log('⚠️ Room or game state not found');
      return;
    }
    
    // Get the player who sent the message
    const senderPlayer = room.gameState.players.find(p => p.username === username);
    const isDrawer = username === room.gameState.currentDrawer;
    const hasGuessed = senderPlayer?.hasGuessed || false;
    
    console.log(`📊 Message from ${username}: isDrawer=${isDrawer}, hasGuessed=${hasGuessed}`);
    
    // Determine who can see this message
    const connections = roomConnections.get(normalizedCode);
    if (!connections) {
      console.log('❌ No connections found for room');
      return;
    }
    
    // Send message only to eligible players
    connections.forEach((playerName) => {
      const playerData = room.gameState.players.find(p => p.username === playerName);
      const isPlayerDrawer = playerName === room.gameState.currentDrawer;
      const playerHasGuessed = playerData?.hasGuessed || false;
      
      // Can see message if:
      // 1. They are the drawer
      // 2. They have guessed correctly
      // 3. They are the sender
      const canSeeMessage = isPlayerDrawer || playerHasGuessed || playerName === username;
      
      if (canSeeMessage) {
        const client = clients.get(playerName);
        if (client && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({
            type: 'CHAT_MESSAGE',
            payload: { 
              username, 
              message,
              isDrawer,
              hasGuessed: hasGuessed || isDrawer
            }
          }));
          console.log(`   ✅ Sent to ${playerName} (canSee: ${canSeeMessage})`);
        }
      } else {
        console.log(`   ⏭️ Skipped ${playerName} (hasn't guessed)`);
      }
    });
    
    console.log('✅ Filtered message broadcast complete');
  } catch (error) {
    console.error('❌ Error in handleSendMessage:', error);
  }
}

// Scribble: Select word
async function handleSelectWord(ws, payload) {
  try {
    const { roomCode, word, username } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('📝 SELECT_WORD:', { roomCode: normalizedCode, word, username });
    
    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    
    if (!room || !room.gameState) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not found' }
      }));
      return;
    }

    console.log('🔍 Before selectWord:', {
      currentWord: room.gameState.currentWord,
      wordOptions: room.gameState.wordOptions
    });

    // Update game state with selected word
    room.gameState = selectWord(room.gameState, word);
    
    console.log('🔍 After selectWord:', {
      currentWord: room.gameState.currentWord,
      roundActive: room.gameState.roundActive,
      wordOptions: room.gameState.wordOptions,
      roundTimer: room.gameState.roundTimer
    });

    // Mark the field as modified and save
    room.markModified('gameState');
    await room.save();
    
    console.log('💾 Game state saved with word:', room.gameState.currentWord);
    
    // Verify it was saved
    const verifyRoom = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    console.log('✅ Verified saved word:', verifyRoom.gameState.currentWord);
    
    // Send full word to drawer
    const drawerClient = clients.get(username);
    if (drawerClient && drawerClient.ws.readyState === WebSocket.OPEN) {
      drawerClient.ws.send(JSON.stringify({
        type: 'ROUND_START',
        payload: { 
          gameState: room.gameState,
          timeLimit: room.gameState.roundTimer
        }
      }));
      console.log(`✅ Sent ROUND_START to drawer: ${username}`);
    }
    
    // Send masked word to guessers
    const guesserGameState = {
      ...room.gameState,
      currentWord: room.gameState.currentWord.replace(/./g, '_')
    };
    
    const connections = roomConnections.get(normalizedCode);
    if (connections) {
      connections.forEach((playerName) => {
        if (playerName !== username) {
          const client = clients.get(playerName);
          if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
              type: 'ROUND_START',
              payload: { 
                gameState: guesserGameState,
                timeLimit: room.gameState.roundTimer
              }
            }));
            console.log(`✅ Sent ROUND_START to guesser: ${playerName}`);
          }
        }
      });
    }

    // Clear any existing timer for this room
    if (roundTimers.has(normalizedCode)) {
      clearTimeout(roundTimers.get(normalizedCode));
      console.log('⏱️ Cleared existing timer');
    }

    // Start round timer
    const timerDuration = room.gameState.roundTimer * 1000; // Convert to milliseconds
    console.log(`⏱️ Starting ${room.gameState.roundTimer}s timer for round`);
    
    const timer = setTimeout(async () => {
      console.log('⏰ Time\'s up! Ending round...');
      
      // Broadcast time up message
      broadcastToRoom(normalizedCode, {
        type: 'TIME_UP',
        payload: { 
          word: room.gameState.currentWord,
          message: `Time's up! The word was: ${room.gameState.currentWord}`
        }
      });
      
      // Wait a moment then move to next round
      setTimeout(async () => {
        await handleNextRound(ws, { roomCode: normalizedCode });
        roundTimers.delete(normalizedCode);
      }, 3000);
    }, timerDuration);
    
    roundTimers.set(normalizedCode, timer);

    console.log(`✅ Word selected and broadcasted: ${word}`);
  } catch (error) {
    console.error('❌ Error in handleSelectWord:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: error.message }
    }));
  }
}

// Scribble: Guess word
async function handleGuessWord(ws, payload) {
  try {
    const { roomCode, username, guess } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('🎯 GUESS_WORD:', { roomCode: normalizedCode, username, guess });
    
    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    
    if (!room || !room.gameState) {
      console.error('❌ Room or game state not found');
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not found' }
      }));
      return;
    }

    console.log('🔍 Current game state:', {
      currentWord: room.gameState.currentWord,
      currentDrawer: room.gameState.currentDrawer,
      roundActive: room.gameState.roundActive
    });

    const result = handleGuess(room.gameState, username, guess);
    
    if (result.success) {
      if (result.correct) {
        // Update room with new game state
        room.gameState = result.gameState;
        room.markModified('gameState');
        await room.save();
        
        console.log(`✅ ${username} guessed correctly!`);
        
        // Broadcast correct guess to all players
        broadcastToRoom(normalizedCode, {
          type: 'CORRECT_GUESS',
          payload: { 
            player: username,
            points: result.points, 
            gameState: room.gameState 
          }
        });

        // If all players guessed, clear timer and end the round
        if (result.allGuessed) {
          console.log('🏁 All players guessed! Ending round...');
          
          // Clear the timer
          if (roundTimers.has(normalizedCode)) {
            clearTimeout(roundTimers.get(normalizedCode));
            roundTimers.delete(normalizedCode);
            console.log('⏱️ Timer cleared - all players guessed');
          }
          
          // Broadcast that round is complete
          broadcastToRoom(normalizedCode, {
            type: 'ROUND_COMPLETE',
            payload: { 
              word: room.gameState.currentWord,
              message: `Everyone guessed! The word was: ${room.gameState.currentWord}`
            }
          });
          
          // Wait a moment then move to next round
          setTimeout(async () => {
            await handleNextRound(ws, { roomCode: normalizedCode });
          }, 3000);
        }
      } else {
        // Wrong guess - broadcast as chat message to all players who haven't guessed
        console.log(`❌ ${username} guessed wrong: ${guess}`);
        
        const connections = roomConnections.get(normalizedCode);
        if (connections) {
          connections.forEach((playerName) => {
            const playerData = room.gameState.players.find(p => p.username === playerName);
            const isPlayerDrawer = playerName === room.gameState.currentDrawer;
            const playerHasGuessed = playerData?.hasGuessed || false;
            
            // Show wrong guesses to everyone who hasn't guessed yet
            const canSeeGuess = isPlayerDrawer || !playerHasGuessed || playerName === username;
            
            if (canSeeGuess) {
              const client = clients.get(playerName);
              if (client && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify({
                  type: 'CHAT_MESSAGE',
                  payload: { 
                    username, 
                    message: guess,
                    isDrawer: false,
                    hasGuessed: false
                  }
                }));
              }
            }
          });
        }
      }
    } else {
      console.log('⚠️ Guess handling failed:', result.message);
    }
  } catch (error) {
    console.error('❌ Error in handleGuessWord:', error);
  }
}

// Scribble: Next round
async function handleNextRound(ws, payload) {
  try {
    const { roomCode } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('➡️ NEXT_ROUND:', normalizedCode);
    
    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    
    if (!room || !room.gameState) {
      return;
    }

    const result = nextRound(room.gameState);
    
    if (result.gameOver) {
      // Clear any active timer
      if (roundTimers.has(normalizedCode)) {
        clearTimeout(roundTimers.get(normalizedCode));
        roundTimers.delete(normalizedCode);
      }
      
      broadcastToRoom(normalizedCode, {
        type: 'GAME_OVER',
        payload: result
      });
      
      room.status = 'finished';
      await room.save();
    } else {
      room.gameState = result.gameState;
      room.markModified('gameState');
      await room.save();
      
      broadcastToRoom(normalizedCode, {
        type: 'NEXT_ROUND',
        payload: { gameState: result.gameState }
      });
      
      // Send new word choices to new drawer
      setTimeout(() => {
        const drawerClient = clients.get(room.gameState.currentDrawer);
        if (drawerClient && drawerClient.ws.readyState === WebSocket.OPEN) {
          drawerClient.ws.send(JSON.stringify({
            type: 'WORD_CHOICES',
            payload: { 
              wordChoices: room.gameState.wordOptions 
            }
          }));
          console.log(`📝 Sent word choices to new drawer: ${room.gameState.currentDrawer}`);
        }
      }, 500);
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
    
    console.log('🎴 handlePlayCard:', { roomCode: normalizedCode, username, cardIndex, chosenColor });
    
    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    
    if (!room || !room.gameState) {
      console.error('❌ Room or gameState not found');
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not found' }
      }));
      return;
    }

    const beforeFinished = room.gameState.players.filter(p => p.finished).length;
    console.log('📊 BEFORE PLAY:', {
      currentPlayer: room.gameState.currentPlayer,
      finishedPlayers: beforeFinished,
      totalPlayers: room.gameState.players.length,
      playerStates: room.gameState.players.map(p => ({ 
        name: p.name, 
        cards: p.hand?.length || 0, 
        finished: p.finished 
      }))
    });

    const result = playCard(room.gameState, username, cardIndex, chosenColor);
    
    if (result.success) {
      room.gameState = result.gameState;
      
      const afterFinished = room.gameState.players.filter(p => p.finished).length;
      const remainingActive = room.gameState.players.filter(p => !p.finished).length;
      
      console.log('📊 AFTER PLAY:', {
        currentPlayer: room.gameState.currentPlayer,
        finishedPlayers: afterFinished,
        remainingActive: room.gameState.players.filter(p => !p.finished).length,
        totalPlayers: room.gameState.players.length,
        playerStates: room.gameState.players.map(p => ({ 
          name: p.name, 
          cards: p.hand?.length || 0, 
          finished: p.finished 
        }))
      });
      
      if (remainingActive <= 1 && !result.gameOver) {
        console.log('🚨 FORCE GAME OVER - Only 1 or 0 players remaining!');
        
        room.gameState.players.forEach(p => {
          if (!p.finished) {
            p.finished = true;
            p.position = room.gameState.players.length;
            console.log(`🏅 Force finishing ${p.name} at position ${p.position}`);
          }
        });
        
        const rankings = room.gameState.players
          .sort((a, b) => a.position - b.position)
          .map(p => ({
            name: p.name,
            position: p.position,
            points: p.score
          }));
        
        result.gameOver = true;
        result.rankings = rankings;
        
        console.log('🏆 FORCED RANKINGS:', rankings);
      }
      
      room.gameState.players.forEach((gamePlayer) => {
        const roomPlayer = room.players.find(p => p.username === gamePlayer.name);
        if (roomPlayer) {
          roomPlayer.hand = gamePlayer.hand;
        }
      });
      
      room.markModified('gameState');
      room.markModified('players');
      await room.save();
      
      console.log('💾 Game state saved to database');
      
      const broadcastGameState = {
        ...result.gameState,
        players: result.gameState.players.map(p => ({
          name: p.name,
          score: p.score,
          cardCount: p.hand.length,
          finished: p.finished,
          position: p.position,
          hand: []
        })),
        deck: []
      };
      
      broadcastToRoom(normalizedCode, {
        type: 'CARD_PLAYED',
        payload: { 
          username,
          gameState: broadcastGameState
        }
      });
      
      if (result.autoDrawn && !result.gameOver) {
        setTimeout(() => {
          broadcastToRoom(normalizedCode, {
            type: 'AUTO_DRAWN',
            payload: {
              playerName: result.autoDrawn.playerName,
              cardsDrawn: result.autoDrawn.cardsDrawn,
              gameState: broadcastGameState
            }
          });
        }, 500);
      }
      
      if (result.playerFinished && !result.gameOver) {
        console.log(`🎯 Player finished but game continues: ${result.playerFinished}`);
        broadcastToRoom(normalizedCode, {
          type: 'PLAYER_FINISHED',
          payload: {
            playerName: result.playerFinished,
            position: result.finishedPosition,
            points: result.pointsEarned,
            remainingPlayers: result.remainingPlayers
          }
        });
      }
      
      if (result.gameOver) {
        console.log('🏁 GAME OVER! Broadcasting final rankings...');
        console.log('🏆 Rankings:', result.rankings);
        
        setTimeout(() => {
          broadcastToRoom(normalizedCode, {
            type: 'GAME_OVER',
            payload: {
              rankings: result.rankings,
              finalScores: result.rankings.map(r => ({
                name: r.name,
                points: r.points
              }))
            }
          });
          
          room.status = 'finished';
          room.save();
          console.log('✅ Game over broadcast sent and room marked as finished');
        }, 1000);
      }
    } else {
      console.error('❌ Card play failed:', result.message);
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
    
    console.log('🎴 handleDrawCardAction:', { roomCode: normalizedCode, username });
    
    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    
    if (!room || !room.gameState) {
      console.error('❌ Room or gameState not found');
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not found' }
      }));
      return;
    }

    console.log('📊 Before draw - Current player:', room.gameState.currentPlayer);

    const result = drawCard(room.gameState, username);
    
    if (result.success) {
      room.gameState = result.gameState;
      
      console.log('📊 After draw - Current player:', room.gameState.currentPlayer);
      console.log('📊 After draw - Players:', room.gameState.players.map(p => ({ 
        name: p.name, 
        cards: p.hand.length 
      })));
      
      room.gameState.players.forEach((gamePlayer) => {
        const roomPlayer = room.players.find(p => p.username === gamePlayer.name);
        if (roomPlayer) {
          roomPlayer.hand = gamePlayer.hand;
        }
      });
      
      room.markModified('gameState');
      room.markModified('players');
      
      await room.save();
      
      console.log('💾 Game state saved to database');
      
      const verifyRoom = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
      console.log('✅ Verified saved state - Current player:', verifyRoom.gameState.currentPlayer);
      
      console.log('✅ Card drawn successfully, broadcasting...');
      
      const broadcastGameState = {
        ...result.gameState,
        players: result.gameState.players.map(p => ({
          name: p.name,
          score: p.score,
          cardCount: p.hand.length,
          hand: []
        })),
        deck: []
      };
      
      broadcastToRoom(normalizedCode, {
        type: 'CARD_DRAWN',
        payload: { 
          username,
          gameState: broadcastGameState
        }
      });
    } else {
      console.error('❌ Card draw failed:', result.message);
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

    console.log('🔍 Game state current player:', room.gameState.currentPlayer);
    console.log('🔍 Game state players:', room.gameState.players?.map(p => ({ 
      name: p.name, 
      cards: p.hand?.length || 0 
    })));
    
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

    console.log(`✅ Sending ${player.hand.length} cards to ${username}`);

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

// ===========================================
// TRUTH OR DARE HANDLERS (NEW)
// ===========================================

async function handleTODSettingsUpdate(ws, payload) {
  try {
    const { roomCode, settings } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('⚙️ TOD_SETTINGS_UPDATE:', { roomCode: normalizedCode, settings });
    
    broadcastToRoom(normalizedCode, {
      type: 'TOD_SETTINGS_UPDATE',
      payload: { settings }
    }, null); // Send to ALL players
  } catch (error) {
    console.error('❌ Error in handleTODSettingsUpdate:', error);
  }
}

async function handleTODGameStart(ws, payload) {
  try {
    const { roomCode, settings } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('🎮 TOD_GAME_START:', { roomCode: normalizedCode, settings });
    
    broadcastToRoom(normalizedCode, {
      type: 'TOD_GAME_START',
      payload: { settings }
    }, null); // Send to ALL players
  } catch (error) {
    console.error('❌ Error in handleTODGameStart:', error);
  }
}

async function handleTODSpinWheel(ws, payload) {
  try {
    const { roomCode, selectedPlayer, cards } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('🎡 TOD_SPIN_WHEEL:', { roomCode: normalizedCode, selectedPlayer, cardsCount: cards?.length });
    console.log('📦 Cards being broadcast:', cards);
    
    broadcastToRoom(normalizedCode, {
      type: 'TOD_SPIN_WHEEL',
      payload: { 
        selectedPlayer,
        cards: cards || []
      }
    }, null); // Send to ALL players
  } catch (error) {
    console.error('❌ Error in handleTODSpinWheel:', error);
  }
}

async function handleTODCardSelected(ws, payload) {
  try {
    const { roomCode, card } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('🎴 TOD_CARD_SELECTED:', { roomCode: normalizedCode, card });
    
    broadcastToRoom(normalizedCode, {
      type: 'TOD_CARD_SELECTED',
      payload: { card }
    }, null); // Send to ALL players
  } catch (error) {
    console.error('❌ Error in handleTODCardSelected:', error);
  }
}

async function handleTODRatingSubmitted(ws, payload) {
  try {
    const { roomCode, rater, rating } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('⭐ TOD_RATING_SUBMITTED:', { roomCode: normalizedCode, rater, rating });
    
    broadcastToRoom(normalizedCode, {
      type: 'TOD_RATING_SUBMITTED',
      payload: { rater, rating }
    }, null); // Send to ALL players
  } catch (error) {
    console.error('❌ Error in handleTODRatingSubmitted:', error);
  }
}

async function handleTODNextRound(ws, payload) {
  try {
    const { roomCode, scores, round } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('➡️ TOD_NEXT_ROUND:', { roomCode: normalizedCode, round, scores });
    
    broadcastToRoom(normalizedCode, {
      type: 'TOD_NEXT_ROUND',
      payload: { scores, round }
    }, null); // Send to ALL players
  } catch (error) {
    console.error('❌ Error in handleTODNextRound:', error);
  }
}

// Add this function after the other handlers:

async function handleGameStartedBroadcast(ws, payload) {
  try {
    const { roomCode, gameType, game } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('🎮 Broadcasting GAME_STARTED:', { roomCode: normalizedCode, gameType: gameType || game });
    
    // Broadcast to ALL players
    broadcastToRoom(normalizedCode, {
      type: 'GAME_STARTED',
      payload: { 
        gameType: gameType || game,
        game: gameType || game
      }
    }, null); // Send to everyone
  } catch (error) {
    console.error('❌ Error in handleGameStartedBroadcast:', error);
  }
}

module.exports = initWebSocket;