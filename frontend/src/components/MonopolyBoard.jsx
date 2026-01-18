import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';
import {
    FaTrain,
    FaBolt,
    FaTint,
    FaQuestion,
    FaGift,
    FaDollarSign,
    FaParking,
    FaLock,
    FaHome,
    FaHotel
} from 'react-icons/fa';
import { HiArrowRight } from 'react-icons/hi2';
import { IoWarning } from 'react-icons/io5';

// Premium color palette for properties
const PROPERTY_COLORS = {
    brown: { main: '#8B4513', light: '#A0522D', dark: '#5D3A1A', glow: 'rgba(139,69,19,0.4)' },
    lightblue: { main: '#87CEEB', light: '#B0E0E6', dark: '#5FADD6', glow: 'rgba(135,206,235,0.4)' },
    pink: { main: '#FF69B4', light: '#FFB6C1', dark: '#DB7093', glow: 'rgba(255,105,180,0.4)' },
    orange: { main: '#FF8C00', light: '#FFA500', dark: '#CC7000', glow: 'rgba(255,140,0,0.4)' },
    red: { main: '#FF0000', light: '#FF4444', dark: '#CC0000', glow: 'rgba(255,0,0,0.4)' },
    yellow: { main: '#FFD700', light: '#FFEC8B', dark: '#DAA520', glow: 'rgba(255,215,0,0.4)' },
    green: { main: '#00C853', light: '#69F0AE', dark: '#00A844', glow: 'rgba(0,200,83,0.4)' },
    darkblue: { main: '#0066CC', light: '#3399FF', dark: '#004C99', glow: 'rgba(0,102,204,0.4)' }
};

// Player token colors - vibrant and distinct
const TOKEN_COLORS = [
    { bg: '#FF4757', border: '#FF6B7A', shadow: 'rgba(255,71,87,0.5)', name: 'Red' },
    { bg: '#3742FA', border: '#5352ED', shadow: 'rgba(55,66,250,0.5)', name: 'Blue' },
    { bg: '#2ED573', border: '#7BED9F', shadow: 'rgba(46,213,115,0.5)', name: 'Green' },
    { bg: '#FFA502', border: '#FFB938', shadow: 'rgba(255,165,2,0.5)', name: 'Orange' },
    { bg: '#A55EEA', border: '#CD84F1', shadow: 'rgba(165,94,234,0.5)', name: 'Purple' },
    { bg: '#FF6B81', border: '#FF8E9E', shadow: 'rgba(255,107,129,0.5)', name: 'Pink' },
    { bg: '#1E90FF', border: '#54A0FF', shadow: 'rgba(30,144,255,0.5)', name: 'Cyan' },
    { bg: '#FF9F43', border: '#FECA57', shadow: 'rgba(255,159,67,0.5)', name: 'Amber' }
];

