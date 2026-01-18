import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import ToastContainer from './ui/ToastContainer';
import MonopolyBoard from './MonopolyBoard';
import MonopolyDice from './MonopolyDice';
import MonopolyPropertyCard from './MonopolyPropertyCard';
import PixelSnow from './ui/PixelSnow';
import { IoArrowBack, IoSunnyOutline, IoMoonOutline } from 'react-icons/io5';
import { FaHome, FaTrain, FaBolt, FaLock, FaCrown, FaDice, FaHandHoldingUsd, FaKey } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';

// Player colors matching the board tokens
const PLAYER_COLORS = [
    { bg: '#FF4757', light: '#FFE4E7', border: '#FF6B7A', shadow: 'rgba(255,71,87,0.3)', name: 'Red' },
    { bg: '#3742FA', light: '#E4E6FF', border: '#5352ED', shadow: 'rgba(55,66,250,0.3)', name: 'Blue' },
    { bg: '#2ED573', light: '#E0FCEC', border: '#7BED9F', shadow: 'rgba(46,213,115,0.3)', name: 'Green' },
    { bg: '#FFA502', light: '#FFF4E0', border: '#FFB938', shadow: 'rgba(255,165,2,0.3)', name: 'Orange' },
    { bg: '#A55EEA', light: '#F3E8FF', border: '#CD84F1', shadow: 'rgba(165,94,234,0.3)', name: 'Purple' },
    { bg: '#FF6B81', light: '#FFE8EC', border: '#FF8E9E', shadow: 'rgba(255,107,129,0.3)', name: 'Pink' },
    { bg: '#1E90FF', light: '#E4F1FF', border: '#54A0FF', shadow: 'rgba(30,144,255,0.3)', name: 'Cyan' },
    { bg: '#FF9F43', light: '#FFF2E5', border: '#FECA57', shadow: 'rgba(255,159,67,0.3)', name: 'Amber' }
];

