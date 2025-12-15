import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';
import ScribbleGame from './ScribbleGame';
import UNOGame from './UNOGame';

export default function GameRoom({ roomCode, username, initialRoomData, preSelectedGame, onLeaveRoom }) {
  const { colors } = useTheme();
  const [room, setRoom] = useState(initialRoomData);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentGame, setCurrentGame] = useState(preSelectedGame || null);
  const [initialGameState, setInitialGameState] = useState(null);
  const { connect, disconnect, sendMessage, on, isConnected } = useWebSocket();
  const hasJoined = useRef(false);
  const isLeavingIntentionally = useRef(false);
  const listenersSetup = useRef(false);

  console.log('🎮 GameRoom render:', { 
    username, 
    roomCode, 
    playerCount: room?.players?.length,
    isConnected,
    hasJoined: hasJoined.current 
  });

  // Connect WebSocket when component mounts
  useEffect(() => {
    console.log('🎮 GameRoom mounted, connecting WebSocket...');
    connect();

    return () => {
      console.log('🧹 GameRoom unmounting...');
      
      // Only send LEAVE_ROOM if user is intentionally leaving
      if (isLeavingIntentionally.current && hasJoined.current && roomCode && username) {
        console.log('👋 Sending LEAVE_ROOM on cleanup');
        sendMessage('LEAVE_ROOM', { roomCode, username });
      } else {
        console.log('⏭️ Skipping LEAVE_ROOM (not intentional leave)');
      }
      
      disconnect();
    };
  }, []);

  // Join room via WebSocket when connected
  useEffect(() => {
    if (isConnected && !hasJoined.current && roomCode && username) {
      console.log('🚪 WebSocket connected, joining room:', { roomCode, username });
      hasJoined.current = true;
      
      sendMessage('JOIN_ROOM', { roomCode, username });
    }
  }, [isConnected, roomCode, username]);

  // Setup WebSocket listeners
  useEffect(() => {
    if (!isConnected || listenersSetup.current) return;

    console.log('🎧 Setting up GameRoom WebSocket listeners');
    listenersSetup.current = true;

    const unsubRoomJoined = on('ROOM_JOINED', (data) => {
      console.log('✅ ROOM_JOINED event received:', data);
      const roomData = data.payload?.room || data.room;
      console.log('📊 Updating room state with:', roomData);
      setRoom(roomData);
      setCurrentGame(roomData.gameType);
    });

    const unsubPlayerJoined = on('PLAYER_JOINED', (data) => {
      console.log('👥 PLAYER_JOINED event received:', data);
      const roomData = data.payload?.room || data.room;
      console.log('📊 Updating room state with:', roomData);
      setRoom(roomData);
    });

    const unsubPlayerLeft = on('PLAYER_LEFT', (data) => {
      console.log('👋 PLAYER_LEFT event received:', data);
      const roomData = data.payload?.room || data.room;
      console.log('📊 Updating room state with:', roomData);
      setRoom(roomData);
    });

    const unsubGameStarted = on('GAME_STARTED', (data) => {
      console.log('🎮 GAME_STARTED event received:', data);
      const payload = data.payload || data;
      setGameStarted(true);
      setInitialGameState(payload.gameState);
      setCurrentGame(payload.gameType);
    });

    const unsubRoomClosed = on('ROOM_CLOSED', (data) => {
      console.log('🚪 ROOM_CLOSED event received:', data);
      alert('Room has been closed');
      isLeavingIntentionally.current = false; // Don't send LEAVE_ROOM again
      onLeaveRoom();
    });

    return () => {
      console.log('🧹 Cleaning up GameRoom listeners');
      unsubRoomJoined?.();
      unsubPlayerJoined?.();
      unsubPlayerLeft?.();
      unsubGameStarted?.();
      unsubRoomClosed?.();
      listenersSetup.current = false;
    };
  }, [isConnected, on, onLeaveRoom]);

  const handleStartGame = async () => {
    try {
      console.log('🎮 Starting game via WebSocket...');
      
      sendMessage('START_GAME', { 
        roomCode, 
        username 
      });
      
      console.log('✅ START_GAME message sent');
      
    } catch (err) {
      console.error('❌ Error starting game:', err);
      alert(err.message);
    }
  };

  const handleLeaveRoom = () => {
    console.log('👋 User intentionally leaving room:', { roomCode, username });
    isLeavingIntentionally.current = true;
    
    if (hasJoined.current) {
      sendMessage('LEAVE_ROOM', { roomCode, username });
    }
    
    onLeaveRoom();
  };

  // Show game if started
  if (gameStarted && currentGame && initialGameState) {
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
    } else if (currentGame === 'uno') {
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

  console.log('🎨 Rendering lobby with players:', room?.players);

  // Lobby view
  return (
    <div 
      className="min-h-screen p-8"
      style={{ backgroundColor: colors.background }}
    >
      <div className="max-w-4xl mx-auto">
        <div 
          className="rounded-2xl shadow-2xl p-8 border"
          style={{
            background: colors.surface,
            borderColor: `${colors.primary}30`,
            backdropFilter: 'blur(20px)'
          }}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 
                className="text-4xl font-orbitron font-black mb-2"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                Game Room
              </h1>
              <p className="font-poppins" style={{ color: colors.textSecondary }}>
                Room Code: <span className="font-mono font-bold text-lg" style={{ color: colors.text }}>{roomCode}</span>
              </p>
              <p className="font-poppins text-sm" style={{ color: colors.textSecondary }}>
                Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </p>
            </div>
            <button
              onClick={handleLeaveRoom}
              className="px-6 py-3 rounded-lg font-raleway font-bold transition-all hover:scale-105 border"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.5)',
                color: '#ef4444'
              }}
            >
              Leave Room
            </button>
          </div>

          {/* Game Type */}
          <div 
            className="mb-8 p-4 rounded-lg border"
            style={{
              background: `${colors.primary}10`,
              borderColor: `${colors.primary}40`
            }}
          >
            <p className="text-lg font-raleway font-semibold" style={{ color: colors.text }}>
              Game: <span className="capitalize" style={{ color: colors.primary }}>{room?.gameType || 'Unknown'}</span>
            </p>
          </div>

          {/* Players */}
          <div className="mb-8">
            <h2 className="text-2xl font-orbitron font-bold mb-4" style={{ color: colors.text }}>
              Players ({room?.players?.length || 0})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {room?.players?.map((player, index) => (
                <div
                  key={player.username || index}
                  className="p-4 rounded-lg border-2"
                  style={{
                    background: player.username === room?.host 
                      ? `${colors.primary}10`
                      : 'rgba(0, 0, 0, 0.3)',
                    borderColor: player.username === room?.host
                      ? colors.primary
                      : `${colors.primary}30`
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {player.username === room?.host ? '👑' : '👤'}
                    </span>
                    <div>
                      <p className="font-raleway font-bold" style={{ color: colors.text }}>
                        {player.username}
                        {player.username === username && ' (You)'}
                      </p>
                      {player.username === room?.host && (
                        <p className="text-sm font-poppins" style={{ color: colors.primary }}>Host</p>
                      )}
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
                className="px-8 py-4 rounded-lg font-raleway font-bold text-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: room?.players && room.players.length >= 2
                    ? `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`
                    : 'rgba(128, 128, 128, 0.3)',
                  color: room?.players && room.players.length >= 2 ? '#000' : colors.textSecondary,
                  boxShadow: room?.players && room.players.length >= 2 
                    ? `0 0 40px ${colors.glow}60` 
                    : 'none'
                }}
              >
                {room?.players && room.players.length < 2
                  ? 'Need at least 2 players'
                  : 'Start Game'}
              </button>
            </div>
          )}

          {username !== room?.host && !gameStarted && (
            <div 
              className="text-center p-4 rounded-lg border"
              style={{
                background: `${colors.secondary}10`,
                borderColor: `${colors.secondary}40`
              }}
            >
              <p className="font-poppins font-semibold" style={{ color: colors.text }}>
                Waiting for <span style={{ color: colors.primary }}>{room?.host}</span> to start the game...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
