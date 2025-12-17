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

    const users = roomConnections.get(normalizedCode);
    if (users) {
      users.delete(username);
      if (users.size === 0) {
        roomConnections.delete(normalizedCode);
      }
    }
    clients.delete(username);

    const room = await GameRoom.findOne({ 
      roomCode: normalizedCode,
      isActive: true 
    });
    
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

    const playerNames = room.players.map(p => p.username);
    
    if (room.gameType === 'scribble') {
      room.gameState = initScribbleGame(playerNames);
      await room.save();
      
      console.log('✅ Scribble game initialized');
      
      // Broadcast game started to all
      broadcastToRoom(normalizedCode, {
        type: 'GAME_STARTED',
        payload: {
          gameType: room.gameType,
          gameState: room.gameState
        }
      });
      
      // Send word choices to drawer ONLY
      setTimeout(() => {
        const drawerClient = clients.get(room.gameState.currentDrawer);
        if (drawerClient && drawerClient.ws.readyState === WebSocket.OPEN) {
          drawerClient.ws.send(JSON.stringify({
            type: 'WORD_CHOICES',
            payload: { 
              wordChoices: room.gameState.wordOptions 
            }
          }));
          console.log(`📝 Sent word choices to drawer: ${room.gameState.currentDrawer}`);
        }
      }, 500);
      
    } else if (room.gameType === 'uno') {
      room.gameState = initUNOGame(playerNames);
      
      room.gameState.players.forEach((gp, index) => {
        room.players[index].hand = gp.hand;
      });
      
      await room.save();
      
      console.log('✅ UNO game initialized');
      
      broadcastToRoom(normalizedCode, {
        type: 'GAME_STARTED',
        payload: {
          gameType: room.gameType,
          gameState: {
            ...room.gameState,
            players: room.gameState.players.map(p => ({
              name: p.name,
              score: p.score,
              hand: []
            })),
            deck: []
          }
        }
      });
    }

    console.log('✅ Game started and broadcasted');
  } catch (error) {
    console.error('❌ Error starting game:', error);
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

// Handle chat messages
async function handleSendMessage(ws, payload) {
  try {
    const { roomCode, username, message } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('💬 SEND_MESSAGE:', { roomCode: normalizedCode, username, message });
    
    broadcastToRoom(normalizedCode, {
      type: 'CHAT_MESSAGE',
      payload: { username, message }
    });
    
    console.log('✅ Message broadcasted');
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

    room.gameState = selectWord(room.gameState, word);
    await room.save();
    
    // Send full word to drawer
    const drawerClient = clients.get(username);
    if (drawerClient && drawerClient.ws.readyState === WebSocket.OPEN) {
      drawerClient.ws.send(JSON.stringify({
        type: 'ROUND_START',
        payload: { gameState: room.gameState }
      }));
    }
    
    // Send masked word to guessers
    const guesserGameState = {
      ...room.gameState,
      currentWord: room.gameState.currentWord.replace(/./g, '_')
    };
    
    roomConnections.get(normalizedCode).forEach((playerName) => {
      if (playerName !== username) {
        const client = clients.get(playerName);
        if (client && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({
            type: 'ROUND_START',
            payload: { gameState: guesserGameState }
          }));
        }
      }
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

// Scribble: Guess word
async function handleGuessWord(ws, payload) {
  try {
    const { roomCode, username, guess } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();
    
    console.log('🎯 GUESS_WORD:', { roomCode: normalizedCode, username, guess });
    
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
          player: username,
          points: result.points, 
          gameState: room.gameState 
        }
      });

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
        payload: { username, message: guess }
      });
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
        remainingActive: remainingActive,
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
        hand: player.hand,
        gameState: {
          currentPlayer: room.gameState.currentPlayer,
          currentPlayerIndex: room.gameState.currentPlayerIndex,
          currentCard: room.gameState.currentCard,
          currentColor: room.gameState.currentColor,
          direction: room.gameState.direction,
          drawCount: room.gameState.drawCount,
          players: room.gameState.players.map(p => ({
            name: p.name,
            score: p.score,
            cardCount: p.hand.length,
            finished: p.finished,
            position: p.position,
            hand: []
          }))
        }
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

module.exports = initWebSocket;