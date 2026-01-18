import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

// Clean 2D Dice with smooth bouncing roll animation
export default function MonopolyDice({ 
    onRoll, 
    disabled = false, 
    lastRoll = null,
    isRolling = false 
}) {
    const { theme } = useTheme();
    const [rolling, setRolling] = useState(false);
    const [displayValues, setDisplayValues] = useState({ dice1: 1, dice2: 1 });
    const [showResult, setShowResult] = useState(false);
    const rollIntervalRef = useRef(null);
    const isDark = theme === 'dark';

    useEffect(() => {
        if (lastRoll?.dice1 && lastRoll?.dice2) {
            setDisplayValues({ dice1: lastRoll.dice1, dice2: lastRoll.dice2 });
            setShowResult(true);
        }
    }, [lastRoll]);

    useEffect(() => {
        return () => {
            if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
        };
    }, []);

    const handleRoll = () => {
        if (disabled || rolling) return;
        setRolling(true);
        setShowResult(false);

        let rollCount = 0;
        const maxRolls = 18;
        
        rollIntervalRef.current = setInterval(() => {
            setDisplayValues({
                dice1: Math.floor(Math.random() * 6) + 1,
                dice2: Math.floor(Math.random() * 6) + 1
            });
            rollCount++;
            if (rollCount >= maxRolls) {
                clearInterval(rollIntervalRef.current);
                setRolling(false);
                setShowResult(true);
                if (onRoll) onRoll();
            }
        }, 70);
    };

    // Single Dice with dots
    const DiceFace = ({ value, isRolling: isRoll }) => {
        const dotPositions = {
            1: [[50, 50]],
            2: [[28, 28], [72, 72]],
            3: [[28, 28], [50, 50], [72, 72]],
            4: [[28, 28], [72, 28], [28, 72], [72, 72]],
            5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
            6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]]
        };
        const dots = dotPositions[value] || [];

        return (
            <motion.div
                className={`relative rounded-lg sm:rounded-xl w-12 h-12 sm:w-14 sm:h-14 lg:w-[72px] lg:h-[72px] ${
                    isDark 
                        ? 'bg-gradient-to-br from-slate-700 to-slate-900 border-[3px] border-cyan-400' 
                        : 'bg-gradient-to-br from-white to-gray-100 border-[3px] border-red-500'
                }`}
                style={{
                    boxShadow: isDark 
                        ? `0 0 ${isRoll ? '20px' : '10px'} rgba(0,217,255,${isRoll ? 0.7 : 0.35}), 0 4px 12px rgba(0,0,0,0.5)`
                        : `0 0 ${isRoll ? '15px' : '6px'} rgba(220,38,38,${isRoll ? 0.4 : 0.15}), 0 4px 12px rgba(0,0,0,0.15)`
                }}
                animate={isRoll ? {
                    rotate: [0, 90, 180, 270, 360],
                    scale: [1, 1.08, 0.96, 1.04, 1],
                } : { rotate: 0, scale: 1 }}
                transition={isRoll ? {
                    rotate: { duration: 0.25, repeat: Infinity, ease: "linear" },
                    scale: { duration: 0.18, repeat: Infinity }
                } : { duration: 0.25 }}
            >
                {dots.map((pos, idx) => (
                    <motion.div
                        key={idx}
                        className={`absolute rounded-full w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 ${
                            isDark ? 'bg-cyan-400' : 'bg-red-500'
                        }`}
                        style={{
                            left: `${pos[0]}%`,
                            top: `${pos[1]}%`,
                            transform: 'translate(-50%, -50%)',
                            boxShadow: isDark 
                                ? '0 0 6px rgba(0,217,255,0.8)'
                                : '0 1px 2px rgba(0,0,0,0.3)'
                        }}
                    />
                ))}
            </motion.div>
        );
    };

    const isDoubles = displayValues.dice1 === displayValues.dice2 && showResult;
    const total = displayValues.dice1 + displayValues.dice2;

    return (
        <motion.div 
            className={`flex flex-col items-center gap-2 sm:gap-3 p-2 sm:p-3 lg:p-4 rounded-lg sm:rounded-xl ${
                isDark 
                    ? 'bg-gradient-to-br from-slate-800/95 to-slate-900/95 border border-cyan-500/25' 
                    : 'bg-gradient-to-br from-white to-gray-50 border border-slate-200'
            } shadow-xl`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
        >
            {/* Rolling Label */}
            <AnimatePresence>
                {rolling && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`text-xs font-bold tracking-widest ${isDark ? 'text-cyan-400' : 'text-red-500'}`}
                    >
                        <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 0.35, repeat: Infinity }}>
                            🎲 ROLLING 🎲
                        </motion.span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dice */}
            <div className="flex gap-2 sm:gap-3 lg:gap-4 items-center justify-center py-1 sm:py-2">
                <motion.div
                    animate={rolling ? { y: [0, -20, 4, -12, 0], x: [0, 6, -4, 2, 0] } : {}}
                    transition={rolling ? { duration: 0.35, repeat: Infinity, ease: "easeInOut" } : {}}
                >
                    <DiceFace value={displayValues.dice1} isRolling={rolling} />
                </motion.div>
                <motion.div
                    animate={rolling ? { y: [0, -16, 6, -10, 0], x: [0, -5, 3, -1, 0] } : {}}
                    transition={rolling ? { duration: 0.3, repeat: Infinity, ease: "easeInOut", delay: 0.04 } : {}}
                >
                    <DiceFace value={displayValues.dice2} isRolling={rolling} />
                </motion.div>
            </div>

            {/* Result */}
            <AnimatePresence mode="wait">
                {showResult && !rolling && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg ${isDark ? 'bg-slate-700/70' : 'bg-slate-100'}`}>
                            <span className={`text-base sm:text-lg lg:text-xl font-bold ${isDark ? 'text-cyan-400' : 'text-red-500'}`}>{displayValues.dice1}</span>
                            <span className={`text-xs sm:text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>+</span>
                            <span className={`text-base sm:text-lg lg:text-xl font-bold ${isDark ? 'text-cyan-400' : 'text-red-500'}`}>{displayValues.dice2}</span>
                            <span className={`text-xs sm:text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>=</span>
                            <motion.span
                                className={`text-lg sm:text-xl lg:text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}
                                initial={{ scale: 0.6 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 400 }}
                            >
                                {total}
                            </motion.span>
                        </div>
                        {isDoubles && (
                            <motion.div
                                className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-lg"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1, boxShadow: ['0 0 12px rgba(251,191,36,0.4)', '0 0 24px rgba(251,191,36,0.7)', '0 0 12px rgba(251,191,36,0.4)'] }}
                                transition={{ boxShadow: { duration: 0.7, repeat: Infinity } }}
                            >
                                <span className="text-xs font-black text-slate-900">✨ DOUBLES! ✨</span>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Button */}
            <motion.button
                onClick={handleRoll}
                disabled={disabled || rolling}
                className={`relative px-4 sm:px-5 lg:px-6 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all overflow-hidden ${
                    disabled || rolling
                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        : isDark
                            ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white hover:shadow-lg hover:shadow-cyan-500/35'
                            : 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:shadow-lg hover:shadow-red-500/35'
                }`}
                whileHover={!disabled && !rolling ? { scale: 1.03 } : {}}
                whileTap={!disabled && !rolling ? { scale: 0.97 } : {}}
            >
                {!disabled && !rolling && (
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 0.8 }}
                    />
                )}
                <span className="relative z-10 flex items-center gap-2">
                    {rolling ? (
                        <><motion.span animate={{ rotate: 360 }} transition={{ duration: 0.3, repeat: Infinity, ease: 'linear' }}>🎲</motion.span> Rolling...</>
                    ) : (<>🎲 Roll Dice</>)}
                </span>
            </motion.button>

            {disabled && !rolling && (
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Wait for your turn</p>
            )}
        </motion.div>
    );
}
