const WebSocket = require('ws');
const GameRoom = require('./models/GameRoom');
const { initScribbleGame, handleGuess, nextRound, selectWord } = require('./controllers/scribbleGame');
const { initUNOGame, playCard, drawCard } = require('./controllers/unoGame');
const {
  initMonopolyGame,
  rollDice,
  buyProperty,
  buildHouse,
  mortgageProperty,
  endTurn,
  useJailCard,
  payJailFee
} = require('./controllers/monopolyGame');

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

          case 'MONOPOLY_ROLL_DICE':
            await handleMonopolyRollDice(ws, data.payload);
            break;

          case 'MONOPOLY_BUY_PROPERTY':
            await handleMonopolyBuyProperty(ws, data.payload);
            break;

          case 'MONOPOLY_BUILD_HOUSE':
            await handleMonopolyBuildHouse(ws, data.payload);
            break;

          case 'MONOPOLY_MORTGAGE_PROPERTY':
            await handleMonopolyMortgageProperty(ws, data.payload);
            break;

          case 'MONOPOLY_END_TURN':
            await handleMonopolyEndTurn(ws, data.payload);
            break;

          case 'MONOPOLY_USE_JAIL_CARD':
            await handleMonopolyUseJailCard(ws, data.payload);
            break;

          case 'MONOPOLY_PAY_JAIL_FEE':
            await handleMonopolyPayJailFee(ws, data.payload);
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
  const { roomCode, username, gameType, botCount = 0, botDifficulty = 'medium' } = payload;
  console.log('🎮 Starting game:', { roomCode, username, gameType, botCount, botDifficulty });

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

    // Determine actual game type first (needed for bot names)
    const actualGameType = gameType || room.gameType;
    console.log('🎯 Game type:', actualGameType);

    // Get player names array from room
    let playerNames = room.players.map(p => p.username);
    console.log('👥 Player names:', playerNames);

    // Create bot players if requested
    if (botCount > 0) {
      console.log(`🤖 Creating ${botCount} bot player(s) with ${botDifficulty} difficulty`);

      // Bot names based on game type
      const botNamesByGame = {
        scribble: ['Picasso Bot', 'Doodle Master', 'Sketch Wizard'],
        uno: ['Card Shark', 'Uno Champion', 'Deck Master'],
        truthordare: ['Truth Seeker', 'Dare Devil', 'Challenge Bot']
      };

      const botNames = botNamesByGame[actualGameType] || ['Bot 1', 'Bot 2', 'Bot 3'];

      for (let i = 0; i < Math.min(botCount, 3); i++) {
        const botName = botNames[i];

        // Add bot to room players
        room.players.push({
          username: botName,
          score: 0,
          status: 'waiting',
          hand: [],
          hasGuessed: false,
          isBot: true,
          difficulty: botDifficulty
        });

        playerNames.push(botName);
        console.log(`✅ Added bot: ${botName}`);
      }

      await room.save();
      console.log(`💾 Saved room with ${botCount} bots`);
    }

    // Initialize game based on type
    let gameState = null;

    console.log('🎯 Initializing game type:', actualGameType);

    if (actualGameType === 'scribble') {
      // Scribble game handles its own saving
      gameState = await initScribbleGame(normalizedCode);
    } else if (actualGameType === 'uno') {
      // Initialize UNO game with full player objects (includes bot info)
      gameState = initUNOGame(room.players);

      // CRITICAL FIX: Ensure bot flags are set correctly by cross-referencing with room.players
      console.log('🔧 Fixing bot flags in game state...');
      gameState.players.forEach((gamePlayer, index) => {
        const roomPlayer = room.players.find(p => p.username === gamePlayer.username);
        if (roomPlayer && roomPlayer.isBot === true) {
          console.log(`🔧 Setting ${gamePlayer.username} as bot`);
          gamePlayer.isBot = true;
          gamePlayer.difficulty = roomPlayer.difficulty || 'medium';
        }
      });

      console.log('🎮 UNO game initialized:', {
        players: gameState.players.map(p => p.username),
        hands: Object.keys(gameState.hands).map(name => ({ name, cards: gameState.hands[name].length })),
        currentPlayer: gameState.currentPlayer,
        currentCard: gameState.discardPile[gameState.discardPile.length - 1],
        deckSize: gameState.deck.length,
        bots: gameState.players.filter(p => p.isBot).map(p => `${p.username} (${p.difficulty})`)
      });

      // Save game state to room
      room.gameState = gameState;
      room.markModified('gameState');

      console.log('💾 Saving UNO game state to database...');
      await room.save();

      // Verify save
      const verifyRoom = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
      console.log('✅ Verified save:', {
        hasGameState: !!verifyRoom.gameState,
        hasHands: !!verifyRoom.gameState?.hands,
        playersInHands: verifyRoom.gameState?.hands ? Object.keys(verifyRoom.gameState.hands) : []
      });
    } else if (actualGameType === 'truthordare') {
      // Truth or Dare doesn't need initial game state
      gameState = null;
    } else if (actualGameType === 'monopoly') {
      // Initialize Monopoly game
      gameState = initMonopolyGame(room.players);
      room.gameState = gameState;
      room.markModified('gameState');
      await room.save();
      console.log('🎲 Monopoly game initialized');

      // If first player is a bot, trigger their turn
      const firstPlayer = gameState.players[0];
      if (firstPlayer && firstPlayer.isBot) {
        console.log(`🤖 First player is bot: ${firstPlayer.username}, will trigger turn after game starts`);
      }
    }

    // Final save for room status
    await room.save();

    console.log('💾 Room status updated to in-progress');

    // Convert to frontend format for broadcast
    let frontendGameState = null;
    if (actualGameType === 'uno' && gameState) {
      frontendGameState = convertToFrontendGameState(gameState);
      console.log('🔄 Converted to frontend format:', {
        players: frontendGameState.players.map(p => p.name),
        currentPlayer: frontendGameState.currentPlayer,
        currentCard: frontendGameState.currentCard
      });
    } else {
      frontendGameState = gameState;
    }

    // Broadcast GAME_STARTED to all players
    console.log('📢 Broadcasting GAME_STARTED to all players...');
    broadcastToRoom(normalizedCode, {
      type: 'GAME_STARTED',
      payload: {
        roomCode: normalizedCode,
        gameType: actualGameType,
        game: actualGameType,
        gameState: frontendGameState
      }
    });

    // If UNO game and first player is a bot, trigger their turn
    if (actualGameType === 'uno' && gameState) {
      const firstPlayer = gameState.players[0];
      if (firstPlayer && firstPlayer.isBot) {
        console.log(`🤖 First player is bot: ${firstPlayer.username}, scheduling turn...`);

        const { makeBotDecision } = require('./utils/UNOBotAI');

        const getBotDelay = (difficulty) => {
          switch (difficulty) {
            case 'easy': return 2000 + Math.random() * 2000;
            case 'medium': return 1000 + Math.random() * 1500;
            case 'hard': return 500 + Math.random() * 1000;
            default: return 1500;
          }
        };

        const delay = getBotDelay(firstPlayer.difficulty || 'medium');

        setTimeout(async () => {
          try {
            console.log(`🤖 Bot ${firstPlayer.username} taking first turn...`);

            const botHand = gameState.hands[firstPlayer.username];
            const decision = makeBotDecision(botHand, gameState, firstPlayer.difficulty);

            if (decision.action === 'play') {
              console.log(`🤖 Bot ${firstPlayer.username} playing card`);
              await handlePlayCard(null, {
                roomCode: normalizedCode,
                username: firstPlayer.username,
                cardIndex: decision.cardIndex,
                chosenColor: decision.chosenColor
              });
            } else {
              console.log(`🤖 Bot ${firstPlayer.username} drawing card`);
              await handleDrawCardAction(null, {
                roomCode: normalizedCode,
                username: firstPlayer.username
              });
            }
          } catch (error) {
            console.error(`❌ Error in first bot turn:`, error);
          }
        }, delay + 1000); // Extra second to let UI load
      }
    }


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
  const { roomCode, username, cardIndex, chosenColor } = payload;
  console.log('🃏 PLAY_CARD:', { roomCode, username, cardIndex, chosenColor });

  try {
    const normalizedCode = roomCode.toUpperCase().trim();
    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });

    if (!room || !room.gameState) {
      if (ws) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Game not found' }
        }));
      }
      return;
    }

    const gameState = room.gameState;

    // Get the card from player's hand
    const hand = gameState.hands[username];
    if (!hand || cardIndex < 0 || cardIndex >= hand.length) {
      if (ws) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Invalid card index' }
        }));
      }
      return;
    }

    const card = hand[cardIndex];
    console.log('🎴 Playing card:', card);

    // Use controller function to play card
    const result = playCard(gameState, username, card.id, chosenColor);

    if (!result.success) {
      console.log('❌ Play card failed:', result.message);
      if (ws) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { message: result.message }
        }));
      }

      // If forced draw occurred, save and broadcast
      if (result.forcedDraw) {
        room.gameState = result.gameState;
        room.markModified('gameState');
        await room.save();

        const frontendGameState = convertToFrontendGameState(result.gameState);
        broadcastToRoom(normalizedCode, {
          type: 'FORCED_DRAW',
          payload: {
            player: username,
            drawnCards: result.drawnCards,
            gameState: frontendGameState
          }
        });

        // Check if next player is bot
        await triggerBotTurnIfNeeded(normalizedCode, result.gameState);
      }

      return;
    }

    // Success - save game state
    room.gameState = result.gameState;
    room.markModified('gameState');
    await room.save();

    // Convert to frontend format
    const frontendGameState = convertToFrontendGameState(result.gameState);

    // Check if player finished
    if (result.playerFinished) {
      console.log(`🏆 Player ${username} finished!`);

      const playerState = result.gameState.players.find(p => p.username === username);

      broadcastToRoom(normalizedCode, {
        type: 'PLAYER_FINISHED',
        payload: {
          player: username,
          position: playerState?.finishPosition,
          points: playerState?.points,
          rankings: result.gameState.finishedPlayers,
          activePlayers: result.gameState.activePlayers,
          gameState: frontendGameState
        }
      });

      // Check if game over
      if (result.gameOver) {
        console.log(`🎮 Game Over! Winner: ${result.gameState.winner}`);

        broadcastToRoom(normalizedCode, {
          type: 'GAME_OVER',
          payload: {
            winner: result.gameState.winner,
            rankings: result.gameState.finishedPlayers,
            gameState: frontendGameState
          }
        });

        return;
      }
    }

    // Broadcast card played
    console.log('📢 Broadcasting CARD_PLAYED');
    broadcastToRoom(normalizedCode, {
      type: 'CARD_PLAYED',
      payload: {
        player: username,
        card,
        gameState: frontendGameState
      }
    });

    // Check if next player is a bot and trigger their turn
    await triggerBotTurnIfNeeded(normalizedCode, result.gameState);

  } catch (error) {
    console.error('❌ Error in handlePlayCard:', error);
    console.error('Error stack:', error.stack);
    if (ws) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Failed to play card: ' + error.message }
      }));
    }
  }
}

