import { useState, useEffect } from 'react';
import Login from '../components/Login';
import GameRoom from '../components/GameRoom';
import api from '../utils/api';

export default function Home() {
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
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-4xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
              🎮 Game Lobby
            </h1>
            <p className="text-gray-600 mt-2">
              Welcome, <span className="font-semibold text-purple-600">{user.username}</span>!
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold"
          >
            Logout
          </button>
        </div>

        {/* Create Game Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">🎯 Create New Game</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scribble */}
            <button
              onClick={() => handleCreateRoom('scribble')}
              disabled={isCreating}
              className="group relative overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-2xl p-8 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
            >
              <div className="relative z-10 text-center">
                <div className="text-6xl mb-4">✏️</div>
                <h3 className="text-2xl font-bold mb-2">Scribble</h3>
                <p className="text-sm opacity-90">Draw and guess with friends!</p>
              </div>
            </button>

            {/* UNO */}
            <button
              onClick={() => handleCreateRoom('uno')}
              disabled={isCreating}
              className="group relative overflow-hidden bg-gradient-to-br from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white rounded-2xl p-8 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
            >
              <div className="relative z-10 text-center">
                <div className="text-6xl mb-4">🃏</div>
                <h3 className="text-2xl font-bold mb-2">UNO</h3>
                <p className="text-sm opacity-90">Classic card game!</p>
              </div>
            </button>
          </div>
        </div>

        {/* Join Room Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">🚪 Join Existing Room</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              placeholder="Enter 6-digit code"
              maxLength={6}
              className="flex-1 px-6 py-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 text-xl font-mono tracking-wider uppercase text-center"
            />
            <button
              onClick={handleJoinRoom}
              disabled={isJoining || !roomCode.trim() || roomCode.length !== 6}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-bold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-xl"
            >
              {isJoining ? '⏳ Joining...' : '🚀 Join'}
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
            <h2 className="text-3xl font-bold mb-6 text-gray-800 text-center">
              {showSettings === 'scribble' ? '✏️ Scribble' : '🃏 UNO'} Settings
            </h2>
            
            {showSettings === 'scribble' ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📊 Number of Rounds
                  </label>
                  <select
                    value={gameSettings.maxRounds}
                    onChange={(e) => setGameSettings({...gameSettings, maxRounds: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-lg"
                  >
                    <option value={2}>2 Rounds</option>
                    <option value={3}>3 Rounds (Recommended)</option>
                    <option value={4}>4 Rounds</option>
                    <option value={5}>5 Rounds</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ⏱️ Time per Turn
                  </label>
                  <select
                    value={gameSettings.drawTime}
                    onChange={(e) => setGameSettings({...gameSettings, drawTime: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-lg"
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🏆 Win Score
                  </label>
                  <select
                    value={gameSettings.winScore}
                    onChange={(e) => setGameSettings({...gameSettings, winScore: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-lg"
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
                className="flex-1 px-4 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWithSettings}
                disabled={isCreating}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-colors disabled:opacity-50 font-semibold shadow-lg"
              >
                {isCreating ? '⏳ Creating...' : '🎮 Create Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}