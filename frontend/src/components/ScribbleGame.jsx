import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export default function ScribbleGame({ roomCode, username, gameState: initialGameState, onLeave }) {
  const { send, on, off } = useWebSocket();
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawer, setCurrentDrawer] = useState(initialGameState.currentDrawer);
  const [myWord, setMyWord] = useState('');
  const [wordLength, setWordLength] = useState(initialGameState.wordLength);
  const [roundNumber, setRoundNumber] = useState(initialGameState.roundNumber);
  const [guessedPlayers, setGuessedPlayers] = useState(initialGameState.guessedPlayers || []);
  const [chatMessages, setChatMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [finalScores, setFinalScores] = useState([]);
  const chatEndRef = useRef(null);

  const isDrawer = currentDrawer === username;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const cleanupYourWord = on('YOUR_WORD', (payload) => {
      setMyWord(payload.word);
    });

    const cleanupDrawLine = on('DRAW_LINE', (payload) => {
      drawLineFromData(payload.line);
    });

    const cleanupClearCanvas = on('CLEAR_CANVAS', () => {
      clearCanvas();
    });

    const cleanupChatMessage = on('CHAT_MESSAGE', (payload) => {
      setChatMessages(prev => [...prev, payload]);
    });

    const cleanupCorrectGuess = on('CORRECT_GUESS', (payload) => {
      setChatMessages(prev => [...prev, {
        username: 'System',
        message: `${payload.username} guessed correctly! Word was: ${payload.word}`,
        timestamp: Date.now()
      }]);
      setGuessedPlayers(payload.guessedPlayers);
    });

    const cleanupRoundComplete = on('ROUND_COMPLETE', (payload) => {
      setChatMessages(prev => [...prev, {
        username: 'System',
        message: `Round complete! The word was: ${payload.word}`,
        timestamp: Date.now()
      }]);
    });

    const cleanupNextRound = on('NEXT_ROUND', (payload) => {
      setCurrentDrawer(payload.currentDrawer);
      setWordLength(payload.wordLength);
      setRoundNumber(payload.roundNumber);
      setGuessedPlayers([]);
      setMyWord('');
      clearCanvas();
      setChatMessages(prev => [...prev, {
        username: 'System',
        message: `Round ${payload.roundNumber} - ${payload.currentDrawer} is now drawing!`,
        timestamp: Date.now()
      }]);
    });

    const cleanupGameOver = on('GAME_OVER', (payload) => {
      setGameOver(true);
      setFinalScores(payload.finalScores);
    });

    return () => {
      cleanupYourWord();
      cleanupDrawLine();
      cleanupClearCanvas();
      cleanupChatMessage();
      cleanupCorrectGuess();
      cleanupRoundComplete();
      cleanupNextRound();
      cleanupGameOver();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const startDrawing = (e) => {
    if (!isDrawer) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing || !isDrawer) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Send drawing data
    send('DRAW_LINE', {
      roomCode,
      line: { x, y }
    });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const drawLineFromData = (line) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(line.x, line.y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleClearCanvas = () => {
    if (!isDrawer) return;
    clearCanvas();
    send('CLEAR_CANVAS', { roomCode });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    if (isDrawer) {
      send('CHAT_MESSAGE', {
        roomCode,
        username,
        message: messageInput
      });
    } else {
      send('GUESS_WORD', {
        roomCode,
        username,
        guess: messageInput
      });
      send('CHAT_MESSAGE', {
        roomCode,
        username,
        message: messageInput
      });
    }

    setMessageInput('');
  };

  const handleNextRound = () => {
    send('NEXT_ROUND', { roomCode });
  };

  if (gameOver) {
    return (
      <div className="min-h-screen bg-linear-to-br from-green-500 via-emerald-500 to-teal-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-2xl text-center">
          <div className="text-6xl mb-6">🏆</div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-linear-to-r from-yellow-600 to-orange-600 mb-8">
            Game Over!
          </h1>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Final Scores</h2>
            <div className="space-y-3">
              {finalScores.map((player, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-xl ${
                    index === 0 ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl font-bold text-gray-500">#{index + 1}</span>
                    <span className="font-bold text-lg">{player.username}</span>
                    {index === 0 && <span className="text-2xl">👑</span>}
                  </div>
                  <span className="text-2xl font-bold text-blue-600">{player.score}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={onLeave}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition duration-300 transform hover:scale-105"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4 flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-linear-to-r from-purple-600 to-pink-600">
              Scribble
            </h1>
            <div className="bg-blue-100 px-4 py-2 rounded-lg">
              <span className="text-sm text-gray-600">Round:</span>
              <span className="ml-2 font-bold text-blue-600">{roundNumber}/3</span>
            </div>
            <div className="bg-purple-100 px-4 py-2 rounded-lg">
              <span className="text-sm text-gray-600">Word:</span>
              <span className="ml-2 font-bold text-purple-600">
                {isDrawer ? myWord : '_ '.repeat(wordLength)}
              </span>
            </div>
            <div className="bg-green-100 px-4 py-2 rounded-lg">
              <span className="text-sm text-gray-600">Drawing:</span>
              <span className="ml-2 font-bold text-green-600">{currentDrawer}</span>
            </div>
          </div>
          <button
            onClick={onLeave}
            className="px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition"
          >
            Leave
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Canvas */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className="border-2 border-gray-300 rounded-xl cursor-crosshair w-full"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
              {isDrawer && (
                <button
                  onClick={handleClearCanvas}
                  className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition"
                >
                  Clear Canvas
                </button>
              )}
            </div>
          </div>

          {/* Chat */}
          <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-col h-[680px]">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Chat</h2>
            <div className="flex-1 overflow-y-auto mb-4 space-y-2">
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`p-2 rounded-lg ${
                    msg.username === 'System' ? 'bg-yellow-100' : 'bg-gray-100'
                  }`}
                >
                  <span className="font-bold text-sm">{msg.username}:</span>
                  <span className="ml-2 text-sm">{msg.message}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={isDrawer ? "Chat..." : "Guess the word..."}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg transition"
              >
                Send
              </button>
            </form>
            {guessedPlayers.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">Guessed correctly:</p>
                <div className="flex flex-wrap gap-2">
                  {guessedPlayers.map((player, index) => (
                    <span key={index} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                      {player}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