// Helper function to trigger bot turns
async function triggerBotTurnIfNeeded(roomCode, gameState) {
  const currentPlayer = gameState.players.find(p => p.username === gameState.currentPlayer);

  if (!currentPlayer || !currentPlayer.isBot) {
    return;
  }

  console.log(`🤖 Next player is bot: ${currentPlayer.username} (${currentPlayer.difficulty})`);

  const { makeBotDecision } = require('./utils/UNOBotAI');

  const getBotDelay = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 2000 + Math.random() * 2000;
      case 'medium': return 1000 + Math.random() * 1500;
      case 'hard': return 500 + Math.random() * 1000;
      default: return 1500;
    }
  };

  const delay = getBotDelay(currentPlayer.difficulty || 'medium');
  console.log(`🤖 Scheduling bot turn in ${delay}ms...`);

  setTimeout(async () => {
    try {
      console.log(`🤖 Bot ${currentPlayer.username} taking turn...`);

      // Fetch fresh game state
      const freshRoom = await GameRoom.findOne({ roomCode: roomCode.toUpperCase().trim(), isActive: true });
      if (!freshRoom || !freshRoom.gameState) {
        console.error('❌ Room or game state not found');
        return;
      }

      const freshGameState = freshRoom.gameState;

      // Verify it's still bot's turn
      if (freshGameState.currentPlayer !== currentPlayer.username) {
        console.log(`⚠️ Not bot's turn anymore. Current: ${freshGameState.currentPlayer}`);
        return;
      }

      // Check if bot is finished
      const botPlayer = freshGameState.players.find(p => p.username === currentPlayer.username);
      if (botPlayer && botPlayer.isFinished) {
        console.log(`⚠️ Bot ${currentPlayer.username} has already finished`);
        return;
      }

      // Get bot's hand
      const botHand = freshGameState.hands[currentPlayer.username];
      if (!botHand || botHand.length === 0) {
        console.error('❌ Bot has no cards!');
        return;
      }

      // Make decision
      const decision = makeBotDecision(botHand, freshGameState, currentPlayer.difficulty);
      console.log(`🤖 Bot decision:`, decision);

      if (decision.action === 'play') {
        console.log(`🤖 Bot ${currentPlayer.username} playing card index ${decision.cardIndex}`);
        await handlePlayCard(null, {
          roomCode: roomCode,
          username: currentPlayer.username,
          cardIndex: decision.cardIndex,
          chosenColor: decision.chosenColor
        });
      } else {
        console.log(`🤖 Bot ${currentPlayer.username} drawing card`);
        await handleDrawCardAction(null, {
          roomCode: roomCode,
          username: currentPlayer.username
        });
      }
    } catch (error) {
      console.error(`❌ Error in bot ${currentPlayer.username} action:`, error);
      console.error('Error stack:', error.stack);
    }
  }, delay);
  console.log(`🤖 Bot turn scheduled successfully`);
  console.log('═══════════════════════════════════════\n');
}

