import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { createRoom, joinRoom } from '../utils/api';

export default function Lobby({ onRoomJoined, onLogout }) {
  const { colors, theme, toggleTheme } = useTheme();
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

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: colors.background }}
    >
      <div 
        className="rounded-3xl shadow-2xl p-8 w-full max-w-4xl border"
        style={{
          background: colors.surface,
          borderColor: `${colors.primary}30`,
          backdropFilter: 'blur(20px)'
        }}
      >
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
              Game Lobby
            </h1>
            <p className="font-poppins" style={{ color: colors.textSecondary }}>
              Welcome, {localStorage.getItem('username')}!
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border hover:scale-110 transition-all"
              style={{
                background: colors.surface,
                borderColor: `${colors.primary}30`
              }}
            >
              <span className="text-xl">{theme === 'dark' ? '🌞' : '🌙'}</span>
            </button>
            
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-lg font-raleway font-semibold transition-colors border"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.5)',
                color: '#ef4444'
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div 
            className="px-4 py-3 rounded-lg mb-6 border"
            style={{
              background: 'rgba(220, 38, 38, 0.1)',
              borderColor: 'rgba(220, 38, 38, 0.5)',
              color: '#ef4444'
            }}
          >
            {error}
          </div>
        )}

        {/* Game Selection Modal */}
        {showGameSelection && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div 
              className="rounded-2xl p-8 max-w-3xl w-full border"
              style={{
                background: colors.surface,
                borderColor: `${colors.primary}30`,
                backdropFilter: 'blur(20px)'
              }}
            >
              <h2 className="text-3xl font-orbitron font-black mb-6" style={{ color: colors.text }}>
                Select a Game
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Scribble */}
                <button
                  onClick={() => handleCreateRoom('scribble')}
                  className="rounded-xl p-6 hover:scale-105 transition-transform border"
                  style={{
                    background: `linear-gradient(135deg, ${colors.secondary}, ${colors.accent})`,
                    borderColor: 'rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="text-6xl mb-4">✏️</div>
                  <h3 className="text-2xl font-orbitron font-bold mb-2 text-white">Scribble</h3>
                  <p className="font-poppins text-sm" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Draw and guess words with friends!
                  </p>
                </button>

                {/* UNO */}
                <button
                  onClick={() => handleCreateRoom('uno')}
                  className="rounded-xl p-6 hover:scale-105 transition-transform border"
                  style={{
                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`,
                    borderColor: 'rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="text-6xl mb-4">🃏</div>
                  <h3 className="text-2xl font-orbitron font-bold mb-2 text-white">UNO</h3>
                  <p className="font-poppins text-sm" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Classic card game action!
                  </p>
                </button>

                {/* Truth or Dare - NEW */}
                <button
                  onClick={() => handleCreateRoom('truthordare')}
                  className="rounded-xl p-6 hover:scale-105 transition-transform border"
                  style={{
                    background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
                    borderColor: 'rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="text-6xl mb-4">🎭</div>
                  <h3 className="text-2xl font-orbitron font-bold mb-2 text-white">Truth or Dare</h3>
                  <p className="font-poppins text-sm" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Test your courage & honesty!
                  </p>
                </button>
              </div>
              <button
                onClick={() => setShowGameSelection(false)}
                className="mt-6 w-full py-3 rounded-lg font-raleway font-semibold transition-colors border"
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderColor: `${colors.primary}30`,
                  color: colors.text
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Create Room */}
          <div 
            className="rounded-2xl p-6 border-2"
            style={{
              background: `${colors.primary}10`,
              borderColor: `${colors.primary}40`
            }}
          >
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: colors.primary }}
            >
              <span className="text-3xl">➕</span>
            </div>
            <h2 className="text-2xl font-orbitron font-bold mb-2 text-center" style={{ color: colors.text }}>
              Create Room
            </h2>
            <p className="font-poppins mb-6 text-center" style={{ color: colors.textSecondary }}>
              Start a new game session
            </p>
            <button
              onClick={() => setShowGameSelection(true)}
              className="w-full py-3 rounded-lg font-raleway font-bold transition-all hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                color: '#000',
                boxShadow: `0 0 40px ${colors.glow}60`
              }}
            >
              Create New Room
            </button>
          </div>

          {/* Join Room */}
          <div 
            className="rounded-2xl p-6 border-2"
            style={{
              background: `${colors.secondary}10`,
              borderColor: `${colors.secondary}40`
            }}
          >
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: colors.secondary }}
            >
              <span className="text-3xl">🚪</span>
            </div>
            <h2 className="text-2xl font-orbitron font-bold mb-2 text-center" style={{ color: colors.text }}>
              Join Room
            </h2>
            <p className="font-poppins mb-6 text-center" style={{ color: colors.textSecondary }}>
              Enter a 6-character code
            </p>
            <input
              type="text"
              placeholder="9MALUH"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full px-4 py-3 border-2 rounded-lg mb-4 text-center text-2xl font-mono uppercase tracking-widest focus:outline-none"
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderColor: `${colors.secondary}40`,
                color: colors.text
              }}
            />
            <button
              onClick={handleJoinRoom}
              className="w-full py-3 rounded-lg font-raleway font-bold transition-all hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${colors.secondary}, ${colors.accent})`,
                color: '#000',
                boxShadow: `0 0 40px ${colors.secondary}60`
              }}
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
