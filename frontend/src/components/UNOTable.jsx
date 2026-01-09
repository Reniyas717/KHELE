// UNO Table Component - Professional table-style layout
import { useState, useEffect } from 'react';
import { calculateWinProbabilities, getProbabilityColor } from '../utils/WinProbability';

// Avatar mapping
const AVATARS = {
    0: '/avatars/avatar1.png',
    1: '/avatars/avatar2.png',
    2: '/avatars/avatar3.png',
    3: '/avatars/avatar4.png',
    4: '/avatars/avatar1.png', // Cycle if more than 4 players
};

// Get player position around table
function getPlayerPosition(index, totalPlayers, isCurrentUser) {
    if (isCurrentUser) return 'bottom';

    if (totalPlayers === 2) {
        return 'top';
    } else if (totalPlayers === 3) {
        return index === 1 ? 'left' : 'top';
    } else if (totalPlayers === 4) {
        const positions = ['top', 'left', 'right'];
        return positions[index - 1];
    } else {
        // 5+ players - distribute around table
        const positions = ['top-left', 'top', 'top-right', 'right', 'left'];
        return positions[index - 1] || 'top';
    }
}

export default function UNOTable({
    gameState,
    myHand,
    username,
    onPlayCard,
    onDrawCard,
    showProbability = false
}) {
    const [probabilities, setProbabilities] = useState({});

    // Calculate probabilities when game state changes
    useEffect(() => {
        if (showProbability && gameState) {
            const probs = calculateWinProbabilities(gameState);
            setProbabilities(probs);
        }
    }, [gameState, showProbability]);

    const players = gameState?.players || [];
    const currentPlayer = gameState?.currentPlayer;
    const currentCard = gameState?.currentCard;

    // Find current user index
    const myIndex = players.findIndex(p => p.name === username);

    return (
        <div className="relative w-full h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900">
            {/* Table felt texture overlay */}
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.3)_100%)]" />

            {/* Players around table */}
            {players.map((player, index) => {
                const isMe = player.name === username;
                const position = getPlayerPosition(index, players.length, isMe);
                const isActive = player.name === currentPlayer;
                const probability = probabilities[player.name] || 0;

                return (
                    <PlayerSeat
                        key={player.name}
                        player={player}
                        position={position}
                        isMe={isMe}
                        isActive={isActive}
                        avatar={AVATARS[index % 5]}
                        probability={showProbability ? probability : null}
                    />
                );
            })}

            {/* Center table area */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <CenterTable
                    currentCard={currentCard}
                    deckSize={gameState?.deckSize || 0}
                    onDrawCard={onDrawCard}
                />
            </div>

            {/* My hand at bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
                <MyHand
                    cards={myHand}
                    onPlayCard={onPlayCard}
                    isMyTurn={currentPlayer === username}
                />
            </div>
        </div>
    );
}

// Player seat component
function PlayerSeat({ player, position, isMe, isActive, avatar, probability }) {
    const positionStyles = {
        'top': 'top-4 left-1/2 -translate-x-1/2',
        'bottom': 'bottom-24 left-1/2 -translate-x-1/2',
        'left': 'left-4 top-1/2 -translate-y-1/2',
        'right': 'right-4 top-1/2 -translate-y-1/2',
        'top-left': 'top-12 left-12',
        'top-right': 'top-12 right-12',
    };

    return (
        <div className={`absolute ${positionStyles[position]} z-10`}>
            <div className={`
        relative p-4 rounded-2xl backdrop-blur-md
        ${isActive ? 'bg-yellow-500/30 ring-4 ring-yellow-400 shadow-2xl shadow-yellow-500/50' : 'bg-black/20'}
        ${isMe ? 'ring-2 ring-blue-400' : ''}
        transition-all duration-300
      `}>
                {/* Avatar */}
                <div className="flex flex-col items-center gap-2">
                    <div className={`
            w-16 h-16 rounded-full overflow-hidden border-4
            ${isActive ? 'border-yellow-400' : 'border-white/50'}
            ${isMe ? 'ring-2 ring-blue-400' : ''}
          `}>
                        <img src={avatar} alt={player.name} className="w-full h-full object-cover" />
                    </div>

                    {/* Player info */}
                    <div className="text-center">
                        <p className="font-bold text-white text-sm">
                            {player.name} {isMe && '(You)'}
                        </p>
                        <p className="text-xs text-white/70">
                            {player.cardCount} cards
                        </p>

                        {/* Win probability */}
                        {probability !== null && (
                            <p className={`text-xs font-bold ${getProbabilityColor(probability)}`}>
                                {probability}% win chance
                            </p>
                        )}
                    </div>

                    {/* Cards (fan layout for opponents) */}
                    {!isMe && (
                        <div className="flex -space-x-2">
                            {[...Array(Math.min(player.cardCount, 5))].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-8 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded border-2 border-white/50 shadow-lg"
                                    style={{
                                        transform: `rotate(${(i - 2) * 5}deg) translateY(${Math.abs(i - 2) * 2}px)`
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Center table with deck and discard pile
function CenterTable({ currentCard, deckSize, onDrawCard }) {
    return (
        <div className="flex items-center gap-8">
            {/* Deck */}
            <button
                onClick={onDrawCard}
                className="relative group"
            >
                <div className="w-24 h-36 bg-gradient-to-br from-red-600 to-red-800 rounded-lg border-4 border-white/50 shadow-2xl transform transition-transform group-hover:scale-110 group-hover:-translate-y-2">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl">🎴</span>
                    </div>
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/70 px-2 py-1 rounded text-white text-xs whitespace-nowrap">
                        {deckSize} cards
                    </div>
                </div>
            </button>

            {/* Discard pile */}
            <div className="relative">
                <div className="w-24 h-36 bg-white rounded-lg border-4 border-gray-800 shadow-2xl">
                    {currentCard && (
                        <div className={`
              absolute inset-0 flex flex-col items-center justify-center
              ${currentCard.color === 'red' ? 'bg-red-500' : ''}
              ${currentCard.color === 'blue' ? 'bg-blue-500' : ''}
              ${currentCard.color === 'green' ? 'bg-green-500' : ''}
              ${currentCard.color === 'yellow' ? 'bg-yellow-500' : ''}
              ${currentCard.color === 'wild' ? 'bg-gradient-to-br from-red-500 via-blue-500 to-green-500' : ''}
              rounded-lg
            `}>
                            <span className="text-4xl font-black text-white drop-shadow-lg">
                                {currentCard.value}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// My hand component
function MyHand({ cards, onPlayCard, isMyTurn }) {
    return (
        <div className="flex justify-center items-end gap-2 pb-4">
            {cards.map((card, index) => (
                <button
                    key={`${card.id}-${index}`}
                    onClick={() => onPlayCard(index)}
                    disabled={!isMyTurn}
                    className={`
            w-16 h-24 rounded-lg border-2 shadow-lg transform transition-all
            ${isMyTurn ? 'hover:-translate-y-4 hover:scale-110 cursor-pointer' : 'opacity-50 cursor-not-allowed'}
            ${card.color === 'red' ? 'bg-red-500 border-red-700' : ''}
            ${card.color === 'blue' ? 'bg-blue-500 border-blue-700' : ''}
            ${card.color === 'green' ? 'bg-green-500 border-green-700' : ''}
            ${card.color === 'yellow' ? 'bg-yellow-500 border-yellow-700' : ''}
            ${card.color === 'wild' ? 'bg-gradient-to-br from-purple-600 to-pink-600 border-purple-800' : ''}
          `}
                    style={{
                        transform: `rotate(${(index - cards.length / 2) * 3}deg)`
                    }}
                >
                    <div className="flex items-center justify-center h-full">
                        <span className="text-2xl font-black text-white drop-shadow-lg">
                            {card.value}
                        </span>
                    </div>
                </button>
            ))}
        </div>
    );
}