async function handleDrawCardAction(ws, payload) {
  const { roomCode, username } = payload;
  console.log('📥 DRAW_CARD:', { roomCode, username });

  try {
    const normalizedCode = roomCode.toUpperCase().trim();
    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });

    if (!room || !room.gameState) {
      if (ws) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Game not found' }
        }));
      }
      return;
    }

    const gameState = room.gameState;

    // Use controller function to draw card
    const result = drawCard(gameState, username);

    if (!result.success) {
      console.log('❌ Draw card failed:', result.message);
      if (ws) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { message: result.message }
        }));
      }

      // If forced draw occurred, save and broadcast
      if (result.forcedDraw) {
        room.gameState = result.gameState;
        room.markModified('gameState');
        await room.save();

        const frontendGameState = convertToFrontendGameState(result.gameState);
        broadcastToRoom(normalizedCode, {
          type: 'FORCED_DRAW',
          payload: {
            player: username,
            drawnCards: result.drawnCards,
            gameState: frontendGameState
          }
        });

        // Check if next player is bot
        await triggerBotTurnIfNeeded(normalizedCode, result.gameState);
      }

      return;
    }

    // Success - save game state
    room.gameState = result.gameState;
    room.markModified('gameState');
    await room.save();

    // Convert to frontend format
    const frontendGameState = convertToFrontendGameState(result.gameState);

    console.log(`✅ ${username} drew a card, next player: ${result.gameState.currentPlayer}`);

    // Broadcast to all players
    broadcastToRoom(normalizedCode, {
      type: 'CARD_DRAWN',
      payload: {
        player: username,
        gameState: frontendGameState
      }
    });

    // Check if next player is a bot and trigger their turn
    await triggerBotTurnIfNeeded(normalizedCode, result.gameState);

  } catch (error) {
    console.error('❌ Error in handleDrawCard:', error);
    if (ws) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Failed to draw card' }
      }));
    }
  }
}

