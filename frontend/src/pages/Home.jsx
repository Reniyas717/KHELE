import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Login from '../components/Login';
import GameRoom from '../components/GameRoom';
import { useTheme } from '../context/ThemeContext';
import PixelSnow from '../components/ui/PixelSnow';
import api from '../utils/api';
import {
  IoLogOutOutline,
  IoArrowBack,
  IoBrushSharp,
  IoGameController,
  IoArrowForward,
  IoSunnyOutline,
  IoMoonOutline,
  IoPeopleSharp
} from 'react-icons/io5';
import { FaIdCard } from 'react-icons/fa6';

export default function Home() {
  const { colors, theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showSettings, setShowSettings] = useState(null);
  const [gameSettings, setGameSettings] = useState({
    maxRounds: 3,
    drawTime: 80,
    winScore: 500
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    console.log('🔍 Checking saved user:', { token: !!token, savedUser });

    if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        console.log('✅ Restored user:', userData);
        setUser(userData);
      } catch (error) {
        console.error('❌ Error parsing saved user:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleLogin = (userData) => {
    console.log('✅ User logged in:', userData);
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    console.log('👋 Logging out');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setCurrentRoom(null);
    navigate('/');
  };

  const handleCreateRoom = (gameType) => {
    if (!user || !user.username) {
      alert('Please login first!');
      return;
    }
    console.log('🎮 Opening settings for:', gameType);
    setShowSettings(gameType);
  };

  const handleCreateWithSettings = async () => {
    if (!showSettings) return;

    if (!user || !user.username) {
      alert('User not found. Please login again.');
      return;
    }

    try {
      setIsCreating(true);

      const requestData = {
        host: user.username,
        gameType: showSettings,
        settings: showSettings === 'scribble' ? {
          maxRounds: gameSettings.maxRounds,
          drawTime: gameSettings.drawTime
        } : {
          winScore: gameSettings.winScore
        }
      };

      console.log('📤 Sending create room request:', requestData);

      const response = await api.post('/rooms/create', requestData);

      console.log('✅ Room created successfully:', response.data);

      const roomData = response.data.room;

      setCurrentRoom({
        code: roomData.roomCode,
        data: roomData,
        preSelectedGame: showSettings
      });

      setShowSettings(null);

    } catch (error) {
      console.error('❌ Error creating room:', error);
      console.error('Error response:', error.response?.data);
      alert(error.response?.data?.message || 'Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!user || !user.username) {
      alert('Please login first!');
      return;
    }

    const trimmedCode = roomCode.trim().toUpperCase();
    if (!trimmedCode) {
      alert('Please enter a room code!');
      return;
    }

    try {
      setIsJoining(true);

      console.log('🚪 Joining room:', { roomCode: trimmedCode, username: user.username });

      const response = await api.post('/rooms/join', {
        roomCode: trimmedCode,
        username: user.username
      });

      console.log('✅ Joined room successfully:', response.data);

      setCurrentRoom({
        code: response.data.room.roomCode,
        data: response.data.room,
        preSelectedGame: response.data.room.gameType
      });

    } catch (error) {
      console.error('❌ Error joining room:', error);
      alert(error.response?.data?.message || 'Failed to join room. Please check the code.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveRoom = () => {
    console.log('👋 Leaving room');
    setCurrentRoom(null);
    setRoomCode('');
  };

  // Theme-based PixelSnow colors
  const snowColor = theme === 'dark' ? '#00d9ff' : '#10b981';
  const snowDensity = theme === 'dark' ? 0.12 : 0.08;
  const snowBrightness = theme === 'dark' ? 0.5 : 0.35;

  // Show login if no user
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Show game room if in a room
  if (currentRoom) {
    return (
      <GameRoom
        roomCode={currentRoom.code}
        username={user.username}
        initialRoomData={currentRoom.data}
        preSelectedGame={currentRoom.preSelectedGame}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  // Main lobby
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative ${colors.bg} transition-colors duration-300`}>
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

      {/* Back to Landing Button */}
      <button
        onClick={() => navigate('/')}
        className={`absolute top-4 left-4 p-3 rounded-xl border transition-all hover:scale-110 z-10 backdrop-blur-xl ${colors.surface} ${colors.border}`}
        aria-label="Back to landing"
      >
        <IoArrowBack className={`w-5 h-5 ${colors.primary}`} />
      </button>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className={`absolute top-4 right-20 p-3 rounded-xl border transition-all hover:scale-110 z-10 backdrop-blur-xl ${colors.surface} ${colors.border}`}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <IoSunnyOutline className="w-5 h-5" />
        ) : (
          <IoMoonOutline className="w-5 h-5" />
        )}
      </button>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className={`absolute top-4 right-4 px-4 py-2 rounded-xl font-accent font-bold transition-all hover:scale-105 z-10 backdrop-blur-xl border border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20`}
      >
        <IoLogOutOutline className="w-5 h-5 inline mr-2" />
        Logout
      </button>

      <div className={`relative z-10 rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-4xl border backdrop-blur-xl ${colors.surface} ${colors.border}`}>
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className={`font-display text-4xl md:text-5xl lg:text-6xl font-black mb-2 ${colors.primary}`}>
            Game Lobby
          </h1>
          <p className={`font-body text-sm md:text-base ${colors.textSecondary}`}>
            Welcome, <span className={`font-semibold ${colors.primary}`}>{user.username}</span>!
          </p>
        </div>

        {/* Create Game Section */}
        <div className="mb-8">
          <h2 className={`font-display text-xl md:text-2xl font-bold mb-4 ${colors.text}`}>
            Create New Game
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scribble */}
            <button
              onClick={() => handleCreateRoom('scribble')}
              disabled={isCreating}
              className={`group relative overflow-hidden rounded-2xl p-6 md:p-8 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl border ${colors.border} ${colors.bgSecondary} hover:${colors.surface}`}
            >
              <div className="relative z-10 text-center">
                <div className={`text-5xl md:text-6xl mb-4 mx-auto w-16 h-16 md:w-20 md:h-20 flex items-center justify-center rounded-2xl ${colors.primaryBg}`}>
                  <IoBrushSharp className="w-8 h-8 md:w-10 md:h-10 text-white" />
                </div>
                <h3 className={`font-display text-xl md:text-2xl font-black mb-2 ${colors.text}`}>Scribble</h3>
                <p className={`font-body text-xs md:text-sm ${colors.textSecondary}`}>Draw and guess with friends!</p>
              </div>
            </button>

            {/* UNO */}
            <button
              onClick={() => handleCreateRoom('uno')}
              disabled={isCreating}
              className={`group relative overflow-hidden rounded-2xl p-6 md:p-8 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl border ${colors.border} ${colors.bgSecondary} hover:${colors.surface}`}
            >
              <div className="relative z-10 text-center">
                <div className={`text-5xl md:text-6xl mb-4 mx-auto w-16 h-16 md:w-20 md:h-20 flex items-center justify-center rounded-2xl ${colors.secondaryBg}`}>
                  <FaIdCard className="w-8 h-8 md:w-10 md:h-10 text-white" />
                </div>
                <h3 className={`font-display text-xl md:text-2xl font-black mb-2 ${colors.text}`}>UNO</h3>
                <p className={`font-body text-xs md:text-sm ${colors.textSecondary}`}>Classic card game!</p>
              </div>
            </button>
          </div>
        </div>

        {/* Join Room Section */}
        <div>
          <h2 className={`font-display text-xl md:text-2xl font-bold mb-4 ${colors.text}`}>
            Join Existing Room
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              placeholder="Enter 6-digit code"
              maxLength={6}
              className={`flex-1 px-4 md:px-6 py-3 md:py-4 border-2 rounded-xl focus:outline-none text-lg md:text-xl font-mono tracking-wider uppercase text-center backdrop-blur-xl ${colors.bgSecondary} ${colors.border} ${colors.text} focus:${colors.primaryBorder}`}
            />
            <button
              onClick={handleJoinRoom}
              disabled={isJoining || !roomCode.trim() || roomCode.length !== 6}
              className={`px-6 md:px-8 py-3 md:py-4 rounded-xl font-accent font-bold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-xl ${colors.primaryBg} ${colors.primaryHover} text-white`}
            >
              <span className="flex items-center gap-2 justify-center">
                {isJoining ? 'Joining...' : 'Join'}
                {!isJoining && <IoArrowForward className="w-5 h-5" />}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-scale-in border backdrop-blur-xl ${colors.surface} ${colors.border}`}>
            <h2 className={`font-display text-2xl md:text-3xl font-black mb-6 text-center ${colors.text}`}>
              {showSettings === 'scribble' ? (
                <span className="flex items-center justify-center gap-2">
                  <IoBrushSharp className="w-8 h-8" /> Scribble Settings
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <FaIdCard className="w-8 h-8" /> UNO Settings
                </span>
              )}
            </h2>

            {showSettings === 'scribble' ? (
              <div className="space-y-6">
                <div>
                  <label className={`block font-accent text-sm font-semibold mb-2 ${colors.text}`}>
                    Number of Rounds
                  </label>
                  <select
                    value={gameSettings.maxRounds}
                    onChange={(e) => setGameSettings({ ...gameSettings, maxRounds: parseInt(e.target.value) })}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none text-base md:text-lg backdrop-blur-xl ${colors.bgSecondary} ${colors.border} ${colors.text} focus:${colors.primaryBorder}`}
                  >
                    <option value={2}>2 Rounds</option>
                    <option value={3}>3 Rounds (Recommended)</option>
                    <option value={4}>4 Rounds</option>
                    <option value={5}>5 Rounds</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-accent text-sm font-semibold mb-2 ${colors.text}`}>
                    Time per Turn
                  </label>
                  <select
                    value={gameSettings.drawTime}
                    onChange={(e) => setGameSettings({ ...gameSettings, drawTime: parseInt(e.target.value) })}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none text-base md:text-lg backdrop-blur-xl ${colors.bgSecondary} ${colors.border} ${colors.text} focus:${colors.primaryBorder}`}
                  >
                    <option value={60}>60 seconds</option>
                    <option value={80}>80 seconds (Recommended)</option>
                    <option value={90}>90 seconds</option>
                    <option value={120}>2 minutes</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className={`block font-accent text-sm font-semibold mb-2 ${colors.text}`}>
                    Win Score
                  </label>
                  <select
                    value={gameSettings.winScore}
                    onChange={(e) => setGameSettings({ ...gameSettings, winScore: parseInt(e.target.value) })}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none text-base md:text-lg backdrop-blur-xl ${colors.bgSecondary} ${colors.border} ${colors.text} focus:${colors.primaryBorder}`}
                  >
                    <option value={200}>200 Points (Quick)</option>
                    <option value={500}>500 Points (Standard)</option>
                    <option value={1000}>1000 Points (Long)</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowSettings(null)}
                disabled={isCreating}
                className={`flex-1 px-4 py-3 rounded-lg transition-colors font-accent font-semibold disabled:opacity-50 border ${colors.border} ${colors.bgSecondary} ${colors.text} hover:${colors.surface}`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWithSettings}
                disabled={isCreating}
                className={`flex-1 px-4 py-3 rounded-lg transition-colors disabled:opacity-50 font-accent font-bold shadow-lg ${colors.primaryBg} ${colors.primaryHover} text-white`}
              >
                {isCreating ? 'Creating...' : (
                  <span className="flex items-center gap-2 justify-center">
                    <IoGameController className="w-5 h-5" />
                    Create Room
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}