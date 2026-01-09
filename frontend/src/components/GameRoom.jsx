import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';
import UNOGame from './UNOGame';
import ScribbleGame from './ScribbleGame';
import TruthOrDare from './TruthOrDare';
import PixelSnow from './ui/PixelSnow';
import {
  IoArrowBack,
  IoPeopleSharp,
  IoGameController,
  IoCopyOutline,
  IoCheckmarkCircle
} from 'react-icons/io5';
import { FaIdCard, FaCrown, FaUser } from 'react-icons/fa6';
import { IoBrushSharp } from 'react-icons/io5';
import { MdTheaterComedy } from 'react-icons/md';

export default function GameRoom({ roomCode, username, initialRoomData, preSelectedGame, onLeaveRoom }) {
  const { colors, theme } = useTheme();
  const [room, setRoom] = useState(initialRoomData);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameType, setGameType] = useState(preSelectedGame || initialRoomData?.gameType);
  const [players, setPlayers] = useState(initialRoomData?.players || []);
  const [initialGameState, setInitialGameState] = useState(null);
  const [copied, setCopied] = useState(false);
  const { connect, disconnect, sendMessage, on, isConnected } = useWebSocket();
  const hasJoined = useRef(false);
  const isLeavingIntentionally = useRef(false);
  const listenersSetup = useRef(false);

  // Bot configuration state
  const [botCount, setBotCount] = useState(0);
  const [botDifficulty, setBotDifficulty] = useState('medium');

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
      console.log('🎮 Host starting game:', { gameType, roomCode, username, botCount, botDifficulty });

      sendMessage('START_GAME', {
        roomCode,
        username,
        gameType: gameType,
        botCount, // Send bot configuration
        botDifficulty
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

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  // Get game icon
  const getGameIcon = (type) => {
    switch (type) {
      case 'uno':
        return <FaIdCard className="w-12 h-12 md:w-16 md:h-16" />;
      case 'scribble':
        return <IoBrushSharp className="w-12 h-12 md:w-16 md:h-16" />;
      case 'truthordare':
        return <MdTheaterComedy className="w-12 h-12 md:w-16 md:h-16" />;
      default:
        return <IoGameController className="w-12 h-12 md:w-16 md:h-16" />;
    }
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
          <div className={`min-h-screen flex items-center justify-center ${colors.bg}`}>
            <div className="text-center">
              <p className={`text-2xl font-display ${colors.text}`}>
                Unknown game type: {gameType}
              </p>
              <button
                onClick={handleLeaveGame}
                className={`mt-4 px-6 py-3 rounded-lg font-accent font-bold ${colors.primaryBg} text-white`}
              >
                Return to Lobby
              </button>
            </div>
          </div>
        );
    }
  }

  console.log('🎨 Rendering lobby with players:', players);

  // Theme-based PixelSnow colors
  const snowColor = theme === 'dark' ? '#00d9ff' : '#10b981';
  const snowDensity = theme === 'dark' ? 0.12 : 0.08;
  const snowBrightness = theme === 'dark' ? 0.5 : 0.35;

  // Lobby view
  return (
    <div className={`min-h-screen p-4 md:p-8 relative ${colors.bg} transition-colors duration-300`}>
      {/* PixelSnow Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-60">
        <PixelSnow
          color={snowColor}
          flakeSize={0.008}
          minFlakeSize={1.5}
          pixelResolution={180}
          speed={0.7}
          density={snowDensity}
          brightness={snowBrightness}
          direction={135}
          variant="round"
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className={`font-display text-3xl md:text-4xl lg:text-5xl font-black ${colors.primary}`}>
              Game Room
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <p className={`font-body text-sm md:text-base ${colors.textSecondary}`}>
                Room Code:
              </p>
              <button
                onClick={handleCopyCode}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg font-mono font-bold text-base md:text-lg transition-all hover:scale-105 border ${colors.border} ${colors.surface} ${colors.primary}`}
              >
                {roomCode}
                {copied ? (
                  <IoCheckmarkCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <IoCopyOutline className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className={`font-body text-xs md:text-sm mt-1 ${colors.textSecondary}`}>
              Status: <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
                {isConnected ? '● Connected' : '○ Disconnected'}
              </span>
            </p>
          </div>
          <button
            onClick={handleLeaveRoom}
            className="px-4 md:px-6 py-2 md:py-3 rounded-lg font-accent font-bold transition-all hover:scale-105 border border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20 backdrop-blur-xl"
          >
            <IoArrowBack className="w-5 h-5 inline mr-2" />
            Leave Room
          </button>
        </div>

        {/* Game Type Display */}
        {gameType && (
          <div className={`mb-8 p-6 md:p-8 rounded-2xl border text-center backdrop-blur-xl ${colors.surface} ${colors.border}`}>
            <div className={`w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 rounded-2xl flex items-center justify-center ${colors.primaryBg}`}>
              {getGameIcon(gameType)}
            </div>
            <h2 className={`font-display text-2xl md:text-3xl font-black mb-2 ${colors.text}`}>
              {getGameDisplayName(gameType)}
            </h2>
            <p className={`font-body text-sm md:text-base ${colors.textSecondary}`}>
              {gameType === 'uno' && 'Classic card game action!'}
              {gameType === 'scribble' && 'Draw and guess!'}
              {gameType === 'truthordare' && 'Truth or Dare party game!'}
            </p>
          </div>
        )}

        {/* Bot Configuration (Host Only) */}
        {isHost && !gameStarted && (
          <div className={`mb-8 p-6 md:p-8 rounded-2xl border backdrop-blur-xl ${colors.surface} ${colors.border}`}>
            <h2 className={`font-display text-xl md:text-2xl font-bold mb-6 ${colors.text}`}>
              🤖 Bot Players
            </h2>

            {/* Bot Count Selector */}
            <div className="mb-6">
              <label className={`block font-accent font-bold mb-3 text-base md:text-lg ${colors.text}`}>
                Number of Bots: <span className={colors.primary}>{botCount}</span>
              </label>
              <div className="flex gap-3 flex-wrap">
                {[0, 1, 2, 3].map((count) => (
                  <button
                    key={count}
                    onClick={() => setBotCount(count)}
                    className={`px-6 py-3 rounded-lg font-accent font-bold text-base transition-all hover:scale-105 ${botCount === count
                      ? `${colors.primaryBg} ${colors.primaryHover} text-white shadow-lg`
                      : `${colors.surface} ${colors.text} ${colors.border} border`
                      }`}
                  >
                    {count === 0 ? 'No Bots' : `${count} Bot${count > 1 ? 's' : ''}`}
                  </button>
                ))}
              </div>
              <p className={`text-xs md:text-sm mt-2 ${colors.textSecondary}`}>
                {botCount === 0 && '👥 Play with real players only'}
                {botCount === 1 && '🤖 Add 1 AI opponent'}
                {botCount === 2 && '🤖🤖 Add 2 AI opponents'}
                {botCount === 3 && '🤖🤖🤖 Add 3 AI opponents'}
              </p>
            </div>

            {/* Bot Difficulty Selector */}
            {botCount > 0 && (
              <div>
                <label className={`block font-accent font-bold mb-3 text-base md:text-lg ${colors.text}`}>
                  Bot Difficulty
                </label>
                <div className="flex gap-3 flex-wrap">
                  {['easy', 'medium', 'hard'].map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setBotDifficulty(diff)}
                      className={`px-6 py-3 rounded-lg font-accent font-bold text-base capitalize transition-all hover:scale-105 ${botDifficulty === diff
                        ? `${colors.primaryBg} ${colors.primaryHover} text-white shadow-lg`
                        : `${colors.surface} ${colors.text} ${colors.border} border`
                        }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
                <p className={`text-xs md:text-sm mt-2 ${colors.textSecondary}`}>
                  {botDifficulty === 'easy' && '😊 Easy - Bots make simple decisions'}
                  {botDifficulty === 'medium' && '🎯 Medium - Balanced bot strategy'}
                  {botDifficulty === 'hard' && '🔥 Hard - Smart and challenging bots'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Players List */}
        <div className="mb-8">
          <h2 className={`font-display text-xl md:text-2xl font-bold mb-4 flex items-center gap-2 ${colors.text}`}>
            <IoPeopleSharp className="w-6 h-6" />
            Players ({players.length}{botCount > 0 && ` + ${botCount} bot${botCount > 1 ? 's' : ''}`})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {players.map((player, index) => {
              const isPlayerHost = index === 0 || player.username === room?.host;
              const isCurrentUser = player.username === username;
              const isPlayerBot = player.isBot || false;

              return (
                <div
                  key={player.username}
                  className={`p-4 rounded-lg border-2 transition-all backdrop-blur-xl ${isCurrentUser
                    ? `${colors.primaryBg}/20 ${colors.primaryBorder}`
                    : isPlayerBot
                      ? `${colors.secondaryBg}/10 ${colors.secondaryBorder}`
                      : `${colors.bgSecondary} ${colors.border}`
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPlayerHost ? colors.primaryBg : isPlayerBot ? colors.secondaryBg : colors.surface
                      }`}>
                      {isPlayerHost ? (
                        <FaCrown className="w-5 h-5 text-white" />
                      ) : isPlayerBot ? (
                        <span className="text-lg">🤖</span>
                      ) : (
                        <FaUser className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className={`font-accent font-bold ${colors.text}`}>
                        {player.username} {isCurrentUser && '(You)'} {isPlayerBot && '(Bot)'}
                      </p>
                      {isPlayerHost && (
                        <p className={`text-xs font-body ${colors.primary}`}>
                          Host
                        </p>
                      )}
                      {isPlayerBot && player.difficulty && (
                        <p className={`text-xs font-body capitalize ${colors.secondary}`}>
                          {player.difficulty} difficulty
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
              disabled={players.length + botCount < 2}
              className={`px-8 md:px-12 py-3 md:py-4 rounded-lg font-accent font-bold text-base md:text-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-xl ${players.length + botCount >= 2
                ? `${colors.primaryBg} ${colors.primaryHover} text-white`
                : 'bg-gray-500/50 text-gray-300'
                }`}
            >
              <span className="flex items-center gap-2 justify-center">
                <IoGameController className="w-6 h-6" />
                {players.length + botCount < 2 ? 'Need at least 2 players' : 'Start Game'}
              </span>
            </button>
          ) : (
            <div className={`px-8 md:px-12 py-3 md:py-4 rounded-lg font-accent font-bold text-base md:text-lg backdrop-blur-xl ${colors.surface} ${colors.textSecondary}`}>
              Waiting for <span className={colors.primary}>{room?.host || players[0]?.username}</span> to start the game...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