// Add this function after handleDrawCardAction

async function handleRequestHand(ws, payload) {
  const { roomCode, username } = payload;
  console.log('🤚 REQUEST_HAND:', { roomCode, username });

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

    if (!room.gameState) {
      console.error('❌ No game state found');
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not started' }
      }));
      return;
    }

    const gameState = room.gameState;

    // Check if hands exist
    if (!gameState.hands) {
      console.error('❌ No hands in game state');
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'No hands dealt yet' }
      }));
      return;
    }

    // Get player's hand
    const hand = gameState.hands[username];

    if (!hand) {
      console.error('❌ Player not found in game:', username);
      console.log('📋 Available players in hands:', Object.keys(gameState.hands));
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Player not found in game' }
      }));
      return;
    }

    console.log(`✅ Sending hand to ${username}: ${hand.length} cards`);

    // Convert gameState to frontend format
    const frontendGameState = convertToFrontendGameState(gameState);

    ws.send(JSON.stringify({
      type: 'HAND_UPDATE',
      payload: {
        hand,
        gameState: frontendGameState
      }
    }));

  } catch (error) {
    console.error('❌ Error in handleRequestHand:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: 'Failed to get hand' }
    }));
  }
}

// Helper function to convert backend gameState to frontend format
function convertToFrontendGameState(gameState) {
  return {
    players: gameState.players.map(p => ({
      name: p.username,
      cardCount: p.cardCount,
      // hasCalledUno: p.hasCalledUno, // Removed - not implemented
      score: p.score || 0,
      finished: p.finished || false,
      position: p.position || null
    })),
    currentPlayer: gameState.currentPlayer,
    currentCard: gameState.discardPile?.[gameState.discardPile.length - 1] || null,
    currentColor: gameState.currentColor,
    currentValue: gameState.currentValue,
    direction: gameState.direction,
    drawCount: gameState.drawCount || 0,
    deck: { length: gameState.deck?.length || 0 },
    gameOver: gameState.gameOver,
    winner: gameState.winner
  };
}