export default function MonopolyBoard({ gameState, username, onSpaceClick }) {
    const { theme, colors } = useTheme();
    const [hoveredSpace, setHoveredSpace] = useState(null);

    if (!gameState || !gameState.board) return null;

    const board = gameState.board;
    const currentPlayer = gameState.players.find(p => p.username === username);
    const isDark = theme === 'dark';

    const getPlayersAtPosition = (position) => {
        return gameState.players.filter(p => p.position === position && !p.isBankrupt);
    };

    const getPlayerTokenColor = (playerUsername) => {
        const index = gameState.players.findIndex(p => p.username === playerUsername);
        return TOKEN_COLORS[index % TOKEN_COLORS.length];
    };

    const getSpaceIcon = (space, size = 'md') => {
        const sizeClass = size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3 h-3';
        switch (space.type) {
            case 'railroad':
                return <FaTrain className={`${sizeClass} text-slate-700 dark:text-slate-300`} />;
            case 'utility':
                return space.name.includes('Electric')
                    ? <FaBolt className={`${sizeClass} text-yellow-500`} />
                    : <FaTint className={`${sizeClass} text-blue-500`} />;
            case 'chance':
                return <FaQuestion className={`${sizeClass} text-red-500`} />;
            case 'community_chest':
                return <FaGift className={`${sizeClass} text-blue-600`} />;
            case 'tax':
                return <FaDollarSign className={`${sizeClass} text-green-600`} />;
            default:
                return null;
        }
    };

    const renderPlayerTokens = (playersHere, isCorner = false) => {
        if (playersHere.length === 0) return null;

        const tokenSize = isCorner ? 'w-4 h-4' : 'w-3 h-3';
        const fontSize = isCorner ? 'text-[7px]' : 'text-[6px]';

        return (
            <div className={`absolute ${isCorner ? 'bottom-1 right-1' : 'bottom-0.5 right-0.5'} flex flex-wrap gap-px justify-end max-w-[90%]`}>
                {playersHere.slice(0, 4).map((player, idx) => {
                    const tokenColor = getPlayerTokenColor(player.username);
                    const isActive = player.username === gameState.currentPlayer;

                    return (
                        <motion.div
                            key={player.username}
                            className={`${tokenSize} rounded-full flex items-center justify-center font-bold text-white ${fontSize}`}
                            style={{
                                backgroundColor: tokenColor.bg,
                                boxShadow: isActive
                                    ? `0 0 12px ${tokenColor.shadow}, 0 0 24px ${tokenColor.shadow}`
                                    : `0 2px 8px ${tokenColor.shadow}`,
                                border: `2px solid ${tokenColor.border}`,
                                zIndex: isActive ? 20 : 10 + idx
                            }}
                            animate={isActive ? {
                                scale: [1, 1.2, 1],
                                y: [0, -4, 0]
                            } : {}}
                            transition={{ duration: 0.6, repeat: isActive ? Infinity : 0 }}
                            title={`${player.username}${isActive ? ' (Playing)' : ''}`}
                        >
                            {player.username.charAt(0).toUpperCase()}
                        </motion.div>
                    );
                })}
                {playersHere.length > 4 && (
                    <div className={`${tokenSize} rounded-full bg-slate-600 text-white flex items-center justify-center ${fontSize} font-bold`}>
                        +{playersHere.length - 4}
                    </div>
                )}
            </div>
        );
    };

    const renderHouses = (property, space) => {
        if (!property?.houses || property.houses === 0 || space.type !== 'property') return null;

        if (property.houses === 5) {
            return (
                <motion.div
                    className="absolute top-0.5 right-0.5"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                >
                    <FaHotel className="w-2.5 h-2.5 text-red-600 drop-shadow" />
                </motion.div>
            );
        }

        return (
            <div className="absolute top-0.5 right-0.5 flex gap-px">
                {Array.from({ length: Math.min(property.houses, 4) }).map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ scale: 0, y: -5 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                    >
                        <FaHome className="w-2 h-2 text-green-600 drop-shadow" />
                    </motion.div>
                ))}
            </div>
        );
    };

    const renderOwnerIndicator = (property) => {
        if (!property?.owner) return null;

        const ownerColor = getPlayerTokenColor(property.owner);

        return (
            <motion.div
                className="absolute bottom-0 left-0 right-0 h-1.5 rounded-b"
                style={{ backgroundColor: ownerColor.bg }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                title={`Owned by ${property.owner}`}
            />
        );
    };

    const renderSpace = (space) => {
        const property = gameState.properties[space.id];
        const playersHere = getPlayersAtPosition(space.id);
        const isCorner = [0, 10, 20, 30].includes(space.id);
        const isMyProperty = property?.owner === username;
        const propertyColor = space.color ? PROPERTY_COLORS[space.color] : null;
        const isCurrentPosition = currentPlayer?.position === space.id;
        const isMortgaged = property?.mortgaged;
        const isHovered = hoveredSpace === space.id;

        // Determine edge position for proper orientation
        const isBottom = space.id >= 0 && space.id <= 10;
        const isLeft = space.id >= 11 && space.id <= 19;
        const isTop = space.id >= 20 && space.id <= 30;
        const isRight = space.id >= 31 && space.id <= 39;

        const baseClasses = `relative cursor-pointer overflow-hidden transition-all duration-200 ${
            isDark ? 'bg-slate-800' : 'bg-white'
        }`;

        if (isCorner) {
            return (
                <motion.div
                    key={space.id}
                    className={`${baseClasses} rounded-lg ${
                        isCurrentPosition
                            ? 'ring-3 ring-yellow-400 shadow-xl shadow-yellow-400/30 z-20'
                            : 'hover:shadow-lg'
                    }`}
                    style={{ gridArea: getGridArea(space.id) }}
                    onClick={() => onSpaceClick(space)}
                    onMouseEnter={() => setHoveredSpace(space.id)}
                    onMouseLeave={() => setHoveredSpace(null)}
                    whileHover={{ scale: 1.02, zIndex: 15 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <div className={`h-full flex flex-col items-center justify-center p-1 ${
                        isDark ? 'bg-gradient-to-br from-slate-700 to-slate-800' : 'bg-gradient-to-br from-gray-50 to-white'
                    }`}>
                        {space.id === 0 && (
                            <>
                                <motion.div
                                    animate={{ rotate: -45, x: [0, 5, 0] }}
                                    transition={{ x: { duration: 1, repeat: Infinity } }}
                                >
                                    <HiArrowRight className="w-6 h-6 text-green-500" />
                                </motion.div>
                                <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>GO</span>
                                <span className="text-[8px] font-bold text-green-500">Collect $200</span>
                            </>
                        )}
                        {space.id === 10 && (
                            <>
                                <FaLock className="w-5 h-5 text-orange-500" />
                                <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>JAIL</span>
                                <span className={`text-[7px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Just Visiting</span>
                            </>
                        )}
                        {space.id === 20 && (
                            <>
                                <FaParking className="w-5 h-5 text-blue-500" />
                                <span className={`text-[8px] font-black ${isDark ? 'text-white' : 'text-slate-800'} text-center leading-tight`}>FREE<br/>PARKING</span>
                            </>
                        )}
                        {space.id === 30 && (
                            <>
                                <IoWarning className="w-5 h-5 text-red-500" />
                                <span className={`text-[8px] font-black ${isDark ? 'text-white' : 'text-slate-800'} text-center leading-tight`}>GO TO<br/>JAIL</span>
                            </>
                        )}
                    </div>
                    {renderPlayerTokens(playersHere, true)}
                </motion.div>
            );
        }

        // Regular space
        return (
            <motion.div
                key={space.id}
                className={`${baseClasses} rounded-md ${
                    isCurrentPosition
                        ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/30 z-20'
                        : isMyProperty
                            ? 'ring-2 ring-green-400/50'
                            : 'hover:shadow-md'
                } ${isMortgaged ? 'opacity-60' : ''}`}
                style={{ gridArea: getGridArea(space.id) }}
                onClick={() => onSpaceClick(space)}
                onMouseEnter={() => setHoveredSpace(space.id)}
                onMouseLeave={() => setHoveredSpace(null)}
                whileHover={{ scale: 1.03, zIndex: 15 }}
                whileTap={{ scale: 0.98 }}
            >
                {/* Property color bar */}
                {propertyColor && (
                    <div
                        className={`absolute ${
                            isBottom ? 'top-0 left-0 right-0 h-3' :
                            isTop ? 'bottom-0 left-0 right-0 h-3' :
                            isLeft ? 'right-0 top-0 bottom-0 w-3' :
                            'left-0 top-0 bottom-0 w-3'
                        }`}
                        style={{
                            background: `linear-gradient(${isLeft || isRight ? '180deg' : '90deg'}, ${propertyColor.light} 0%, ${propertyColor.main} 50%, ${propertyColor.dark} 100%)`,
                            boxShadow: isHovered ? `0 0 8px ${propertyColor.glow}` : 'none'
                        }}
                    />
                )}

                {/* Content */}
                <div className={`h-full flex flex-col items-center justify-center p-0.5 ${
                    propertyColor ? (isBottom ? 'pt-4' : isTop ? 'pb-4' : isLeft ? 'pr-4' : 'pl-4') : ''
                }`}>
                    {/* Icon */}
                    {getSpaceIcon(space) && (
                        <div className="mb-0.5">
                            {getSpaceIcon(space, 'sm')}
                        </div>
                    )}

                    {/* Name */}
                    <p className={`text-[6px] md:text-[7px] font-medium text-center leading-[1.1] px-0.5 truncate w-full ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                    }`}>
                        {space.name.length > 10 ? space.name.substring(0, 8) + '..' : space.name}
                    </p>

                    {/* Price */}
                    {space.price && (
                        <p className={`text-[6px] md:text-[7px] font-bold mt-auto ${
                            isDark ? 'text-green-400' : 'text-green-600'
                        }`}>
                            ${space.price}
                        </p>
                    )}
                </div>

                {/* Houses/Hotel */}
                {renderHouses(property, space)}

                {/* Owner indicator */}
                {renderOwnerIndicator(property)}

                {/* Player tokens */}
                {renderPlayerTokens(playersHere)}

                {/* Mortgaged overlay */}
                {isMortgaged && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white bg-red-600 px-1.5 py-0.5 rounded">MORTGAGED</span>
                    </div>
                )}
            </motion.div>
        );
    };

    return (
        <div className={`w-full h-full flex items-center justify-center p-1 sm:p-2 md:p-4 ${colors.bg}`}>
            {/* Board Container - Responsive */}
            <div
                className="relative w-full h-full max-w-[95vmin] max-h-[95vmin] sm:max-w-[90vmin] sm:max-h-[90vmin] md:max-w-[85vmin] md:max-h-[85vmin] lg:max-w-[800px] lg:max-h-[800px]"
                style={{ aspectRatio: '1/1' }}
            >
                {/* Wooden Frame */}
                <div
                    className="absolute inset-0 rounded-lg sm:rounded-xl md:rounded-2xl p-1 sm:p-2 md:p-3"
                    style={{
                        background: isDark
                            ? 'linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)'
                            : 'linear-gradient(145deg, #4a3728 0%, #5d4037 50%, #3e2723 100%)',
                        boxShadow: isDark
                            ? '0 10px 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)'
                            : '0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
                    }}
                >
                    {/* Gold Border */}
                    <div
                        className="h-full rounded-md sm:rounded-lg md:rounded-xl p-0.5 sm:p-1 md:p-1.5"
                        style={{
                            background: isDark
                                ? 'linear-gradient(145deg, #00d9ff 0%, #0891b2 50%, #00d9ff 100%)'
                                : 'linear-gradient(145deg, #ffd700 0%, #daa520 50%, #b8860b 100%)',
                            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)'
                        }}
                    >
                        {/* Inner Board - Classic Monopoly Green */}
                        <div
                            className="h-full rounded-sm sm:rounded-md md:rounded-lg overflow-hidden p-0.5 sm:p-1"
                            style={{
                                background: isDark
                                    ? 'linear-gradient(145deg, #1e3a5f 0%, #0d2137 100%)'
                                    : 'linear-gradient(145deg, #c8e6c9 0%, #a5d6a7 100%)'
                            }}
                        >
                            {/* Grid */}
                            <div
                                className="grid h-full gap-px sm:gap-0.5 md:gap-1"
                                style={{
                                    gridTemplateColumns: 'repeat(11, 1fr)',
                                    gridTemplateRows: 'repeat(11, 1fr)'
                                }}
                            >
                                {board.map(space => renderSpace(space))}

                                {/* Center Area */}
                                <div
                                    className="flex flex-col items-center justify-center p-1 sm:p-2 md:p-4"
                                    style={{
                                        gridColumn: '2 / 11',
                                        gridRow: '2 / 11'
                                    }}
                                >
                                    {/* Logo */}
                                    <motion.div
                                        className="text-center mb-4"
                                        animate={{ scale: [1, 1.02, 1] }}
                                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                    >
                                        <h3
                                            className={`text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-wider mb-1 sm:mb-2 ${
                                                isDark ? 'text-cyan-400' : 'text-red-600'
                                            }`}
                                            style={{
                                                fontFamily: '"Playfair Display", serif',
                                                textShadow: isDark
                                                    ? '0 0 20px rgba(0,217,255,0.5)'
                                                    : '2px 2px 4px rgba(0,0,0,0.3)'
                                            }}
                                        >
                                            KHELE
                                        </h3>
                                        <div
                                            className={`px-3 sm:px-4 md:px-6 py-1 sm:py-1.5 md:py-2 rounded-lg sm:rounded-xl shadow-lg sm:shadow-xl ${
                                                isDark
                                                    ? 'bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-600'
                                                    : 'bg-gradient-to-r from-red-600 via-red-500 to-red-600'
                                            }`}
                                        >
                                            <h2
                                                className="text-sm sm:text-base md:text-xl lg:text-2xl font-black text-white tracking-wider sm:tracking-widest"
                                                style={{
                                                    fontFamily: '"Playfair Display", serif',
                                                    textShadow: '1px 1px 2px rgba(0,0,0,0.4)'
                                                }}
                                            >
                                                MONOPOLY
                                            </h2>
                                        </div>
                                    </motion.div>

                                    {/* Current Turn Card */}
                                    <motion.div
                                        className={`px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-3 rounded-lg sm:rounded-xl shadow-md sm:shadow-lg mb-2 sm:mb-3 ${
                                            isDark ? 'bg-slate-800/90 border border-cyan-500/30' : 'bg-white/95 border border-slate-200'
                                        }`}
                                        animate={{
                                            boxShadow: isDark
                                                ? ['0 0 15px rgba(0,217,255,0.2)', '0 0 25px rgba(0,217,255,0.4)', '0 0 15px rgba(0,217,255,0.2)']
                                                : ['0 2px 10px rgba(0,0,0,0.1)', '0 4px 20px rgba(0,0,0,0.2)', '0 2px 10px rgba(0,0,0,0.1)']
                                        }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    >
                                        <p className={`text-[8px] sm:text-[10px] md:text-xs font-medium uppercase tracking-wide text-center mb-0.5 ${
                                            isDark ? 'text-slate-400' : 'text-slate-500'
                                        }`}>
                                            Current Turn
                                        </p>
                                        <motion.p
                                            className={`text-xs sm:text-sm md:text-lg lg:text-xl font-bold text-center ${
                                                isDark ? 'text-cyan-400' : 'text-red-600'
                                            }`}
                                            animate={{ scale: [1, 1.03, 1] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                        >
                                            {gameState.currentPlayer}
                                        </motion.p>
                                    </motion.div>

                                    {/* Last Roll Display */}
                                    {gameState.lastRoll?.total > 0 && (
                                        <motion.div
                                            className={`px-5 py-2 rounded-lg ${
                                                isDark ? 'bg-slate-700/80' : 'bg-white/90'
                                            } shadow-md mb-4`}
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                        >
                                            <div className={`flex items-center gap-2 text-base font-semibold ${
                                                isDark ? 'text-white' : 'text-slate-700'
                                            }`}>
                                                <span>🎲</span>
                                                <span className="text-lg">{gameState.lastRoll.dice1}</span>
                                                <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>+</span>
                                                <span className="text-lg">{gameState.lastRoll.dice2}</span>
                                                <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>=</span>
                                                <span className={`text-xl font-black ${isDark ? 'text-cyan-400' : 'text-green-600'}`}>
                                                    {gameState.lastRoll.total}
                                                </span>
                                                {gameState.lastRoll.isDoubles && (
                                                    <motion.span
                                                        className="ml-2 px-2 py-0.5 bg-yellow-500 text-yellow-900 rounded text-xs font-bold"
                                                        animate={{ scale: [1, 1.1, 1] }}
                                                        transition={{ duration: 0.5, repeat: Infinity }}
                                                    >
                                                        DOUBLES!
                                                    </motion.span>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Player Legend */}
                                    <div className={`p-3 rounded-xl ${
                                        isDark ? 'bg-slate-800/60' : 'bg-white/80'
                                    } shadow-md max-w-[350px]`}>
                                        <p className={`text-xs font-semibold mb-2 text-center ${
                                            isDark ? 'text-slate-400' : 'text-slate-500'
                                        }`}>
                                            PLAYERS
                                        </p>
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            {gameState.players.filter(p => !p.isBankrupt).map((player, idx) => {
                                                const tokenColor = TOKEN_COLORS[idx % TOKEN_COLORS.length];
                                                const propCount = (player.properties?.length || 0) +
                                                    (player.railroads?.length || 0) +
                                                    (player.utilities?.length || 0);
                                                const isCurrentTurn = player.username === gameState.currentPlayer;

                                                return (
                                                    <motion.div
                                                        key={player.username}
                                                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${
                                                            isDark ? 'bg-slate-700/80' : 'bg-slate-100'
                                                        } ${isCurrentTurn ? 'ring-2 ring-yellow-400' : ''}`}
                                                        animate={isCurrentTurn ? { scale: [1, 1.02, 1] } : {}}
                                                        transition={{ duration: 1, repeat: Infinity }}
                                                    >
                                                        <div
                                                            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                                                            style={{ backgroundColor: tokenColor.bg }}
                                                        >
                                                            {player.username.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="text-left">
                                                            <p className={`text-[10px] font-semibold truncate max-w-[60px] ${
                                                                isDark ? 'text-white' : 'text-slate-700'
                                                            }`}>
                                                                {player.username}
                                                            </p>
                                                            <p className={`text-[9px] ${
                                                                isDark ? 'text-green-400' : 'text-green-600'
                                                            }`}>
                                                                ${player.money?.toLocaleString()} • {propCount}🏠
                                                            </p>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getGridArea(spaceId) {
    // Bottom row (GO to Jail): spaces 0-10
    if (spaceId >= 0 && spaceId <= 10) {
        const col = 11 - spaceId;
        return `11 / ${col} / 12 / ${col + 1}`;
    }
    // Left column: spaces 11-19
    if (spaceId >= 11 && spaceId <= 19) {
        const row = 11 - (spaceId - 10);
        return `${row} / 1 / ${row + 1} / 2`;
    }
    // Top row: spaces 20-30
    if (spaceId >= 20 && spaceId <= 30) {
        const col = spaceId - 19;
        return `1 / ${col} / 2 / ${col + 1}`;
    }
    // Right column: spaces 31-39
    if (spaceId >= 31 && spaceId <= 39) {
        const row = spaceId - 29;
        return `${row} / 11 / ${row + 1} / 12`;
    }
    return '1 / 1 / 2 / 2';
}
