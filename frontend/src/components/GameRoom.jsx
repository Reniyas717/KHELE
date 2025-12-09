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
      console.log('👋 PLAYER_LEFT event:', payload.username);
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

    console.log(`\n🎮 Host starting game: ${gameType}`);
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

  // Render game if started
  if (gameStarted && initialGameState) {
    console.log(`🎯 Rendering ${currentGame} game`);
    
    if (currentGame === 'scribble') {
      return (
        <ScribbleGame
          roomCode={roomCode}
          username={username}
          players={room?.players || []}
          initialGameState={initialGameState}
          onLeaveRoom={handleLeaveRoom}
        />
      );
    }

    if (currentGame === 'uno') {
      return (
        <UNOGame
          roomCode={roomCode}
          username={username}
          players={room?.players || []}
          initialGameState={initialGameState}
          onLeaveRoom={handleLeaveRoom}
        />
      );
    }
  }

  // Waiting room
  const isHost = room?.host === username;
  const canStart = room?.players?.length >= 2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-4xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
              Game Room
            </h1>
            <p className="text-gray-600 mt-1">
              {isHost ? '🎮 You are the host' : `👤 Host: ${room?.host}`}
            </p>
          </div>
          <button
            onClick={handleLeaveRoom}
            className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Leave Room
          </button>
        </div>

        {/* Room Code */}
        {preSelectedGame && (
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-8 mb-8 text-center">
            <h2 className="text-white text-2xl font-semibold mb-4">
              Share this code with friends:
            </h2>
            <div className="bg-white rounded-xl p-6">
              <p className="text-6xl font-bold text-purple-600 tracking-[0.3em] font-mono">
                {roomCode}
              </p>
            </div>
            <p className="text-white mt-4 text-lg">
              Game: {preSelectedGame === 'scribble' ? '✏️ Scribble' : '🃏 UNO'}
            </p>
          </div>
        )}

        {/* Connection Status */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
            <span className="text-sm font-semibold text-gray-700">
              {isConnected ? '✅ Connected' : '⏳ Connecting...'}
            </span>
          </div>
        </div>

        {/* Players List */}
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">
            Players ({room?.players?.length || 0}/8)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {room?.players?.map((player, index) => (
              <div
                key={player.username || index}
                className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {player.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="font-semibold text-gray-800">
                    {player.username}
                    {player.username === room.host && (
                      <span className="ml-2 text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full">
                        HOST
                      </span>
                    )}
                    {player.username === username && (
                      <span className="ml-2 text-xs bg-blue-400 text-blue-900 px-2 py-1 rounded-full">
                        YOU
                      </span>
                    )}
                  </span>
                </div>
                <span className="text-gray-600">Score: {player.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Waiting Message */}
        {!canStart && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-6 py-4 rounded-lg mb-6 text-center">
            <p className="font-semibold">
              ⏳ Waiting for at least 2 players to join...
            </p>
            <p className="text-sm mt-1">
              Share the room code <span className="font-mono font-bold">{roomCode}</span>
            </p>
          </div>
        )}

        {/* Start Button - ONLY SHOWS FOR HOST */}
        {isHost && (currentGame || preSelectedGame) && !gameStarted && (
          <button
            onClick={handleStartGame}
            disabled={!canStart || !isConnected}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              canStart && isConnected
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 transform hover:scale-105'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {!isConnected ? '⏳ Connecting...' : canStart ? '🎮 Start Game' : '⏳ Need 2+ Players'}
          </button>
        )}

        {/* Waiting for host */}
        {!isHost && canStart && !gameStarted && (
          <div className="bg-blue-100 border border-blue-400 text-blue-800 px-6 py-4 rounded-lg text-center">
            <p className="font-semibold">
              ⏳ Waiting for {room?.host} to start the game...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