// Helper function to shuffle deck
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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

// ==================== MONOPOLY HANDLERS ====================

async function handleMonopolyRollDice(ws, payload) {
  try {
    const { roomCode, username } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();

    console.log('🎲 MONOPOLY_ROLL_DICE:', { roomCode: normalizedCode, username });

    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    if (!room || !room.gameState) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not found' }
      }));
      return;
    }

    const result = rollDice(room.gameState, username);

    if (!result.success) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: result.message }
      }));
      return;
    }

    room.gameState = result.gameState;
    room.markModified('gameState');
    await room.save();

    broadcastToRoom(normalizedCode, {
      type: 'MONOPOLY_DICE_ROLLED',
      payload: {
        gameState: result.gameState,
        roll: result.roll,
        threeDoubles: result.threeDoubles || false
      }
    });

    console.log('✅ Dice rolled successfully');

    // Check if current player is a bot and trigger their action
    const currentPlayer = result.gameState.players.find(p => p.username === result.gameState.currentPlayer);
    if (currentPlayer && currentPlayer.isBot) {
      console.log(`🤖 Current player is bot: ${currentPlayer.username}, scheduling action...`);

      const { makeBotDecision } = require('./utils/MonopolyBotAI');

      const getBotDelay = (difficulty) => {
        switch (difficulty) {
          case 'easy': return 2000 + Math.random() * 1000;
          case 'medium': return 1500 + Math.random() * 800;
          case 'hard': return 1000 + Math.random() * 500;
          default: return 1500;
        }
      };

      const delay = getBotDelay(currentPlayer.difficulty || 'medium');

      setTimeout(async () => {
        try {
          console.log(`🤖 Bot ${currentPlayer.username} making decision...`);

          // Reload room to get latest state
          const latestRoom = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
          if (!latestRoom || !latestRoom.gameState) return;

          const decision = makeBotDecision(latestRoom.gameState, currentPlayer, currentPlayer.difficulty);

          console.log(`🤖 Bot decision:`, decision);

          // Execute bot decision and then ALWAYS end turn
          if (decision.action === 'buy') {
            await handleMonopolyBuyProperty(null, {
              roomCode: normalizedCode,
              username: currentPlayer.username,
              spaceId: decision.spaceId
            });
            // Wait a bit then end turn
            setTimeout(async () => {
              await handleMonopolyEndTurn(null, {
                roomCode: normalizedCode,
                username: currentPlayer.username
              });
            }, 800);
          } else if (decision.action === 'build_house') {
            await handleMonopolyBuildHouse(null, {
              roomCode: normalizedCode,
              username: currentPlayer.username,
              spaceId: decision.spaceId
            });
            // Wait a bit then end turn
            setTimeout(async () => {
              await handleMonopolyEndTurn(null, {
                roomCode: normalizedCode,
                username: currentPlayer.username
              });
            }, 800);
          } else if (decision.action === 'pay_jail') {
            await handleMonopolyPayJailFee(null, {
              roomCode: normalizedCode,
              username: currentPlayer.username
            });
            // Wait a bit then end turn
            setTimeout(async () => {
              await handleMonopolyEndTurn(null, {
                roomCode: normalizedCode,
                username: currentPlayer.username
              });
            }, 800);
          } else if (decision.action === 'use_jail_card') {
            await handleMonopolyUseJailCard(null, {
              roomCode: normalizedCode,
              username: currentPlayer.username
            });
            // Wait a bit then end turn
            setTimeout(async () => {
              await handleMonopolyEndTurn(null, {
                roomCode: normalizedCode,
                username: currentPlayer.username
              });
            }, 800);
          } else if (decision.action === 'skip' || decision.action === 'end_turn') {
            // End turn immediately
            setTimeout(async () => {
              await handleMonopolyEndTurn(null, {
                roomCode: normalizedCode,
                username: currentPlayer.username
              });
            }, 500);
          }
        } catch (error) {
          console.error(`❌ Error in bot action:`, error);
          // Even on error, try to end turn to prevent freeze
          try {
            await handleMonopolyEndTurn(null, {
              roomCode: normalizedCode,
              username: currentPlayer.username
            });
          } catch (e) {
            console.error(`❌ Failed to end turn on error:`, e);
          }
        }
      }, delay);
    }
  } catch (error) {
    console.error('❌ Error in handleMonopolyRollDice:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: error.message }
    }));
  }
}

