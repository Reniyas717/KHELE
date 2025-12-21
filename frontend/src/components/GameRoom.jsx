import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';
import ScribbleGame from './ScribbleGame';
import UNOGame from './UNOGame';
import TruthOrDare from './TruthOrDare';

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

  // Get players array safely
  const players = room?.players || [];
  const isHost = players[0]?.username === username || room?.host === username;

  console.log('🎮 GameRoom render:', { 
    username, 
    roomCode, 
    playerCount: players.length,
    isConnected,
    hasJoined: hasJoined.current,
    gameType: currentGame,
    gameStarted
  });

  // Connect WebSocket when component mounts
  useEffect(() => {
    console.log('🎮 GameRoom mounted, connecting WebSocket...');
    connect();

    return () => {
      console.log('🧹 GameRoom unmounting...');
      
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
      if (roomData.gameType) {
        setCurrentGame(roomData.gameType);
      }
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
      console.log('🎮 GAME_STARTED event received:', data.payload);
      const gameType = data.payload?.gameType || data.payload?.game;
      console.log('🎯 Setting game to:', gameType);
      setCurrentGame(gameType);
      setGameStarted(true);
    });

    const unsubRoomClosed = on('ROOM_CLOSED', (data) => {
      console.log('🚪 ROOM_CLOSED event received:', data);
      alert('Room has been closed');
      isLeavingIntentionally.current = false;
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

  // Debug logging
  useEffect(() => {
    console.log('🔄 GameRoom state update:', { 
      currentGame, 
      gameStarted,
      username, 
      roomCode, 
      playersCount: players.length,
      isHost
    });
  }, [currentGame, gameStarted, username, roomCode, players, isHost]);

  const handleStartGame = async () => {
    try {
      console.log('🎮 Starting game:', currentGame);
      
      // For Truth or Dare, start locally and broadcast
      if (currentGame === 'truthordare') {
        setGameStarted(true);
        // Broadcast to all players
        sendMessage('GAME_STARTED', { 
          roomCode, 
          gameType: 'truthordare',
          game: 'truthordare'
        });
        return;
      }
      
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

  const handleLeaveGame = () => {
    console.log('🎮 Leaving game, returning to lobby');
    setGameStarted(false);
    setInitialGameState(null);
  };

  // Get display name for game type
  const getGameDisplayName = (gameType) => {
    switch(gameType) {
      case 'scribble':
        return 'Scribble';
      case 'uno':
        return 'UNO';
      case 'truthordare':
        return 'Truth or Dare';
      default:
        return gameType;
    }
  };

  // Render the game if started
  if (gameStarted && currentGame) {
    console.log('🎮 Rendering game:', currentGame, 'for user:', username);
    
    switch (currentGame) {
      case 'scribble':
        return (
          <ScribbleGame
            roomCode={roomCode}
            username={username}
            players={players}
            onLeaveGame={handleLeaveGame}
          />
        );
      case 'truthordare':
        return (
          <TruthOrDare
            roomCode={roomCode}
            username={username}
            players={players}
            onLeaveGame={handleLeaveGame}
          />
        );
      case 'uno':
        return (
          <UNOGame
            roomCode={roomCode}
            username={username}
            players={players}
            onLeaveGame={handleLeaveGame}
          />
        );
      default:
        console.log('⚠️ Unknown game type:', currentGame);
        break;
    }
  }

  console.log('🎨 Rendering lobby with players:', players);

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
            className="mb-8 p-6 rounded-lg border text-center"
            style={{
              background: `${colors.primary}10`,
              borderColor: `${colors.primary}40`
            }}
          >
            <div className="text-5xl mb-3">
              {currentGame === 'scribble' && '✏️'}
              {currentGame === 'uno' && '🃏'}
              {currentGame === 'truthordare' && '🎭'}
            </div>
            <p className="text-2xl font-orbitron font-bold" style={{ color: colors.text }}>
              {getGameDisplayName(currentGame)}
            </p>
            <p className="text-sm font-poppins mt-1" style={{ color: colors.textSecondary }}>
              {currentGame === 'scribble' && 'Draw and guess words!'}
              {currentGame === 'uno' && 'Classic card game action!'}
              {currentGame === 'truthordare' && 'Test your courage & honesty!'}
            </p>
          </div>

          {/* Players */}
          <div className="mb-8">
            <h2 className="text-2xl font-orbitron font-bold mb-4" style={{ color: colors.text }}>
              Players ({players.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players.map((player, index) => (
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
          {isHost && !gameStarted && (
            <div className="text-center">
              <button
                onClick={handleStartGame}
                disabled={players.length < 2}
                className="px-8 py-4 rounded-lg font-raleway font-bold text-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: players.length >= 2
                    ? `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`
                    : 'rgba(128, 128, 128, 0.3)',
                  color: players.length >= 2 ? '#000' : colors.textSecondary,
                  boxShadow: players.length >= 2 
                    ? `0 0 40px ${colors.glow}60` 
                    : 'none'
                }}
              >
                {players.length < 2
                  ? 'Need at least 2 players'
                  : 'Start Game'}
              </button>
            </div>
          )}

          {!isHost && !gameStarted && (
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
