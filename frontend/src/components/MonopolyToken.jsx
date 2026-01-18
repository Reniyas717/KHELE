import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

// Player token styles with solid colors
const TOKEN_STYLES = [
    { color: '#EF4444', name: 'Red', initial: 'R', shadow: 'rgba(239, 68, 68, 0.5)' },
    { color: '#3B82F6', name: 'Blue', initial: 'B', shadow: 'rgba(59, 130, 246, 0.5)' },
    { color: '#10B981', name: 'Green', initial: 'G', shadow: 'rgba(16, 185, 129, 0.5)' },
    { color: '#F59E0B', name: 'Orange', initial: 'O', shadow: 'rgba(245, 158, 11, 0.5)' },
    { color: '#8B5CF6', name: 'Purple', initial: 'P', shadow: 'rgba(139, 92, 246, 0.5)' },
    { color: '#EC4899', name: 'Pink', initial: 'K', shadow: 'rgba(236, 72, 153, 0.5)' },
    { color: '#14B8A6', name: 'Teal', initial: 'T', shadow: 'rgba(20, 184, 166, 0.5)' },
    { color: '#F97316', name: 'Amber', initial: 'A', shadow: 'rgba(249, 115, 22, 0.5)' }
];

export default function MonopolyToken({
    player,
    index,
    isCurrentPlayer,
    isMe,
    position,
    totalPlayers,
    compact = false
}) {
    const tokenStyle = TOKEN_STYLES[index % TOKEN_STYLES.length];

    // Size based on number of players and compact mode
    const size = compact || totalPlayers > 2 ? 'w-5 h-5 md:w-6 md:h-6' : 'w-6 h-6 md:w-7 md:h-7';
    const fontSize = compact || totalPlayers > 2 ? 'text-[9px] md:text-[11px]' : 'text-[10px] md:text-xs';

    return (
        <motion.div
            className="relative"
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{
                scale: 1,
                rotate: 0,
                opacity: 1,
                y: isCurrentPlayer ? [0, -2, 0] : 0
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
                scale: { type: "spring", stiffness: 300, damping: 25 },
                rotate: { type: "spring", stiffness: 300, damping: 25 },
                opacity: { duration: 0.2 },
                y: {
                    duration: 0.5,
                    repeat: isCurrentPlayer ? Infinity : 0,
                    repeatType: "reverse",
                    ease: "easeInOut"
                }
            }}
            whileHover={{ scale: 1.2, zIndex: 50 }}
            title={`${player.username}${isMe ? ' (You)' : ''}`}
        >
            {/* Token Container */}
            <div
                className={`relative ${size} rounded-full flex items-center justify-center ${fontSize} font-black shadow-lg border-2 ${isCurrentPlayer ? 'border-white' : 'border-gray-900'
                    }`}
                style={{
                    backgroundColor: tokenStyle.color,
                    boxShadow: isCurrentPlayer
                        ? `0 0 12px ${tokenStyle.shadow}, 0 2px 6px rgba(0,0,0,0.4)`
                        : '0 2px 6px rgba(0,0,0,0.4)'
                }}
            >
                {/* Token Initial */}
                <span className="text-white font-black drop-shadow-md">
                    {tokenStyle.initial}
                </span>

                {/* Current Player Pulsing Ring */}
                {isCurrentPlayer && (
                    <motion.div
                        className="absolute inset-0 rounded-full border-2 border-white"
                        animate={{
                            scale: [1, 1.5, 1],
                            opacity: [1, 0, 1]
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                )}

                {/* "You" Badge */}
                {isMe && (
                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 md:w-3 md:h-3 bg-blue-600 rounded-full flex items-center justify-center text-white text-[6px] md:text-[8px] font-black border border-white shadow-md">
                        ✓
                    </div>
                )}
            </div>

            {/* Player Name Tooltip on Hover */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                <div className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-900 text-white border border-gray-700 shadow-lg">
                    {player.username}
                    {isMe && ' (You)'}
                </div>
            </div>
        </motion.div>
    );
}
