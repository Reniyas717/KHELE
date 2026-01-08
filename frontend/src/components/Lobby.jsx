import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { createRoom, joinRoom } from '../utils/api';
import PixelSnow from './ui/PixelSnow';
import {
  IoLogOutOutline,
  IoArrowBack,
  IoSunnyOutline,
  IoMoonOutline,
  IoBrushSharp,
  IoGameController,
  IoArrowForward,
  IoAddCircleOutline,
  IoEnterOutline
} from 'react-icons/io5';
import { FaIdCard } from 'react-icons/fa6';
import { MdTheaterComedy } from 'react-icons/md';

export default function Lobby({ onRoomJoined, onLogout }) {
  const { colors, theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [showGameSelection, setShowGameSelection] = useState(false);

  const handleCreateRoom = async (gameType) => {
    try {
      setError('');
      const response = await createRoom(gameType);
      setShowGameSelection(false);
      onRoomJoined(response.roomCode, response.room, gameType);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create room');
    }
  };

  const handleJoinRoom = async () => {
    try {
      setError('');
      if (!roomCode.trim()) {
        setError('Please enter a room code');
        return;
      }
      const response = await joinRoom(roomCode.toUpperCase());
      onRoomJoined(response.room.roomCode, response.room, response.room.gameType);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join room');
    }
  };

  // Theme-based PixelSnow colors
  const snowColor = theme === 'dark' ? '#00d9ff' : '#10b981';
  const snowDensity = theme === 'dark' ? 0.12 : 0.08;
  const snowBrightness = theme === 'dark' ? 0.5 : 0.35;

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
        onClick={onLogout}
        className="absolute top-4 right-4 px-4 py-2 rounded-xl font-accent font-bold transition-all hover:scale-105 z-10 backdrop-blur-xl border border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20"
      >
        <IoLogOutOutline className="w-5 h-5 inline mr-2" />
        Logout
      </button>

      <div className={`relative z-10 rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-4xl border backdrop-blur-xl ${colors.surface} ${colors.border}`}>
        <div className="mb-8 text-center">
          <h1 className={`font-display text-4xl md:text-5xl lg:text-6xl font-black mb-2 ${colors.primary}`}>
            Game Lobby
          </h1>
          <p className={`font-body text-sm md:text-base ${colors.textSecondary}`}>
            Welcome, <span className={`font-semibold ${colors.primary}`}>{localStorage.getItem('username')}</span>!
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg mb-6 border bg-red-500/10 border-red-500/50 text-red-500">
            {error}
          </div>
        )}

        {/* Game Selection Modal */}
        {showGameSelection && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`rounded-2xl p-6 md:p-8 max-w-3xl w-full border backdrop-blur-xl ${colors.surface} ${colors.border}`}>
              <h2 className={`font-display text-2xl md:text-3xl font-black mb-6 text-center ${colors.text}`}>
                Select a Game
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {/* Scribble */}
                <button
                  onClick={() => handleCreateRoom('scribble')}
                  className={`rounded-xl p-6 hover:scale-105 transition-transform border backdrop-blur-xl ${colors.bgSecondary} ${colors.border} hover:${colors.surface}`}
                >
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${colors.primaryBg}`}>
                    <IoBrushSharp className="w-8 h-8 text-white" />
                  </div>
                  <h3 className={`font-display text-xl md:text-2xl font-bold mb-2 ${colors.text}`}>Scribble</h3>
                  <p className={`font-body text-xs md:text-sm ${colors.textSecondary}`}>
                    Draw and guess words with friends!
                  </p>
                </button>

                {/* UNO */}
                <button
                  onClick={() => handleCreateRoom('uno')}
                  className={`rounded-xl p-6 hover:scale-105 transition-transform border backdrop-blur-xl ${colors.bgSecondary} ${colors.border} hover:${colors.surface}`}
                >
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${colors.secondaryBg}`}>
                    <FaIdCard className="w-8 h-8 text-white" />
                  </div>
                  <h3 className={`font-display text-xl md:text-2xl font-bold mb-2 ${colors.text}`}>UNO</h3>
                  <p className={`font-body text-xs md:text-sm ${colors.textSecondary}`}>
                    Classic card game action!
                  </p>
                </button>

                {/* Truth or Dare */}
                <button
                  onClick={() => handleCreateRoom('truthordare')}
                  className={`rounded-xl p-6 hover:scale-105 transition-transform border backdrop-blur-xl ${colors.bgSecondary} ${colors.border} hover:${colors.surface}`}
                >
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${colors.accentBg}`}>
                    <MdTheaterComedy className="w-8 h-8 text-white" />
                  </div>
                  <h3 className={`font-display text-xl md:text-2xl font-bold mb-2 ${colors.text}`}>Truth or Dare</h3>
                  <p className={`font-body text-xs md:text-sm ${colors.textSecondary}`}>
                    Test your courage & honesty!
                  </p>
                </button>
              </div>
              <button
                onClick={() => setShowGameSelection(false)}
                className={`mt-6 w-full py-3 rounded-lg font-accent font-semibold transition-colors border ${colors.border} ${colors.bgSecondary} ${colors.text} hover:${colors.surface}`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {/* Create Room */}
          <div className={`rounded-2xl p-6 border-2 backdrop-blur-xl ${colors.bgSecondary} ${colors.border} hover:${colors.surface} transition-all`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${colors.primaryBg}`}>
              <IoAddCircleOutline className="w-8 h-8 text-white" />
            </div>
            <h2 className={`font-display text-xl md:text-2xl font-bold mb-2 text-center ${colors.text}`}>
              Create Room
            </h2>
            <p className={`font-body text-sm mb-6 text-center ${colors.textSecondary}`}>
              Start a new game session
            </p>
            <button
              onClick={() => setShowGameSelection(true)}
              className={`w-full py-3 rounded-lg font-accent font-bold transition-all hover:scale-105 shadow-xl ${colors.primaryBg} ${colors.primaryHover} text-white`}
            >
              <span className="flex items-center gap-2 justify-center">
                <IoGameController className="w-5 h-5" />
                Create New Room
              </span>
            </button>
          </div>

          {/* Join Room */}
          <div className={`rounded-2xl p-6 border-2 backdrop-blur-xl ${colors.bgSecondary} ${colors.border} hover:${colors.surface} transition-all`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${colors.secondaryBg}`}>
              <IoEnterOutline className="w-8 h-8 text-white" />
            </div>
            <h2 className={`font-display text-xl md:text-2xl font-bold mb-2 text-center ${colors.text}`}>
              Join Room
            </h2>
            <p className={`font-body text-sm mb-6 text-center ${colors.textSecondary}`}>
              Enter a 6-character code
            </p>
            <input
              type="text"
              placeholder="ABCDEF"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              maxLength={6}
              className={`w-full px-4 py-3 border-2 rounded-lg mb-4 text-center text-xl md:text-2xl font-mono uppercase tracking-widest focus:outline-none backdrop-blur-xl ${colors.bgSecondary} ${colors.border} ${colors.text} focus:${colors.primaryBorder}`}
            />
            <button
              onClick={handleJoinRoom}
              disabled={!roomCode.trim() || roomCode.length !== 6}
              className={`w-full py-3 rounded-lg font-accent font-bold transition-all hover:scale-105 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${colors.secondaryBg} ${colors.secondaryHover} text-white`}
            >
              <span className="flex items-center gap-2 justify-center">
                Join Room
                <IoArrowForward className="w-5 h-5" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
