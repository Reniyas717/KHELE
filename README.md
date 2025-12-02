# TheGame - Multiplayer Game Platform

A real-time multiplayer gaming platform built with the MERN stack featuring Scribble (Pictionary) and UNO card game. Uses native WebSockets for real-time communication.

## 🎮 Features

- **Two Multiplayer Games:**
  - **Scribble**: Draw and guess game with real-time canvas synchronization
  - **UNO**: Classic card game with full game logic implementation
  
- **Real-time Communication**: Native WebSocket implementation (no Socket.io)
- **Room System**: Create or join rooms with 6-character codes
- **Authentication**: Simple username/password system
- **Modern UI**: Built with Tailwind CSS v4

## 📁 Project Structure

```
TheGame/
├── frontend/          # React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx         # Authentication screen
│   │   │   ├── Lobby.jsx         # Room creation/joining
│   │   │   ├── GameRoom.jsx      # Waiting room & game selection
│   │   │   ├── ScribbleGame.jsx  # Drawing game
│   │   │   └── UNOGame.jsx       # Card game
│   │   ├── context/
│   │   │   └── WebSocketContext.jsx  # WebSocket management
│   │   ├── utils/
│   │   │   └── api.js            # API utilities
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
└── backend/           # Express + MongoDB + Native WS
    ├── models/
    │   ├── User.js              # User model
    │   └── GameRoom.js          # Game room model
    ├── routes/
    │   ├── auth.js              # Auth endpoints
    │   └── rooms.js             # Room endpoints
    ├── controllers/
    │   ├── scribbleGame.js      # Scribble game logic
    │   └── unoGame.js           # UNO game logic
    ├── websocket.js             # WebSocket server & message router
    ├── server.js
    └── package.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16+)
- MongoDB (running locally or remote)
- npm or yarn

### Installation

1. **Clone the repository** (if from Git) or navigate to project directory

2. **Backend Setup:**
```bash
cd backend
npm install
```

3. **Frontend Setup:**
```bash
cd frontend
npm install
```

### Configuration

Update `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/thegame
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### Running the Application

**Terminal 1 - Start MongoDB** (if local):
```bash
mongod
```

**Terminal 2 - Start Backend:**
```bash
cd backend
npm run dev
```
Backend runs on `http://localhost:5000` with WebSocket on `ws://localhost:5000`

**Terminal 3 - Start Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on `http://localhost:5173`

## 🎯 How to Play

### Getting Started
1. **Register/Login**: Create an account or login with existing credentials
2. **Create or Join Room**: 
   - Create a new room (generates 6-character code)
   - Join existing room with code
3. **Select Game**: Host chooses Scribble or UNO
4. **Play**: Have fun with your friends!

### Scribble Rules
- One player draws a word on the canvas
- Other players guess by typing in chat
- Correct guesses earn points
- Drawer rotates each round
- 3 rounds total

### UNO Rules
- Standard UNO card game rules
- Match color, number, or type
- Special cards: Skip, Reverse, Draw Two, Wild, Wild Draw Four
- First to empty their hand wins

## 🛠️ Technical Implementation

### WebSocket Messages

The system uses a type/payload message structure:

```javascript
// Client sends:
{ 
  type: 'DRAW_LINE', 
  payload: { roomCode, line: { x, y } } 
}

// Server responds:
{ 
  type: 'DRAW_LINE', 
  payload: { line: { x, y } } 
}
```

### Key Message Types

**Room Management:**
- `JOIN_ROOM`, `LEAVE_ROOM`, `PLAYER_JOINED`, `PLAYER_LEFT`

**Game Control:**
- `START_GAME`, `GAME_STARTED`, `GAME_OVER`

**Scribble:**
- `DRAW_LINE`, `CLEAR_CANVAS`, `GUESS_WORD`, `CORRECT_GUESS`, `NEXT_ROUND`

**UNO:**
- `PLAY_CARD`, `DRAW_CARD`, `CARD_PLAYED`, `YOUR_HAND`

### API Endpoints

**Auth:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

**Rooms:**
- `POST /api/rooms/create` - Create new room
- `POST /api/rooms/join` - Join existing room
- `GET /api/rooms/:roomCode` - Get room details

## 🎨 Tech Stack

### Frontend
- **React** - UI library
- **Vite** - Build tool
- **Tailwind CSS v4** - Styling
- **Native WebSocket API** - Real-time communication
- **Axios** - HTTP requests

### Backend
- **Node.js & Express** - Server
- **MongoDB & Mongoose** - Database
- **ws** - Native WebSocket library
- **bcryptjs** - Password hashing
- **jsonwebtoken** - Authentication
- **dotenv** - Environment variables

## 🔧 Development

### Available Scripts

**Frontend:**
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

**Backend:**
```bash
npm run dev      # Start with nodemon (auto-reload)
npm start        # Start production server
```

### Adding New Games

1. Create game logic controller in `backend/controllers/`
2. Add message handlers in `backend/websocket.js`
3. Create game component in `frontend/src/components/`
4. Add game selection in `GameRoom.jsx`

## 🐛 Troubleshooting

**MongoDB Connection Error:**
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`

**WebSocket Connection Failed:**
- Verify backend is running on port 5000
- Check firewall settings

**Frontend Not Loading:**
- Clear browser cache
- Check console for errors
- Verify all npm packages are installed

## 📝 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

Built with modern web technologies and clean architecture principles. No bloated libraries - just raw, native WebSocket power!