async function handleMonopolyBuyProperty(ws, payload) {
  try {
    const { roomCode, username, spaceId } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();

    console.log('🏠 MONOPOLY_BUY_PROPERTY:', { roomCode: normalizedCode, username, spaceId });

    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    if (!room || !room.gameState) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not found' }
      }));
      return;
    }

    const result = buyProperty(room.gameState, username, spaceId);

    if (!result.success) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: result.message }
      }));
      return;
    }

    room.gameState = result.gameState;
    room.markModified('gameState');
    await room.save();

    broadcastToRoom(normalizedCode, {
      type: 'MONOPOLY_PROPERTY_BOUGHT',
      payload: { gameState: result.gameState }
    });

    console.log('✅ Property bought successfully');
  } catch (error) {
    console.error('❌ Error in handleMonopolyBuyProperty:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: error.message }
    }));
  }
}

async function handleMonopolyBuildHouse(ws, payload) {
  try {
    const { roomCode, username, spaceId } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();

    console.log('🏗️ MONOPOLY_BUILD_HOUSE:', { roomCode: normalizedCode, username, spaceId });

    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    if (!room || !room.gameState) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not found' }
      }));
      return;
    }

    const result = buildHouse(room.gameState, username, spaceId);

    if (!result.success) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: result.message }
      }));
      return;
    }

    room.gameState = result.gameState;
    room.markModified('gameState');
    await room.save();

    broadcastToRoom(normalizedCode, {
      type: 'MONOPOLY_HOUSE_BUILT',
      payload: { gameState: result.gameState }
    });

    console.log('✅ House built successfully');
  } catch (error) {
    console.error('❌ Error in handleMonopolyBuildHouse:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: error.message }
    }));
  }
}

async function handleMonopolyMortgageProperty(ws, payload) {
  try {
    const { roomCode, username, spaceId } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();

    console.log('💵 MONOPOLY_MORTGAGE_PROPERTY:', { roomCode: normalizedCode, username, spaceId });

    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    if (!room || !room.gameState) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not found' }
      }));
      return;
    }

    const result = mortgageProperty(room.gameState, username, spaceId);

    if (!result.success) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: result.message }
      }));
      return;
    }

    room.gameState = result.gameState;
    room.markModified('gameState');
    await room.save();

    broadcastToRoom(normalizedCode, {
      type: 'MONOPOLY_PROPERTY_MORTGAGED',
      payload: { gameState: result.gameState }
    });

    console.log('✅ Property mortgaged successfully');
  } catch (error) {
    console.error('❌ Error in handleMonopolyMortgageProperty:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: error.message }
    }));
  }
}

