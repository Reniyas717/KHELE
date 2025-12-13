import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';
import { WebSocketProvider } from './context/WebSocketContext';
import { ThemeProvider } from './context/ThemeContext';
import Landing from './pages/Landing';


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

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      
      <Route 
        path="/login" 
        element={
          user ? <Navigate to="/lobby" replace /> : <Login onLogin={handleLogin} />
        } 
      />
      
      <Route 
        path="/lobby" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : currentRoom ? (
            <Navigate to={`/room/${currentRoom}`} replace />
          ) : (
            <Lobby onRoomJoined={handleRoomJoined} onLogout={handleLogout} />
          )
        } 
      />
      
      <Route 
        path="/room/:roomCode" 
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : !currentRoom ? (
            <Navigate to="/lobby" replace />
          ) : (
            <GameRoom
              roomCode={currentRoom}
              username={user.username}
              initialRoomData={roomData}
              preSelectedGame={gameType}
              onLeaveRoom={handleLeaveRoom}
            />
          )
        } 
      />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <WebSocketProvider>
        <Router>
          <AppContent />
        </Router>
      </WebSocketProvider>
    </ThemeProvider>
  );
}

export default App;
