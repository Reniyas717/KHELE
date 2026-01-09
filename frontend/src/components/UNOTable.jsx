// UNO Table Component - Realistic pool table design
import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { calculateWinProbabilities, getProbabilityColor } from '../utils/WinProbability';

// Avatar mapping
const AVATARS = {
    0: '/avatars/avatar1.png',
    1: '/avatars/avatar2.png',
    2: '/avatars/avatar3.png',
    3: '/avatars/avatar4.png',
    4: '/avatars/avatar1.png',
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
    canPlayCard,
    showProbability = false,
    showToast
}) {
    const { colors, theme } = useTheme();
    const [probabilities, setProbabilities] = useState({});
    const [actionAnimation, setActionAnimation] = useState(null);

    useEffect(() => {
        if (showProbability && gameState) {
            const probs = calculateWinProbabilities(gameState);
            setProbabilities(probs);
        }
    }, [gameState, showProbability]);

    useEffect(() => {
        const currentCard = gameState?.currentCard;
        if (currentCard) {
            const actionCards = ['draw2', 'wild_draw4', 'skip', 'reverse'];
            if (actionCards.includes(currentCard.value)) {
                setActionAnimation(currentCard.value);
                setTimeout(() => setActionAnimation(null), 2000);
            }
        }
    }, [gameState?.currentCard]);

    const players = gameState?.players || [];
    const currentPlayer = gameState?.currentPlayer;
    const currentCard = gameState?.currentCard;

    return (
        <div className="relative w-full h-screen overflow-hidden" style={{
            background: theme === 'dark'
                ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
                : 'linear-gradient(135deg, #f5f3f0 0%, #e8e5e0 50%, #ddd9d3 100%)'
        }}>
            {/* Wooden Table Border/Rail */}
            <div className="absolute inset-0 p-4 md:p-8">
                <div
                    className="relative w-full h-full rounded-3xl shadow-2xl"
                    style={{
                        background: theme === 'dark'
                            ? 'linear-gradient(145deg, #3d2817 0%, #5c3d2e 50%, #3d2817 100%)'
                            : 'linear-gradient(145deg, #8b6f47 0%, #a0826d 50%, #8b6f47 100%)',
                        boxShadow: theme === 'dark'
                            ? 'inset 0 0 60px rgba(0,0,0,0.5), 0 20px 60px rgba(0,0,0,0.6)'
                            : 'inset 0 0 60px rgba(0,0,0,0.3), 0 20px 60px rgba(0,0,0,0.4)',
                        border: theme === 'dark' ? '8px solid #2d1f12' : '8px solid #6b5638'
                    }}
                >
                    {/* Felt Table Surface */}
                    <div
                        className="absolute inset-4 md:inset-6 rounded-2xl shadow-inner overflow-visible"
                        style={{
                            background: theme === 'dark'
                                ? 'radial-gradient(ellipse at center, #1a4d2e 0%, #0d3d2a 50%, #0a2f1f 100%)'
                                : 'radial-gradient(ellipse at center, #2d6a4f 0%, #1b4332 50%, #14372b 100%)',
                            boxShadow: 'inset 0 0 100px rgba(0,0,0,0.6), inset 0 0 50px rgba(0,0,0,0.4)',
                            backgroundImage: `
                repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 2px,
                  rgba(0,0,0,0.03) 2px,
                  rgba(0,0,0,0.03) 4px
                ),
                repeating-linear-gradient(
                  90deg,
                  transparent,
                  transparent 2px,
                  rgba(0,0,0,0.03) 2px,
                  rgba(0,0,0,0.03) 4px
                )
              `
                        }}
                    >
                        {/* Action Card Animation Overlay */}
                        {actionAnimation && (
                            <ActionCardAnimation type={actionAnimation} theme={theme} />
                        )}

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
                                    colors={colors}
                                    theme={theme}
                                />
                            );
                        })}

                        {/* Center table area */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                            <CenterTable
                                currentCard={currentCard}
                                deckSize={gameState?.deckSize || 0}
                                onDrawCard={onDrawCard}
                                isMyTurn={currentPlayer === username}
                                colors={colors}
                                theme={theme}
                                currentColor={gameState?.currentColor}
                            />
                        </div>

                        {/* My hand at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 pb-2 md:pb-4 pt-20 md:pt-24">
                            <MyHand
                                cards={myHand}
                                onPlayCard={onPlayCard}
                                isMyTurn={currentPlayer === username}
                                canPlayCard={canPlayCard}
                                colors={colors}
                                theme={theme}
                                showToast={showToast}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Action Card Animation Component
function ActionCardAnimation({ type, theme }) {
    const animations = {
        draw2: {
            emoji: '➕2️⃣',
            text: '+2 CARDS!',
            color: '#ef4444',
        },
        wild_draw4: {
            emoji: '➕4️⃣',
            text: '+4 CARDS!',
            color: '#8b5cf6',
        },
        skip: {
            emoji: '⊘',
            text: 'SKIPPED!',
            color: '#f59e0b',
        },
        reverse: {
            emoji: '⇄',
            text: 'REVERSED!',
            color: '#10b981',
        },
    };

    const anim = animations[type];
    if (!anim) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none animate-fade-in-out">
            <div
                className="text-center transform animate-bounce-scale"
                style={{ color: anim.color }}
            >
                <div className="text-7xl md:text-9xl mb-4 drop-shadow-2xl animate-spin-slow">
                    {anim.emoji}
                </div>
                <div
                    className="text-3xl md:text-6xl font-black tracking-wider drop-shadow-2xl"
                    style={{
                        textShadow: `0 0 20px ${anim.color}, 0 0 40px ${anim.color}`,
                    }}
                >
                    {anim.text}
                </div>
            </div>
        </div>
    );
}

// Player seat component
function PlayerSeat({ player, position, isMe, isActive, avatar, probability, colors, theme }) {
    const positionStyles = {
        'top': 'top-4 md:top-8 left-1/2 -translate-x-1/2',
        'bottom': 'bottom-20 md:bottom-24 left-1/2 -translate-x-1/2',
        'left': 'left-2 md:left-6 top-1/2 -translate-y-1/2',
        'right': 'right-2 md:right-6 top-1/2 -translate-y-1/2',
        'top-left': 'top-8 md:top-12 left-8 md:left-16',
        'top-right': 'top-8 md:top-12 right-8 md:right-16',
    };

    return (
        <div className={`absolute ${positionStyles[position]} z-10`}>
            <div
                className={`
          relative p-3 md:p-4 rounded-xl backdrop-blur-xl
          transition-all duration-300 hover:scale-105
          ${isActive
                        ? 'ring-4 ring-yellow-400 shadow-2xl animate-pulse-glow'
                        : 'border-2'
                    }
          ${isMe ? 'ring-2 ring-cyan-400' : ''}
        `}
                style={{
                    background: isActive
                        ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.3) 0%, rgba(245, 158, 11, 0.2) 100%)'
                        : theme === 'dark'
                            ? 'rgba(30, 41, 59, 0.9)'
                            : 'rgba(255, 255, 255, 0.9)',
                    borderColor: isActive
                        ? '#fbbf24'
                        : theme === 'dark' ? 'rgba(71, 85, 105, 0.5)' : 'rgba(148, 163, 184, 0.5)',
                    boxShadow: isActive
                        ? '0 0 30px rgba(251, 191, 36, 0.5), 0 10px 30px rgba(0,0,0,0.3)'
                        : '0 4px 20px rgba(0,0,0,0.2)'
                }}
            >
                <div className="flex flex-col items-center gap-2">
                    {/* Avatar */}
                    <div
                        className={`
              w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden 
              border-4 transition-all duration-300
              ${isActive ? 'border-yellow-400 shadow-lg' : 'border-white/50'}
              ${isMe ? 'ring-2 ring-cyan-400' : ''}
            `}
                    >
                        <img src={avatar} alt={player.name} className="w-full h-full object-cover" />
                    </div>

                    {/* Player info */}
                    <div className="text-center">
                        <p className={`font-bold text-xs md:text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {player.name} {isMe && '(You)'}
                        </p>
                        <p className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                            {player.cardCount} cards
                        </p>

                        {probability !== null && (
                            <p className={`text-xs font-bold mt-1 ${getProbabilityColor(probability)}`}>
                                {probability}%
                            </p>
                        )}

                        {player.finished && (
                            <p className="text-xs mt-1 font-bold text-green-500 flex items-center gap-1">
                                🏆 #{player.position}
                            </p>
                        )}
                    </div>

                    {/* Cards fan for opponents */}
                    {!isMe && (
                        <div className="flex -space-x-1 md:-space-x-2 mt-1">
                            {[...Array(Math.min(player.cardCount, 5))].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-6 h-9 md:w-8 md:h-12 rounded border-2 border-white/30 shadow-lg"
                                    style={{
                                        background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                                        transform: `rotate(${(i - 2) * 8}deg) translateY(${Math.abs(i - 2) * 2}px)`,
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
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
function CenterTable({ currentCard, deckSize, onDrawCard, isMyTurn, colors, theme, currentColor }) {
    const getCardColor = (color) => {
        const colorMap = {
            red: '#ef4444',
            blue: '#3b82f6',
            green: '#10b981',
            yellow: '#eab308',
            wild: '#8b5cf6'
        };
        return colorMap[color] || colorMap.wild;
    };

    const getCardDisplay = (card) => {
        if (!card) return '?';
        if (card.value === 'wild') return 'W';
        if (card.value === 'wild_draw4') return '+4';
        if (card.value === 'skip') return '⊘';
        if (card.value === 'reverse') return '⇄';
        if (card.value === 'draw2') return '+2';
        return card.value;
    };

    return (
        <div className="flex items-center gap-6 md:gap-10">
            {/* Draw Pile */}
            <button
                onClick={onDrawCard}
                disabled={!isMyTurn}
                className={`relative group ${isMyTurn ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                title={isMyTurn ? "Draw a card" : "Wait for your turn"}
            >
                <div
                    className={`
            w-20 h-28 md:w-28 md:h-40 rounded-xl
            transition-all duration-300
            ${isMyTurn ? 'group-hover:scale-110 group-hover:-translate-y-2' : ''}
          `}
                    style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        border: isMyTurn ? '4px solid #fbbf24' : '4px solid rgba(255,255,255,0.2)',
                        boxShadow: isMyTurn
                            ? '0 0 30px rgba(251, 191, 36, 0.4), 0 10px 30px rgba(0,0,0,0.5)'
                            : '0 8px 20px rgba(0,0,0,0.4)'
                    }}
                >
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl md:text-5xl mb-2">🎴</span>
                        <div
                            className="px-3 py-1 rounded-full text-xs font-bold"
                            style={{
                                background: 'rgba(0,0,0,0.5)',
                                color: 'white'
                            }}
                        >
                            {deckSize}
                        </div>
                    </div>
                </div>
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-bold text-white/80 whitespace-nowrap">
                    DRAW
                </div>
            </button>

            {/* Discard Pile */}
            <div className="relative">
                <div
                    className="w-20 h-28 md:w-28 md:h-40 rounded-xl overflow-hidden"
                    style={{
                        background: currentCard ? getCardColor(currentColor) : '#1e293b',
                        border: '4px solid rgba(255,255,255,0.3)',
                        boxShadow: currentCard
                            ? `0 0 40px ${getCardColor(currentColor)}60, 0 10px 30px rgba(0,0,0,0.5)`
                            : '0 8px 20px rgba(0,0,0,0.4)'
                    }}
                >
                    {currentCard && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center animate-card-flip">
                            <span className="text-4xl md:text-6xl font-black text-white drop-shadow-2xl">
                                {getCardDisplay(currentCard)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Current color indicator */}
                {currentColor && (
                    <div
                        className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg border-2 border-white/50 capitalize whitespace-nowrap"
                        style={{ background: getCardColor(currentColor) }}
                    >
                        {currentColor}
                    </div>
                )}
            </div>
        </div>
    );
}

