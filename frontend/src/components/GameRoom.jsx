import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import ScribbleGame from './ScribbleGame';
import UNOGame from './UNOGame';

export default function GameRoom({ roomCode, username, initialRoomData, preSelectedGame, onLeaveRoom }) {
  const [room, setRoom] = useState(initialRoomData);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentGame, setCurrentGame] = useState(preSelectedGame || null);
  const [initialGameState, setInitialGameState] = useState(null);
  const { connect, disconnect, sendMessage, on, isConnected } = useWebSocket();
  const hasJoined = useRef(false);
  const cleanupDone = useRef(false);
  const listenersSetup = useRef(false);

  // Setup WebSocket listeners once
  useEffect(() => {
    if (listenersSetup.current) {
      console.log('⚠️ Listeners already setup');
      return;
    }
    listenersSetup.current = true;

    console.log(`\n🔧 Setting up GameRoom listeners`);
    console.log(`👤 User: ${username}`);
    console.log(`🏠 Room: ${roomCode}\n`);
    
    connect();

    const unsubscribePlayerJoined = on('PLAYER_JOINED', (payload) => {
      console.log('👥 PLAYER_JOINED event:', payload.username);
      console.log('📋 New player list:', payload.players.map(p => p.username));
      
      setRoom(prevRoom => {
        const newRoom = {
          ...prevRoom,
          players: payload.players
        };
        console.log('✅ Room updated with new players');
        return newRoom;
      });
    });

    const unsubscribePlayerLeft = on('PLAYER_LEFT', (payload) => {
      console.log('👋 PLAYER_LEFT event:', payload);
      
      setRoom(prevRoom => {
        if (!prevRoom) return prevRoom;
        
        return {
          ...prevRoom,
          players: payload.players || prevRoom.players.filter(p => p.username !== payload.username),
          host: payload.host || prevRoom.host
        };
      });
    });

    const unsubscribeGameStarted = on('GAME_STARTED', (payload) => {
      console.log('\n🎮 GAME_STARTED event received!');
      console.log('📦 Game type:', payload.gameType);
      console.log('📦 Has game state:', !!payload.gameState);
      
      if (payload.gameState) {
        setCurrentGame(payload.gameType);
        setInitialGameState(payload.gameState);
        setGameStarted(true);
        console.log('✅ Game initialized successfully\n');
      } else {
        console.error('❌ No game state in payload\n');
      }
    });

    const unsubscribeJoinedRoom = on('JOINED_ROOM', (payload) => {
      console.log('✅ JOINED_ROOM confirmation received');
      console.log('📋 Room players:', payload.room.players.map(p => p.username));
      setRoom(payload.room);
    });

    const unsubscribeRoomUpdate = on('ROOM_UPDATE', (payload) => {
      console.log('🔄 ROOM_UPDATE event');
      console.log('📋 Updated players:', payload.room.players.map(p => p.username));
      setRoom(payload.room);
    });

    return () => {
      console.log('🧹 Cleaning up GameRoom');
      if (hasJoined.current && !cleanupDone.current) {
        sendMessage('LEAVE_ROOM', { roomCode, username });
        cleanupDone.current = true;
      }
      unsubscribePlayerJoined();
      unsubscribePlayerLeft();
      unsubscribeGameStarted();
      unsubscribeJoinedRoom();
      unsubscribeRoomUpdate();
      listenersSetup.current = false;
    };
  }, []);

  // Join room when connected
  useEffect(() => {
    if (isConnected && !hasJoined.current) {
      console.log(`🚪 Joining room ${roomCode} as ${username}`);
      sendMessage('JOIN_ROOM', { roomCode, username });
      hasJoined.current = true;
    }
  }, [isConnected]);

  // Auto-start game
  useEffect(() => {
    const shouldAutoStart = 
      preSelectedGame && 
      room?.players?.length >= 2 && 
      !gameStarted && 
      room?.host === username &&
      isConnected;

    if (shouldAutoStart) {
      console.log('\n🚀 Auto-starting game...');
      console.log('👥 Players:', room.players.map(p => p.username));
      
      const timer = setTimeout(() => {
        console.log('🎮 Triggering START_GAME');
        handleStartGame();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [room?.players?.length, gameStarted, isConnected]);

  const handleStartGame = () => {
    if (room?.players?.length < 2) {
      alert('Need at least 2 players to start!');
      return;
    }

    const gameType = currentGame || preSelectedGame;
    if (!gameType) {
      alert('Please select a game first!');
      return;
    }

    console.log(`\n🎮 Starting game: ${gameType}`);
    console.log(`👥 Players: ${room.players.map(p => p.username).join(', ')}\n`);
    
    sendMessage('START_GAME', { roomCode, gameType, username });
  };

  const handleLeaveRoom = () => {
    console.log('👋 Leaving room');
    if (hasJoined.current && !cleanupDone.current) {
      sendMessage('LEAVE_ROOM', { roomCode, username });
      hasJoined.current = false;
      cleanupDone.current = true;
    }
    disconnect();
    onLeaveRoom();
  };

  // Listen for WebSocket events
  useEffect(() => {
    if (!isConnected) {
      console.log('⚠️ WebSocket not connected');
      return;
    }

    console.log('🎮 Setting up GameRoom listeners');

    // Listen for player joined
    const unsubPlayerJoined = on('PLAYER_JOINED', (data) => {
      console.log('👥 PLAYER_JOINED event:', data);
      const payload = data.payload || data;
      
      if (payload.room) {
        console.log('✅ Updating room with new player data');
        setRoom(payload.room);
      }
    });

    // Listen for room updates
    const unsubRoomUpdate = on('ROOM_UPDATE', (data) => {
      console.log('🔄 ROOM_UPDATE event:', data);
      const payload = data.payload || data;
      
      if (payload.room) {
        console.log('✅ Updating room data');
        setRoom(payload.room);
      }
    });

    // Listen for game start
    const unsubGameStarted = on('GAME_STARTED', (data) => {
      console.log('🎮 GAME_STARTED event:', data);
      const payload = data.payload || data;
      
      if (payload.room) {
        setRoom(payload.room);
      }
      
      setGameStarted(true);
      setCurrentGame(payload.gameType);
      setInitialGameState(payload.gameState);
      
      console.log('✅ Game started:', payload.gameType);
    });

    return () => {
      console.log('🧹 Cleaning up GameRoom listeners');
      unsubPlayerJoined?.();
      unsubRoomUpdate?.();
      unsubGameStarted?.();
    };
  }, [on, isConnected]);

  // Show game if started
  if (gameStarted && currentGame && initialGameState) {
    if (currentGame === 'scribble') {
      return (
        <ScribbleGame
          roomCode={roomCode}
          username={username}
          players={room?.players || []}
          initialGameState={initialGameState}
          onLeaveRoom={onLeaveRoom}
        />
      );
    } else if (currentGame === 'uno') {
      return (
        <UNOGame
          roomCode={roomCode}
          username={username}
          players={room?.players || []}
          initialGameState={initialGameState}
          onLeaveRoom={onLeaveRoom}
        />
      );
    }
  }

  // Lobby view
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-500 to-pink-500 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                Game Room
              </h1>
              <p className="text-gray-600 mt-2">Room Code: <span className="font-mono font-bold text-lg">{roomCode}</span></p>
            </div>
            <button
              onClick={onLeaveRoom}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all transform hover:scale-105"
            >
              Leave Room
            </button>
          </div>

          {/* Game Type */}
          <div className="mb-8 p-4 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg">
            <p className="text-lg font-semibold text-gray-800">
              Game: <span className="text-purple-600 capitalize">{room?.gameType || 'Unknown'}</span>
            </p>
          </div>

          {/* Players */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Players ({room?.players?.length || 0})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {room?.players?.map((player, index) => (
                <div
                  key={player.username || index}
                  className={`p-4 rounded-lg border-2 ${
                    player.username === room?.host
                      ? 'bg-yellow-50 border-yellow-400'
                      : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {player.username === room?.host ? '👑' : '👤'}
                      </span>
                      <div>
                        <p className="font-bold text-lg">
                          {player.username}
                          {player.username === username && ' (You)'}
                        </p>
                        {player.username === room?.host && (
                          <p className="text-sm text-yellow-600">Host</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Start Game Button */}
          {username === room?.host && !gameStarted && (
            <div className="text-center">
              <button
                onClick={handleStartGame}
                disabled={!room?.players || room.players.length < 2}
                className={`px-8 py-4 rounded-lg font-bold text-lg transition-all transform hover:scale-105 ${
                  room?.players && room.players.length >= 2
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {room?.players && room.players.length < 2
                  ? 'Need at least 2 players'
                  : 'Start Game'}
              </button>
            </div>
          )}

          {username !== room?.host && !gameStarted && (
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-blue-800 font-semibold">
                Waiting for <span className="text-blue-600">{room?.host}</span> to start the game...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
