import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';
import UNOGame from './UNOGame';
import ScribbleGame from './ScribbleGame';
import TruthOrDare from './TruthOrDare';

export default function GameRoom({ roomCode, username, initialRoomData, preSelectedGame, onLeaveRoom }) {
  const { colors } = useTheme();
  const [room, setRoom] = useState(initialRoomData);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameType, setGameType] = useState(preSelectedGame || initialRoomData?.gameType);
  const [players, setPlayers] = useState(initialRoomData?.players || []);
  const [initialGameState, setInitialGameState] = useState(null);
  const { connect, disconnect, sendMessage, on, isConnected } = useWebSocket();
  const hasJoined = useRef(false);
  const isLeavingIntentionally = useRef(false);
  const listenersSetup = useRef(false);

  // Get players array safely
  const isHost = players[0]?.username === username || room?.host === username;

  console.log('🎮 GameRoom render:', { 
    username, 
    roomCode, 
    playerCount: players.length,
    isConnected,
    hasJoined: hasJoined.current,
    gameType,
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
      setPlayers(roomData.players || []);
      if (roomData.gameType) {
        setGameType(roomData.gameType);
      }
    });

    const unsubPlayerJoined = on('PLAYER_JOINED', (data) => {
      console.log('👥 PLAYER_JOINED event received:', data);
      const roomData = data.payload?.room || data.room;
      console.log('📊 Updating room state with:', roomData);
      setRoom(roomData);
      setPlayers(roomData.players || []);
    });

    const unsubPlayerLeft = on('PLAYER_LEFT', (data) => {
      console.log('👋 PLAYER_LEFT event received:', data);
      const roomData = data.payload?.room || data.room;
      console.log('📊 Updating room state with:', roomData);
      setRoom(roomData);
      setPlayers(roomData.players || []);
    });

    const unsubGameStarted = on('GAME_STARTED', (data) => {
      console.log('🎮 GAME_STARTED event received:', data);
      console.log('🎮 Full payload:', JSON.stringify(data.payload, null, 2));
      
      const payload = data.payload || data;
      const receivedGameType = payload.gameType || payload.game || gameType;
      const receivedGameState = payload.gameState;
      
      console.log('🎯 Extracted:', { 
        receivedGameType, 
        hasGameState: !!receivedGameState,
        gameStateCurrentDrawer: receivedGameState?.currentDrawer,
        gameStatePlayers: receivedGameState?.players?.map(p => p.username)
      });
      
      if (!receivedGameType) {
        console.error('❌ No gameType found in GAME_STARTED event!');
        return;
      }
      
      setGameType(receivedGameType);
      setInitialGameState(receivedGameState);
      setGameStarted(true);
      
      console.log('✅ Game started! Type:', receivedGameType);
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
  }, [isConnected, on, onLeaveRoom, gameType]);

  // Debug logging
  useEffect(() => {
    console.log('📊 GameRoom state updated:', {
      gameType,
      gameStarted,
      username,
      roomCode,
      playersCount: players.length,
      isHost,
      initialGameState: initialGameState ? 'present' : 'null'
    });
  }, [gameType, gameStarted, username, roomCode, players, isHost, initialGameState]);

  const handleStartGame = async () => {
    try {
      console.log('🎮 Host starting game:', { gameType, roomCode, username });
      
      sendMessage('START_GAME', { 
        roomCode, 
        username,
        gameType: gameType
      });
      
      console.log('✅ START_GAME message sent');
      
    } catch (err) {
      console.error('❌ Error starting game:', err);
      alert(err.message);
    }
  };

  const handleLeaveRoom = () => {
    console.log('🚪 User clicking leave room');
    isLeavingIntentionally.current = true;
    onLeaveRoom();
  };

  const handleLeaveGame = () => {
    console.log('🎮 Leaving game, returning to lobby');
    setGameStarted(false);
    setInitialGameState(null);
  };

  // Get display name for game type
  const getGameDisplayName = (type) => {
    const names = {
      'uno': 'UNO',
      'scribble': 'Scribble',
      'truthordare': 'Truth or Dare'
    };
    return names[type] || type;
  };

  // Render the game if started
  if (gameStarted && gameType) {
    console.log('🎮 Rendering game component:', gameType);
    
    // Convert players to the format expected by game components
    const gamePlayers = players.map(p => ({
      username: p.username,
      score: p.score || 0,
      status: p.status || 'waiting'
    }));
    
    switch (gameType) {
      case 'uno':
        return (
          <UNOGame
            roomCode={roomCode}
            username={username}
            players={gamePlayers}
            initialGameState={initialGameState}
            onLeaveRoom={handleLeaveGame}
          />
        );
      case 'scribble':
        return (
          <ScribbleGame
            roomCode={roomCode}
            username={username}
            players={gamePlayers}
            initialGameState={initialGameState}
            onLeaveRoom={handleLeaveGame}
          />
        );
      case 'truthordare':
        return (
          <TruthOrDare
            roomCode={roomCode}
            username={username}
            players={gamePlayers}
            isHost={isHost}
            initialGameState={initialGameState}
            onLeaveRoom={handleLeaveGame}
          />
        );
      default:
        console.error('❌ Unknown game type:', gameType);
        return (
          <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.background }}>
            <div className="text-center">
              <p className="text-2xl font-orbitron" style={{ color: colors.text }}>
                Unknown game type: {gameType}
              </p>
              <button
                onClick={handleLeaveGame}
                className="mt-4 px-6 py-3 rounded-lg font-raleway font-bold"
                style={{ background: colors.primary, color: '#fff' }}
              >
                Return to Lobby
              </button>
            </div>
          </div>
        );
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
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 
              className="text-4xl font-orbitron font-black"
              style={{
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Game Room
            </h1>
            <p className="font-poppins mt-2" style={{ color: colors.textSecondary }}>
              Room Code: <span className="font-bold" style={{ color: colors.primary }}>{roomCode}</span>
            </p>
            <p className="font-poppins text-sm" style={{ color: colors.textSecondary }}>
              Status: <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
                {isConnected ? '● Connected' : '○ Disconnected'}
              </span>
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

        {/* Game Type Display */}
        {gameType && (
          <div 
            className="mb-8 p-6 rounded-2xl border text-center"
            style={{
              background: `linear-gradient(135deg, ${colors.primary}10, ${colors.secondary}05)`,
              borderColor: `${colors.primary}30`
            }}
          >
            <p className="text-6xl mb-2">
              {gameType === 'uno' && '🎴'}
              {gameType === 'scribble' && '✏️'}
              {gameType === 'truthordare' && '🎭'}
            </p>
            <h2 className="text-2xl font-orbitron font-bold" style={{ color: colors.text }}>
              {getGameDisplayName(gameType)}
            </h2>
            <p className="font-poppins mt-1" style={{ color: colors.textSecondary }}>
              {gameType === 'uno' && 'Classic card game action!'}
              {gameType === 'scribble' && 'Draw and guess!'}
              {gameType === 'truthordare' && 'Truth or Dare party game!'}
            </p>
          </div>
        )}

        {/* Players List */}
        <div className="mb-8">
          <h2 className="text-xl font-orbitron font-bold mb-4" style={{ color: colors.text }}>
            Players ({players.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {players.map((player, index) => {
              const isPlayerHost = index === 0 || player.username === room?.host;
              const isCurrentUser = player.username === username;
              
              return (
                <div
                  key={player.username}
                  className="p-4 rounded-lg border-2 transition-all"
                  style={{
                    background: isCurrentUser 
                      ? `${colors.primary}20` 
                      : 'rgba(0, 0, 0, 0.3)',
                    borderColor: isCurrentUser 
                      ? colors.primary 
                      : `${colors.primary}30`
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {isPlayerHost ? '👑' : '👤'}
                    </span>
                    <div>
                      <p className="font-raleway font-bold" style={{ color: colors.text }}>
                        {player.username} {isCurrentUser && '(You)'}
                      </p>
                      {isPlayerHost && (
                        <p className="text-sm" style={{ color: colors.primary }}>
                          Host
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Start Game Button (Host Only) */}
        <div className="text-center">
          {isHost ? (
            <button
              onClick={handleStartGame}
              disabled={players.length < 2}
              className="px-12 py-4 rounded-lg font-raleway font-bold text-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                background: players.length >= 2 
                  ? `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`
                  : 'rgba(100, 100, 100, 0.5)',
                color: '#fff',
                boxShadow: players.length >= 2 ? `0 0 30px ${colors.primary}60` : 'none'
              }}
            >
              {players.length < 2 ? 'Need at least 2 players' : '🎮 Start Game'}
            </button>
          ) : (
            <div 
              className="px-12 py-4 rounded-lg font-raleway font-bold text-lg"
              style={{
                background: 'rgba(100, 100, 100, 0.3)',
                color: colors.textSecondary
              }}
            >
              Waiting for <span style={{ color: colors.primary }}>{room?.host || players[0]?.username}</span> to start the game...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