// My hand component
function MyHand({ cards, onPlayCard, isMyTurn, canPlayCard, colors, theme, showToast }) {
    const getCardColor = (card) => {
        const colorMap = {
            red: '#ef4444',
            blue: '#3b82f6',
            green: '#10b981',
            yellow: '#eab308',
            wild: '#8b5cf6'
        };
        return colorMap[card?.color] || colorMap.wild;
    };

    const getCardDisplay = (card) => {
        if (!card) return '?';
        if (card.value === 'wild') return 'W';
        if (card.value === 'wild_draw4') return '+4';
        if (card.value === 'skip') return '⊘';
        if (card.value === 'reverse') return '⇄';
        if (card.value === 'draw2') return '+2';
        return card.value;
    };

    const handleCardClick = (card, index) => {
        if (!isMyTurn) {
            showToast?.("It's not your turn! Please wait.", 'warning');
            return;
        }

        const playable = canPlayCard(card);
        if (!playable) {
            showToast?.("You can't play this card! It doesn't match color or value.", 'error');
            return;
        }

        onPlayCard(index);
    };

    return (
        <div className="flex justify-center items-end gap-1 md:gap-2 pb-2 md:pb-4 overflow-x-auto px-2">
            {cards.map((card, index) => {
                const playable = isMyTurn && canPlayCard(card);
                const cardColor = getCardColor(card);

                return (
                    <button
                        key={`${card.id}-${index}`}
                        onClick={() => handleCardClick(card, index)}
                        disabled={!isMyTurn}
                        className={`
              w-14 h-20 md:w-20 md:h-28 rounded-xl
              transform transition-all duration-200 flex-shrink-0
              ${playable
                                ? 'hover:-translate-y-8 hover:scale-110 cursor-pointer animate-glow-pulse'
                                : isMyTurn
                                    ? 'cursor-not-allowed opacity-50 grayscale hover:opacity-70'
                                    : 'opacity-60 cursor-not-allowed'
                            }
            `}
                        style={{
                            background: `linear-gradient(135deg, ${cardColor} 0%, ${cardColor}dd 100%)`,
                            border: playable ? '4px solid #fbbf24' : '3px solid rgba(255,255,255,0.3)',
                            boxShadow: playable
                                ? `0 0 30px ${cardColor}90, 0 0 50px rgba(251, 191, 36, 0.6), 0 10px 30px rgba(0,0,0,0.5)`
                                : `0 4px 15px rgba(0,0,0,0.4)`,
                            transform: `rotate(${(index - cards.length / 2) * 3}deg)`,
                        }}
                        title={
                            !isMyTurn
                                ? 'Wait for your turn'
                                : playable
                                    ? 'Click to play this card'
                                    : 'Cannot play - no match'
                        }
                    >
                        <div className="flex items-center justify-center h-full">
                            <span className="text-2xl md:text-3xl font-black text-white drop-shadow-lg">
                                {getCardDisplay(card)}
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}


