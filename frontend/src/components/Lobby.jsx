import { useState } from 'react';
import { createRoom, joinRoom } from '../utils/api';

export default function Lobby({ onRoomJoined, onLogout }) {
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
      console.error('Create room error:', err);
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
      console.error('Join room error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
            Game Lobby
          </h1>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>

        <p className="text-gray-600 mb-8">
          Welcome, {localStorage.getItem('username')}!
        </p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Game Selection Modal */}
        {showGameSelection && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full">
              <h2 className="text-3xl font-bold text-gray-800 mb-6">Select a Game</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Scribble Card */}
                <button
                  onClick={() => handleCreateRoom('scribble')}
                  className="group bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl p-6 text-white hover:scale-105 transition-transform shadow-lg"
                >
                  <div className="text-6xl mb-4">✏️</div>
                  <h3 className="text-2xl font-bold mb-2">Scribble</h3>
                  <p className="text-blue-100">Draw and guess words with friends!</p>
                </button>

                {/* UNO Card */}
                <button
                  onClick={() => handleCreateRoom('uno')}
                  className="group bg-gradient-to-br from-red-500 to-orange-400 rounded-xl p-6 text-white hover:scale-105 transition-transform shadow-lg"
                >
                  <div className="text-6xl mb-4">🃏</div>
                  <h3 className="text-2xl font-bold mb-2">UNO</h3>
                  <p className="text-red-100">Classic card game action!</p>
                </button>
              </div>
              <button
                onClick={() => setShowGameSelection(false)}
                className="mt-6 w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Create Room */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-200">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">➕</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Create Room</h2>
            <p className="text-gray-600 mb-6 text-center">Start a new game session</p>
            <button
              onClick={() => setShowGameSelection(true)}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
            >
              Create New Room
            </button>
          </div>

          {/* Join Room */}
          <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-6 border-2 border-pink-200">
            <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🚪</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Join Room</h2>
            <p className="text-gray-600 mb-6 text-center">Enter a 6-character code</p>
            <input
              type="text"
              placeholder="9MALUH"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full px-4 py-3 border-2 border-pink-200 rounded-lg mb-4 text-center text-2xl font-mono uppercase tracking-widest focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={handleJoinRoom}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-600 hover:to-pink-500 transition-all transform hover:scale-105 shadow-lg"
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
