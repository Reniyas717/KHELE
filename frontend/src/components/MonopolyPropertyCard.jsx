import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { IoClose } from 'react-icons/io5';
import { FaHome, FaHotel, FaTrain, FaBolt, FaTint } from 'react-icons/fa';

const PROPERTY_COLORS = {
    brown: { main: '#5D4037', light: '#8D6E63', dark: '#3E2723' },
    lightblue: { main: '#4FC3F7', light: '#81D4FA', dark: '#039BE5' },
    pink: { main: '#EC407A', light: '#F48FB1', dark: '#C2185B' },
    orange: { main: '#FF7043', light: '#FFAB91', dark: '#E64A19' },
    red: { main: '#EF5350', light: '#EF9A9A', dark: '#C62828' },
    yellow: { main: '#FFEE58', light: '#FFF59D', dark: '#F9A825' },
    green: { main: '#66BB6A', light: '#A5D6A7', dark: '#2E7D32' },
    darkblue: { main: '#5C6BC0', light: '#9FA8DA', dark: '#303F9F' }
};

export default function MonopolyPropertyCard({
    space,
    property,
    onClose,
    onBuy,
    onBuildHouse,
    onMortgage,
    canBuy,
    canBuild,
    isOwner,
    playerMoney
}) {
    const { theme } = useTheme();

    if (!space) return null;

    const propertyColor = space.color ? PROPERTY_COLORS[space.color] : null;
    const isProperty = space.type === 'property';
    const isRailroad = space.type === 'railroad';
    const isUtility = space.type === 'utility';

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className={`relative max-w-xs w-full rounded-xl overflow-hidden shadow-2xl ${
                        theme === 'dark' ? 'bg-slate-800' : 'bg-white'
                    }`}
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/20 hover:bg-black/40 transition-colors"
                    >
                        <IoClose className="w-4 h-4 text-white" />
                    </button>

                    {/* Property Color Header */}
                    {propertyColor && (
                        <div
                            className="h-16 relative flex items-center justify-center"
                            style={{
                                background: `linear-gradient(135deg, ${propertyColor.light} 0%, ${propertyColor.main} 50%, ${propertyColor.dark} 100%)`
                            }}
                        >
                            <FaHome className="w-8 h-8 text-white/80 drop-shadow-lg" />
                        </div>
                    )}

                    {/* Railroad/Utility Header */}
                    {(isRailroad || isUtility) && (
                        <div className="h-16 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 flex items-center justify-center">
                            {isRailroad ? (
                                <FaTrain className="w-8 h-8 text-white/80" />
                            ) : space.name.includes('Electric') ? (
                                <FaBolt className="w-8 h-8 text-amber-400" />
                            ) : (
                                <FaTint className="w-8 h-8 text-cyan-400" />
                            )}
                        </div>
                    )}

                    {/* Card Content */}
                    <div className="p-4">
                        {/* Property Name */}
                        <h2 className={`text-lg font-bold mb-3 text-center ${
                            theme === 'dark' ? 'text-white' : 'text-slate-800'
                        }`}>
                            {space.name}
                        </h2>

                        {/* Property Details */}
                        <div className={`space-y-2 mb-4 rounded-lg p-3 text-sm ${
                            theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-50'
                        }`}>
                            {/* Price */}
                            {space.price && (
                                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-600">
                                    <span className={`font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Price:</span>
                                    <span className="text-lg font-bold text-emerald-600">${space.price}</span>
                                </div>
                            )}

                            {/* Rent Information - Compact */}
                            {isProperty && space.rent && (
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Base Rent:</span>
                                        <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>${space.rent[0]}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className={`flex justify-between px-1.5 py-0.5 rounded ${
                                                theme === 'dark' ? 'bg-slate-600/50' : 'bg-white'
                                            }`}>
                                                <span>{i}🏠:</span>
                                                <span className="font-semibold">${space.rent[i]}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-600">
                                        <span className={`flex items-center gap-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                            <FaHotel className="w-3 h-3 text-red-500" /> Hotel:
                                        </span>
                                        <span className="font-bold text-red-600">${space.rent[5]}</span>
                                    </div>
                                </div>
                            )}

                            {/* Railroad Rent - Compact */}
                            {isRailroad && space.rent && (
                                <div className="grid grid-cols-2 gap-1 text-[10px]">
                                    {[1, 2, 3, 4].map(count => (
                                        <div key={count} className={`flex justify-between px-1.5 py-1 rounded ${
                                            theme === 'dark' ? 'bg-slate-600/50' : 'bg-white'
                                        }`}>
                                            <span>{count}🚂:</span>
                                            <span className="font-semibold">${space.rent[count - 1]}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Utility Rent - Compact */}
                            {isUtility && (
                                <div className="space-y-1 text-xs">
                                    <div className={`flex justify-between px-2 py-1 rounded ${
                                        theme === 'dark' ? 'bg-slate-600/50' : 'bg-white'
                                    }`}>
                                        <span>1 Utility:</span>
                                        <span className="font-semibold">4× dice</span>
                                    </div>
                                    <div className={`flex justify-between px-2 py-1 rounded ${
                                        theme === 'dark' ? 'bg-slate-600/50' : 'bg-white'
                                    }`}>
                                        <span>2 Utilities:</span>
                                        <span className="font-semibold text-blue-600">10× dice</span>
                                    </div>
                                </div>
                            )}

                            {/* House Cost */}
                            {isProperty && space.houseCost && (
                                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-600 text-xs">
                                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>House Cost:</span>
                                    <span className="font-bold text-emerald-600">${space.houseCost}</span>
                                </div>
                            )}
                        </div>

                        {/* Owner Status - Compact */}
                        {property?.owner && (
                            <div className={`mb-3 p-2 rounded-lg text-center text-xs ${
                                isOwner 
                                    ? 'bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-400' 
                                    : 'bg-red-50 dark:bg-red-900/30 border border-red-400'
                            }`}>
                                <p className={`font-semibold ${isOwner ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                    {isOwner ? '✓ You own this' : `Owned by ${property.owner}`}
                                </p>
                                {property.houses > 0 && (
                                    <p className="text-[10px] mt-0.5 text-slate-600 dark:text-slate-400">
                                        {property.houses < 5 ? `${property.houses} House${property.houses > 1 ? 's' : ''}` : '🏨 Hotel'}
                                    </p>
                                )}
                                {property.mortgaged && (
                                    <p className="text-[10px] mt-0.5 font-bold text-orange-600">⚠️ MORTGAGED</p>
                                )}
                            </div>
                        )}

                        {/* Action Buttons - Compact */}
                        <div className="space-y-1.5">
                            {canBuy && !property?.owner && (
                                <motion.button
                                    onClick={onBuy}
                                    disabled={playerMoney < space.price}
                                    className={`w-full px-3 py-2 rounded-lg font-semibold text-sm transition-all shadow-md ${
                                        playerMoney < space.price
                                            ? 'bg-slate-400 cursor-not-allowed opacity-50 text-white'
                                            : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white'
                                    }`}
                                    whileHover={playerMoney >= space.price ? { scale: 1.02 } : {}}
                                    whileTap={playerMoney >= space.price ? { scale: 0.98 } : {}}
                                >
                                    {playerMoney < space.price ? '❌ Insufficient Funds' : `💰 Buy $${space.price}`}
                                </motion.button>
                            )}

                            {isOwner && isProperty && canBuild && !property?.mortgaged && (
                                <motion.button
                                    onClick={onBuildHouse}
                                    disabled={playerMoney < space.houseCost || property.houses >= 5}
                                    className={`w-full px-3 py-2 rounded-lg font-semibold text-sm transition-all shadow-md ${
                                        playerMoney < space.houseCost || property.houses >= 5
                                            ? 'bg-slate-400 cursor-not-allowed opacity-50 text-white'
                                            : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'
                                    }`}
                                    whileHover={playerMoney >= space.houseCost && property.houses < 5 ? { scale: 1.02 } : {}}
                                    whileTap={playerMoney >= space.houseCost && property.houses < 5 ? { scale: 0.98 } : {}}
                                >
                                    {property.houses >= 5 ? '🏨 Max Built' : `🏗️ Build $${space.houseCost}`}
                                </motion.button>
                            )}

                            {isOwner && !property?.mortgaged && property?.houses === 0 && (
                                <motion.button
                                    onClick={onMortgage}
                                    className="w-full px-3 py-2 rounded-lg font-semibold text-sm bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white shadow-md transition-all"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    💵 Mortgage ${Math.floor(space.price / 2)}
                                </motion.button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