async function handleMonopolyEndTurn(ws, payload) {
  try {
    const { roomCode, username } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();

    console.log('➡️ MONOPOLY_END_TURN:', { roomCode: normalizedCode, username });

    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    if (!room || !room.gameState) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not found' }
      }));
      return;
    }

    const result = endTurn(room.gameState, username);

    if (!result.success) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: result.message }
      }));
      return;
    }

    room.gameState = result.gameState;
    room.markModified('gameState');
    await room.save();

    broadcastToRoom(normalizedCode, {
      type: 'MONOPOLY_TURN_ENDED',
      payload: {
        gameState: result.gameState,
        rollAgain: result.rollAgain || false
      }
    });

    console.log('✅ Turn ended successfully');

    // If rollAgain is true (doubles), and current player is still a bot, trigger another roll
    if (result.rollAgain) {
      const currentPlayer = result.gameState.players.find(p => p.username === result.gameState.currentPlayer);
      if (currentPlayer && currentPlayer.isBot) {
        console.log(`🤖 Bot ${currentPlayer.username} rolled doubles, scheduling another roll...`);

        const getBotDelay = (difficulty) => {
          switch (difficulty) {
            case 'easy': return 1500 + Math.random() * 500;
            case 'medium': return 1000 + Math.random() * 500;
            case 'hard': return 800 + Math.random() * 400;
            default: return 1000;
          }
        };

        const delay = getBotDelay(currentPlayer.difficulty || 'medium');

        setTimeout(async () => {
          try {
            console.log(`🤖 Bot ${currentPlayer.username} rolling dice again after doubles...`);
            await handleMonopolyRollDice(null, {
              roomCode: normalizedCode,
              username: currentPlayer.username
            });
          } catch (error) {
            console.error(`❌ Error in bot doubles roll:`, error);
          }
        }, delay);
      }
    }

    // If next player is a bot and it's their turn to roll, trigger dice roll
    if (!result.rollAgain) {
      const nextPlayer = result.gameState.players.find(p => p.username === result.gameState.currentPlayer);
      if (nextPlayer && nextPlayer.isBot && result.gameState.turnPhase === 'roll') {
        console.log(`🤖 Next player is bot: ${nextPlayer.username}, scheduling dice roll...`);

        const getBotDelay = (difficulty) => {
          switch (difficulty) {
            case 'easy': return 2000 + Math.random() * 1000;
            case 'medium': return 1500 + Math.random() * 800;
            case 'hard': return 1000 + Math.random() * 500;
            default: return 1500;
          }
        };

        const delay = getBotDelay(nextPlayer.difficulty || 'medium');

        setTimeout(async () => {
          try {
            console.log(`🤖 Bot ${nextPlayer.username} rolling dice...`);
            await handleMonopolyRollDice(null, {
              roomCode: normalizedCode,
              username: nextPlayer.username
            });
          } catch (error) {
            console.error(`❌ Error in bot dice roll:`, error);
          }
        }, delay);
      }
    }
  } catch (error) {
    console.error('❌ Error in handleMonopolyEndTurn:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: error.message }
    }));
  }
}

async function handleMonopolyUseJailCard(ws, payload) {
  try {
    const { roomCode, username } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();

    console.log('🎫 MONOPOLY_USE_JAIL_CARD:', { roomCode: normalizedCode, username });

    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    if (!room || !room.gameState) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not found' }
      }));
      return;
    }

    const result = useJailCard(room.gameState, username);

    if (!result.success) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: result.message }
      }));
      return;
    }

    room.gameState = result.gameState;
    room.markModified('gameState');
    await room.save();

    broadcastToRoom(normalizedCode, {
      type: 'MONOPOLY_JAIL_CARD_USED',
      payload: { gameState: result.gameState }
    });

    console.log('✅ Jail card used successfully');
  } catch (error) {
    console.error('❌ Error in handleMonopolyUseJailCard:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: error.message }
    }));
  }
}

async function handleMonopolyPayJailFee(ws, payload) {
  try {
    const { roomCode, username } = payload;
    const normalizedCode = roomCode.toUpperCase().trim();

    console.log('💵 MONOPOLY_PAY_JAIL_FEE:', { roomCode: normalizedCode, username });

    const room = await GameRoom.findOne({ roomCode: normalizedCode, isActive: true });
    if (!room || !room.gameState) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Game not found' }
      }));
      return;
    }

    const result = payJailFee(room.gameState, username);

    if (!result.success) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: result.message }
      }));
      return;
    }

    room.gameState = result.gameState;
    room.markModified('gameState');
    await room.save();

    broadcastToRoom(normalizedCode, {
      type: 'MONOPOLY_JAIL_FEE_PAID',
      payload: { gameState: result.gameState }
    });

    console.log('✅ Jail fee paid successfully');
  } catch (error) {
    console.error('❌ Error in handleMonopolyPayJailFee:', error);
    ws.send(JSON.stringify({
      type: 'ERROR',
      payload: { message: error.message }
    }));
  }
}

module.exports = initWebSocket;