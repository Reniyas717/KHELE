import { useState, useEffect } from 'react';
import Login from './components/Login';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';
import { WebSocketProvider } from './context/WebSocketContext';

function AppContent() {
  const [user, setUser] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [gameType, setGameType] = useState(null);

  useEffect(() => {
    const username = localStorage.getItem('username');
    if (username) {
      setUser({ username });
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('username', userData.username);
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentRoom(null);
    setRoomData(null);
    setGameType(null);
    localStorage.removeItem('username');
  };

  const handleRoomJoined = (roomCode, room, selectedGameType) => {
    setCurrentRoom(roomCode);
    setRoomData(room);
    setGameType(selectedGameType);
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
    setRoomData(null);
    setGameType(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (currentRoom) {
    return (
      <GameRoom
        roomCode={currentRoom}
        username={user.username}
        initialRoomData={roomData}
        preSelectedGame={gameType}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return (
    <Lobby
      onRoomJoined={handleRoomJoined}
      onLogout={handleLogout}
    />
  );
}

function App() {
  return (
    <WebSocketProvider>
      <AppContent />
    </WebSocketProvider>
  );
}

export default App;