export default function MonopolyGame({ roomCode, username, players, initialGameState, onLeaveRoom }) {
    const { colors, theme, toggleTheme } = useTheme();
    const [gameState, setGameState] = useState(initialGameState || null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [showGameOver, setShowGameOver] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [isRolling, setIsRolling] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [showSnow, setShowSnow] = useState(true);
    const { sendMessage, on, isConnected } = useWebSocket();
    const listenersSetup = useRef(false);
    const toastIdCounter = useRef(0);

    const isDark = theme === 'dark';
    const myPlayer = gameState?.players?.find(p => p.username === username);
    const isMyTurn = gameState?.currentPlayer === username && !myPlayer?.isBankrupt;
    const canRoll = isMyTurn && gameState?.turnPhase === 'roll' && !isRolling;

    useEffect(() => {
        if (initialGameState) {
            setGameState(initialGameState);
            setIsLoading(false);
        }
    }, [initialGameState]);

    useEffect(() => {
        if (!isConnected || listenersSetup.current) return;
        listenersSetup.current = true;

        const unsubDiceRolled = on('MONOPOLY_DICE_ROLLED', (data) => {
            const newGameState = data.payload?.gameState;
            const roll = data.payload?.roll;
            if (newGameState) {
                setGameState(newGameState);
                setIsRolling(false);
                showToast(
                    `🎲 ${roll.dice1} + ${roll.dice2} = ${roll.total}${roll.isDoubles ? ' 🎯 DOUBLES!' : ''}`, 
                    roll.isDoubles ? 'success' : 'info'
                );
            }
        });

        const unsubPropertyBought = on('MONOPOLY_PROPERTY_BOUGHT', (data) => {
            if (data.payload?.gameState) {
                setGameState(data.payload.gameState);
                showToast('🏠 Property Purchased!', 'success');
            }
        });

        const unsubHouseBuilt = on('MONOPOLY_HOUSE_BUILT', (data) => {
            if (data.payload?.gameState) {
                setGameState(data.payload.gameState);
                showToast('🏗️ House Built!', 'success');
            }
        });

        const unsubPropertyMortgaged = on('MONOPOLY_PROPERTY_MORTGAGED', (data) => {
            if (data.payload?.gameState) {
                setGameState(data.payload.gameState);
                showToast('💵 Property Mortgaged', 'info');
            }
        });

        const unsubTurnEnded = on('MONOPOLY_TURN_ENDED', (data) => {
            if (data.payload?.gameState) {
                setGameState(data.payload.gameState);
                if (!data.payload?.rollAgain) {
                    showToast(`➡️ ${data.payload.gameState.currentPlayer}'s turn`, 'info');
                }
            }
        });

        const unsubJailCardUsed = on('MONOPOLY_JAIL_CARD_USED', (data) => {
            if (data.payload?.gameState) {
                setGameState(data.payload.gameState);
                showToast('🎫 Get Out of Jail Card Used!', 'success');
            }
        });

        const unsubJailFeePaid = on('MONOPOLY_JAIL_FEE_PAID', (data) => {
            if (data.payload?.gameState) {
                setGameState(data.payload.gameState);
                showToast('💵 Paid $50 to get out of Jail', 'info');
            }
        });

        const unsubError = on('ERROR', (data) => {
            showToast(`❌ ${data.payload?.message || data.message}`, 'error');
            setIsRolling(false);
        });

        return () => {
            unsubDiceRolled?.();
            unsubPropertyBought?.();
            unsubHouseBuilt?.();
            unsubPropertyMortgaged?.();
            unsubTurnEnded?.();
            unsubJailCardUsed?.();
            unsubJailFeePaid?.();
            unsubError?.();
            listenersSetup.current = false;
        };
    }, [isConnected, on]);

    useEffect(() => {
        if (gameState?.gameOver && !showGameOver) {
            setShowGameOver(true);
        }
    }, [gameState?.gameOver, showGameOver]);

    const showToast = (message, type = 'info', duration = 2500) => {
        const id = toastIdCounter.current++;
        setToasts(prev => [...prev, { id, message, type, duration }]);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    const handleRollDice = () => {
        if (!canRoll) {
            showToast('Not your turn!', 'warning');
            return;
        }
        if (!isConnected) {
            showToast('❌ Connection lost! Reconnecting...', 'error');
            return;
        }
        setIsRolling(true);
        sendMessage('MONOPOLY_ROLL_DICE', { roomCode, username });
    };

    const handleBuyProperty = (spaceId) => {
        if (!isConnected) {
            showToast('❌ Connection lost!', 'error');
            return;
        }
        sendMessage('MONOPOLY_BUY_PROPERTY', { roomCode, username, spaceId });
        setSelectedProperty(null);
    };

    const handleBuildHouse = (spaceId) => {
        sendMessage('MONOPOLY_BUILD_HOUSE', { roomCode, username, spaceId });
        setSelectedProperty(null);
    };

    const handleMortgageProperty = (spaceId) => {
        sendMessage('MONOPOLY_MORTGAGE_PROPERTY', { roomCode, username, spaceId });
        setSelectedProperty(null);
    };

    const handleEndTurn = () => {
        if (!isMyTurn) {
            showToast('Not your turn!', 'warning');
            return;
        }
        if (!isConnected) {
            showToast('❌ Connection lost! Reconnecting...', 'error');
            return;
        }
        sendMessage('MONOPOLY_END_TURN', { roomCode, username });
    };

    const handleUseJailCard = () => {
        sendMessage('MONOPOLY_USE_JAIL_CARD', { roomCode, username });
    };

    const handlePayJailFee = () => {
        sendMessage('MONOPOLY_PAY_JAIL_FEE', { roomCode, username });
    };

    // Loading screen
    if (isLoading || !gameState) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${colors.bg}`}>
                {showSnow && (
                    <PixelSnow 
                        snowColor={isDark ? '#00d9ff' : '#dc2626'} 
                        count={30}
                        speed={1}
                    />
                )}
                <motion.div 
                    className="text-center z-10"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <motion.div
                        className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center ${
                            isDark ? 'bg-cyan-500/20' : 'bg-red-500/20'
                        }`}
                        animate={{ 
                            rotate: [0, 10, -10, 0],
                            scale: [1, 1.1, 1]
                        }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    >
                        <FaDice className={`w-10 h-10 ${isDark ? 'text-cyan-400' : 'text-red-500'}`} />
                    </motion.div>
                    <h2 className={`text-3xl font-black mb-2 ${colors.text}`}>
                        Loading Game...
                    </h2>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Preparing the board
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${colors.bg} transition-colors duration-300 overflow-hidden relative`}>
            {/* Ambient PixelSnow effect - Can be toggled */}
            <AnimatePresence>
                {showSnow && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="pointer-events-none"
                    >
                        <PixelSnow 
                            snowColor={isDark ? '#00d9ff' : '#dc2626'} 
                            count={20}
                            speed={0.5}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
            
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Premium Header */}
            <header className={`h-14 md:h-16 flex items-center justify-between px-4 md:px-6 border-b shadow-lg relative z-30 ${
                isDark 
                    ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-cyan-500/20' 
                    : 'bg-gradient-to-r from-white via-gray-50 to-white border-slate-200'
            }`}>
                {/* Back Button */}
                <motion.button
                    onClick={onLeaveRoom}
                    className={`p-2.5 rounded-xl transition-all shadow-lg ${
                        isDark 
                            ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <IoArrowBack className="w-5 h-5" />
                </motion.button>

                {/* Title */}
                <div className="text-center">
                    <h1 className="text-lg md:text-xl font-black tracking-wide flex items-center gap-2 justify-center">
                        <span className={isDark ? 'text-cyan-400' : 'text-red-600'}>KHELE</span>
                        <span className={colors.text}>MONOPOLY</span>
                        <HiSparkles className={`w-5 h-5 ${isDark ? 'text-cyan-400' : 'text-amber-500'}`} />
                    </h1>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Room: <span className="font-semibold">{roomCode}</span>
                    </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                    {/* Snow Toggle */}
                    <motion.button
                        onClick={() => setShowSnow(!showSnow)}
                        className={`p-2.5 rounded-xl transition-all shadow-lg ${
                            isDark 
                                ? 'bg-slate-700 hover:bg-slate-600' 
                                : 'bg-slate-100 hover:bg-slate-200'
                        } ${showSnow ? (isDark ? 'text-cyan-400' : 'text-blue-600') : 'text-slate-400'}`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title={showSnow ? 'Hide Effects' : 'Show Effects'}
                    >
                        <HiSparkles className="w-5 h-5" />
                    </motion.button>

                    {/* Theme Toggle */}
                    <motion.button
                        onClick={toggleTheme}
                        className={`p-2.5 rounded-xl transition-all shadow-lg ${
                            isDark 
                                ? 'bg-slate-700 hover:bg-slate-600 text-amber-400' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                        whileHover={{ scale: 1.05, rotate: 15 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        {isDark ? <IoSunnyOutline className="w-5 h-5" /> : <IoMoonOutline className="w-5 h-5" />}
                    </motion.button>
                </div>
            </header>

            {/* Main Game Area */}
            <main className="h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] flex flex-col lg:flex-row gap-2 p-2 sm:p-3 md:p-4 relative z-10 overflow-hidden">
                
                {/* Left Sidebar - Player Stats (Hidden on mobile, horizontal scroll on tablet) */}
                <aside className={`hidden sm:flex lg:w-48 xl:w-56 lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden pb-2 lg:pb-0 scrollbar-thin flex-shrink-0 ${
                    isDark ? 'scrollbar-track-slate-800 scrollbar-thumb-slate-600' : 'scrollbar-track-slate-100 scrollbar-thumb-slate-300'
                }`}>
                    <h3 className={`hidden lg:block text-sm font-bold uppercase tracking-wider mb-1 px-1 ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                        Players
                    </h3>
                    
                    {gameState.players.map((player, index) => {
                        const isCurrentPlayer = player.username === gameState.currentPlayer;
                        const isMe = player.username === username;
                        const playerColor = PLAYER_COLORS[index % PLAYER_COLORS.length];
                        const totalProps = (player.properties?.length || 0) + 
                                          (player.railroads?.length || 0) + 
                                          (player.utilities?.length || 0);

                        return (
                            <motion.div
                                key={player.username}
                                className={`flex-shrink-0 lg:w-full w-36 sm:w-44 rounded-xl overflow-hidden transition-all ${
                                    player.isBankrupt ? 'opacity-50 grayscale' : ''
                                } ${isCurrentPlayer ? 'ring-2 ring-offset-2' : ''}`}
                                style={{
                                    background: isDark 
                                        ? `linear-gradient(135deg, ${playerColor.bg}15 0%, ${playerColor.bg}05 100%)`
                                        : `linear-gradient(135deg, ${playerColor.light} 0%, white 100%)`,
                                    borderLeft: `4px solid ${playerColor.bg}`,
                                    ringColor: playerColor.bg,
                                    ringOffsetColor: isDark ? '#0f172a' : '#ffffff',
                                    boxShadow: isCurrentPlayer ? `0 4px 20px ${playerColor.shadow}` : undefined
                                }}
                                animate={isCurrentPlayer && !player.isBankrupt ? {
                                    boxShadow: [
                                        `0 4px 20px ${playerColor.shadow}`,
                                        `0 8px 30px ${playerColor.shadow}`,
                                        `0 4px 20px ${playerColor.shadow}`
                                    ]
                                } : {}}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <div className="p-3">
                                    {/* Player Header */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <div 
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg"
                                            style={{ 
                                                backgroundColor: playerColor.bg,
                                                boxShadow: `0 2px 10px ${playerColor.shadow}`
                                            }}
                                        >
                                            {player.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                                {player.username}
                                                {isMe && (
                                                    <span className={`ml-1 text-xs font-medium ${isDark ? 'text-cyan-400' : 'text-green-600'}`}>
                                                        (You)
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        {isCurrentPlayer && !player.isBankrupt && (
                                            <motion.div
                                                animate={{ rotate: [0, 10, -10, 0] }}
                                                transition={{ duration: 1, repeat: Infinity }}
                                            >
                                                <FaCrown className="w-4 h-4 text-amber-500" />
                                            </motion.div>
                                        )}
                                    </div>
                                    
                                    {/* Money Display */}
                                    <div className="mb-1 lg:mb-2">
                                        <p className={`text-lg lg:text-2xl font-black ${
                                            isDark ? 'text-green-400' : 'text-green-600'
                                        }`}>
                                            ${player.money?.toLocaleString()}
                                        </p>
                                    </div>
                                    
                                    {/* Stats */}
                                    <div className={`flex items-center gap-2 lg:gap-3 text-[10px] lg:text-xs font-medium ${
                                        isDark ? 'text-slate-300' : 'text-slate-600'
                                    }`}>
                                        <span className="flex items-center gap-1">
                                            <FaHome className="w-3 h-3 text-blue-500" />
                                            {player.properties?.length || 0}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <FaTrain className="w-3 h-3 text-slate-500" />
                                            {player.railroads?.length || 0}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <FaBolt className="w-3 h-3 text-yellow-500" />
                                            {player.utilities?.length || 0}
                                        </span>
                                        {player.getOutOfJailCards > 0 && (
                                            <span className="flex items-center gap-1">
                                                <FaKey className="w-3 h-3 text-purple-500" />
                                                {player.getOutOfJailCards}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* Status Badges */}
                                    <div className="flex gap-1.5 mt-2 flex-wrap">
                                        {player.inJail && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-500 rounded-lg text-xs font-semibold">
                                                <FaLock className="w-2.5 h-2.5" /> 
                                                Jail ({player.jailTurns}/3)
                                            </span>
                                        )}
                                        {player.isBankrupt && (
                                            <span className="px-2 py-1 bg-red-500/20 text-red-500 rounded-lg text-xs font-semibold">
                                                💀 Bankrupt
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </aside>

                {/* Center - Board (Full width on mobile) */}
                <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center">
                    <MonopolyBoard
                        gameState={gameState}
                        username={username}
                        onSpaceClick={(space) => {
                            if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
                                setSelectedProperty(space);
                            }
                        }}
                    />
                </div>

                {/* Right Sidebar - Controls */}
                <aside className="lg:w-56 xl:w-64 flex flex-row lg:flex-col gap-2 items-center lg:items-stretch justify-center flex-shrink-0 overflow-x-auto lg:overflow-x-visible">
                    {/* Turn Indicator */}
                    <motion.div
                        className={`w-auto lg:w-full p-2 sm:p-3 lg:p-4 rounded-xl shadow-lg flex-shrink-0 ${
                            isDark 
                                ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700' 
                                : 'bg-gradient-to-br from-white to-gray-50 border border-slate-200'
                        }`}
                        animate={isMyTurn ? {
                            boxShadow: isDark 
                                ? ['0 0 20px rgba(0,217,255,0.2)', '0 0 40px rgba(0,217,255,0.4)', '0 0 20px rgba(0,217,255,0.2)']
                                : ['0 0 20px rgba(220,38,38,0.2)', '0 0 40px rgba(220,38,38,0.4)', '0 0 20px rgba(220,38,38,0.2)']
                        } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <p className={`text-[10px] sm:text-xs font-medium uppercase tracking-wider mb-0.5 lg:mb-1 ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                            {isMyTurn ? '🎯 Your Turn!' : '⏳ Current Turn'}
                        </p>
                        <p className={`text-base sm:text-lg lg:text-xl font-black ${
                            isMyTurn 
                                ? (isDark ? 'text-cyan-400' : 'text-red-600')
                                : (isDark ? 'text-white' : 'text-slate-800')
                        }`}>
                            {gameState.currentPlayer}
                        </p>
                        {!isMyTurn && (
                            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                Waiting for their move...
                            </p>
                        )}
                    </motion.div>

                    {/* Dice Component */}
                    <MonopolyDice
                        onRoll={handleRollDice}
                        isRolling={isRolling}
                        lastRoll={gameState.lastRoll}
                        disabled={!canRoll || myPlayer?.isBankrupt}
                    />

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 w-full">
                        {/* End Turn Button */}
                        {!myPlayer?.isBankrupt && isMyTurn && gameState.turnPhase !== 'roll' && (
                            <motion.button
                                onClick={handleEndTurn}
                                className={`w-full px-6 py-3 rounded-xl font-bold text-base shadow-lg ${
                                    isDark
                                        ? 'bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-600 hover:from-cyan-500 hover:to-cyan-400 text-white'
                                        : 'bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-400 text-white'
                                }`}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                End Turn →
                            </motion.button>
                        )}

                        {/* Jail Actions */}
                        {myPlayer?.inJail && isMyTurn && (
                            <div className="flex flex-col gap-2">
                                {myPlayer.getOutOfJailCards > 0 && (
                                    <motion.button
                                        onClick={handleUseJailCard}
                                        className="w-full px-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg flex items-center justify-center gap-2"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <FaKey className="w-4 h-4" />
                                        Use Get Out of Jail Card
                                    </motion.button>
                                )}
                                {myPlayer.money >= 50 && (
                                    <motion.button
                                        onClick={handlePayJailFee}
                                        className="w-full px-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white shadow-lg flex items-center justify-center gap-2"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <FaHandHoldingUsd className="w-4 h-4" />
                                        Pay $50 Bail
                                    </motion.button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* My Stats Quick View */}
                    {myPlayer && !myPlayer.isBankrupt && (
                        <div className={`p-4 rounded-xl shadow-lg ${
                            isDark 
                                ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-green-500/20' 
                                : 'bg-gradient-to-br from-green-50 to-white border border-green-200'
                        }`}>
                            <p className={`text-xs font-medium uppercase tracking-wider mb-2 ${
                                isDark ? 'text-green-400' : 'text-green-600'
                            }`}>
                                💰 Your Balance
                            </p>
                            <p className={`text-3xl font-black ${
                                isDark ? 'text-green-400' : 'text-green-600'
                            }`}>
                                ${myPlayer.money?.toLocaleString()}
                            </p>
                        </div>
                    )}
                </aside>
            </main>

            {/* Property Modal */}
            <AnimatePresence>
                {selectedProperty && (
                    <MonopolyPropertyCard
                        space={selectedProperty}
                        property={gameState.properties[selectedProperty.id]}
                        onClose={() => setSelectedProperty(null)}
                        onBuy={() => handleBuyProperty(selectedProperty.id)}
                        onBuildHouse={() => handleBuildHouse(selectedProperty.id)}
                        onMortgage={() => handleMortgageProperty(selectedProperty.id)}
                        canBuy={isMyTurn && !gameState.properties[selectedProperty.id]?.owner && myPlayer?.position === selectedProperty.id}
                        canBuild={isMyTurn}
                        isOwner={gameState.properties[selectedProperty.id]?.owner === username}
                        playerMoney={myPlayer?.money || 0}
                    />
                )}
            </AnimatePresence>

            {/* Game Over Modal */}
            <AnimatePresence>
                {showGameOver && gameState.gameOver && (
                    <motion.div
                        className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className={`p-8 rounded-3xl max-w-md w-full shadow-2xl ${
                                isDark 
                                    ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/30' 
                                    : 'bg-gradient-to-br from-white to-gray-50'
                            }`}
                            initial={{ scale: 0.8, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.8, y: 50 }}
                        >
                            <motion.div
                                className="text-6xl text-center mb-4"
                                animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                            >
                                🏆
                            </motion.div>
                            <h2 className={`text-4xl font-black mb-4 text-center ${
                                isDark ? 'text-cyan-400' : 'text-red-600'
                            }`}>
                                Game Over!
                            </h2>
                            <p className={`text-2xl font-bold text-center mb-6 ${colors.text}`}>
                                {gameState.winner} Wins!
                            </p>
                            <motion.button
                                onClick={onLeaveRoom}
                                className={`w-full px-6 py-4 rounded-xl font-bold text-lg shadow-lg ${
                                    isDark
                                        ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white'
                                        : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white'
                                }`}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                Return to Lobby
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
