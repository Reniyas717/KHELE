import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import ScribbleGame from './ScribbleGame';
import UNOGame from './UNOGame';

export default function GameRoom({ roomCode, username, initialRoomData, preSelectedGame, onLeaveRoom }) {
  const [room, setRoom] = useState(initialRoomData);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentGame, setCurrentGame] = useState(preSelectedGame || null);
  const { connect, disconnect, sendMessage, on, isConnected } = useWebSocket();
  const hasJoined = useRef(false);
  const cleanupDone = useRef(false);

  // Setup WebSocket listeners once
  useEffect(() => {
    console.log('🔧 Setting up GameRoom for', roomCode);
    
    // Connect WebSocket
    connect();

    // Set up message listeners
    const unsubscribePlayerJoined = on('PLAYER_JOINED', (payload) => {
      console.log('👥 Player joined:', payload);
      setRoom(prevRoom => ({
        ...prevRoom,
        players: payload.players
      }));
    });

    const unsubscribePlayerLeft = on('PLAYER_LEFT', (payload) => {
      console.log('👋 Player left:', payload);
      setRoom(prevRoom => ({
        ...prevRoom,
        players: prevRoom.players?.filter(p => p.username !== payload.username) || []
      }));
    });

    const unsubscribeGameStarted = on('GAME_STARTED', (payload) => {
      console.log('🎮 Game started:', payload);
      setCurrentGame(payload.gameType);
      setGameStarted(true);
      // Don't disconnect here - let the game component handle it
    });

    const unsubscribeJoinedRoom = on('JOINED_ROOM', (payload) => {
      console.log('✅ Joined room:', payload);
      setRoom(payload.room);
    });

    const unsubscribeRoomUpdate = on('ROOM_UPDATE', (payload) => {
      console.log('🔄 Room updated:', payload);
      setRoom(payload.room);
    });

    // Cleanup function
    return () => {
      if (!cleanupDone.current) {
        console.log('🧹 Cleaning up GameRoom');
        if (hasJoined.current) {
          sendMessage('LEAVE_ROOM', { roomCode, username });
        }
        unsubscribePlayerJoined();
        unsubscribePlayerLeft();
        unsubscribeGameStarted();
        unsubscribeJoinedRoom();
        unsubscribeRoomUpdate();
        cleanupDone.current = true;
      }
    };
  }, []); // Empty array - only run once

  // Join room when connected
  useEffect(() => {
    if (isConnected && !hasJoined.current) {
      console.log('🚪 Joining room:', roomCode, 'as', username);
      sendMessage('JOIN_ROOM', { roomCode, username });
      hasJoined.current = true;
    }
  }, [isConnected]);

  // Auto-start game when conditions met (only for host)
  useEffect(() => {
    const shouldAutoStart = 
      preSelectedGame && 
      room?.players?.length >= 2 && 
      !gameStarted && 
      room?.host === username &&
      isConnected; // Add this check

    if (shouldAutoStart) {
      console.log('🚀 Auto-starting game in 3 seconds...');
      const timer = setTimeout(() => {
        console.log('🎮 Auto-start triggered');
        handleStartGame();
      }, 3000); // Increased to 3 seconds to ensure all players connected
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

    console.log('🎮 Starting game:', gameType);
    sendMessage('START_GAME', { roomCode, gameType });
    setGameStarted(true);
  };

  const handleLeaveRoom = () => {
    console.log('👋 Leaving room');
    if (hasJoined.current) {
      sendMessage('LEAVE_ROOM', { roomCode, username });
      hasJoined.current = false;
    }
    cleanupDone.current = true;
    onLeaveRoom();
  };

  // If game has started, render the game component
  if (gameStarted && currentGame === 'scribble') {
    return (
      <ScribbleGame
        roomCode={roomCode}
        username={username}
        players={room?.players || []}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  if (gameStarted && currentGame === 'uno') {
    return (
      <UNOGame
        roomCode={roomCode}
        username={username}
        players={room?.players || []}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  // Waiting room / Game selection
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
              {isHost ? '🎮 You are the host' : `👤 Host: ${room?.host || 'Loading...'}`}
            </p>
          </div>
          <button
            onClick={handleLeaveRoom}
            className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Leave Room
          </button>
        </div>

        {/* Room Code Display */}
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
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
            <span className="text-sm text-gray-600">
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
                    {player.username ? player.username[0].toUpperCase() : '?'}
                  </div>
                  <span className="font-semibold text-gray-800">
                    {player.username || 'Loading...'}
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
              Share the room code <span className="font-mono font-bold">{roomCode}</span> with your friends!
            </p>
          </div>
        )}

        {/* Start Game Button (Host Only) */}
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
            {!isConnected ? '⏳ Connecting...' : canStart ? '🎮 Start Game' : '⏳ Waiting for more players...'}
          </button>
        )}

        {/* Waiting for host message */}
        {!isHost && canStart && !gameStarted && (
          <div className="bg-blue-100 border border-blue-400 text-blue-800 px-6 py-4 rounded-lg text-center">
            <p className="font-semibold">
              ⏳ Waiting for host to start the game...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
