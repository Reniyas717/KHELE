import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { IoShuffle, IoPeople, IoPerson } from 'react-icons/io5';

const TEAM_COLORS = [
    { name: 'Red Team', color: '#EF4444', gradient: 'from-red-500 to-red-700' },
    { name: 'Blue Team', color: '#3B82F6', gradient: 'from-blue-500 to-blue-700' },
    { name: 'Green Team', color: '#10B981', gradient: 'from-green-500 to-green-700' },
    { name: 'Yellow Team', color: '#F59E0B', gradient: 'from-yellow-500 to-yellow-700' }
];

export default function TeamSelector({
    players,
    isHost,
    teamMode,
    teams,
    onTeamModeChange,
    onRandomizeTeams,
    onMovePlayer
}) {
    const { colors } = useTheme();
    const [numTeams, setNumTeams] = useState(2);

    const handleRandomize = () => {
        // Shuffle players and distribute evenly
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        const newTeams = Array.from({ length: numTeams }, (_, i) => ({
            name: TEAM_COLORS[i].name,
            color: TEAM_COLORS[i].color,
            members: []
        }));

        shuffled.forEach((player, idx) => {
            const teamIndex = idx % numTeams;
            newTeams[teamIndex].members.push(player.username);
        });

        onRandomizeTeams(newTeams);
    };

    const handleMovePlayer = (username, fromTeam, toTeam) => {
        if (!isHost) return;
        onMovePlayer(username, fromTeam, toTeam);
    };

    const getUnassignedPlayers = () => {
        if (!teamMode || !teams) return [];
        const assignedUsernames = teams.flatMap(t => t.members);
        return players.filter(p => !assignedUsernames.includes(p.username));
    };

    const unassignedPlayers = getUnassignedPlayers();

    return (
        <div className={`p-6 rounded-2xl border backdrop-blur-xl ${colors.surface} ${colors.border} shadow-xl`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h3 className={`text-xl md:text-2xl font-display font-bold ${colors.text}`}>
                    Team Configuration
                </h3>
                {isHost && (
                    <div className="flex gap-2">
                        <motion.button
                            onClick={() => onTeamModeChange(!teamMode)}
                            className={`px-4 py-2 rounded-lg font-accent font-semibold transition-all ${teamMode
                                    ? `${colors.primaryBg} text-white`
                                    : `${colors.bgSecondary} ${colors.text}`
                                }`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {teamMode ? <IoPeople className="inline mr-2" /> : <IoPerson className="inline mr-2" />}
                            {teamMode ? 'Team Mode' : 'Solo Mode'}
                        </motion.button>
                    </div>
                )}
            </div>

            {/* Mode Description */}
            <p className={`text-sm mb-4 ${colors.textSecondary}`}>
                {teamMode
                    ? '🤝 Players work together in teams. Shared money and properties!'
                    : '🎯 Every player for themselves. Classic Monopoly rules!'
                }
            </p>

            {/* Team Mode Controls */}
            {teamMode && isHost && (
                <div className="mb-6 space-y-4">
                    {/* Number of Teams */}
                    <div className="flex items-center gap-4">
                        <label className={`font-accent font-semibold ${colors.text}`}>
                            Number of Teams:
                        </label>
                        <div className="flex gap-2">
                            {[2, 3, 4].map(num => (
                                <motion.button
                                    key={num}
                                    onClick={() => setNumTeams(num)}
                                    className={`px-4 py-2 rounded-lg font-bold transition-all ${numTeams === num
                                            ? `${colors.primaryBg} text-white`
                                            : `${colors.bgSecondary} ${colors.text}`
                                        }`}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    {num}
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    {/* Randomize Button */}
                    <motion.button
                        onClick={handleRandomize}
                        className={`w-full px-4 py-3 rounded-lg font-accent font-bold transition-all shadow-lg ${colors.secondaryBg} ${colors.secondaryHover} text-white`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <IoShuffle className="inline mr-2" />
                        Randomize Teams
                    </motion.button>
                </div>
            )}

            {/* Team Display */}
            {teamMode && teams && teams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teams.slice(0, numTeams).map((team, teamIndex) => (
                        <motion.div
                            key={teamIndex}
                            className={`p-4 rounded-xl border-2 bg-gradient-to-br ${TEAM_COLORS[teamIndex].gradient} bg-opacity-10`}
                            style={{ borderColor: TEAM_COLORS[teamIndex].color }}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: teamIndex * 0.1 }}
                        >
                            <h4 className="text-lg font-bold mb-3 text-white flex items-center gap-2">
                                <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: TEAM_COLORS[teamIndex].color }}
                                />
                                {team.name}
                            </h4>

                            <div className="space-y-2">
                                {team.members && team.members.length > 0 ? (
                                    team.members.map((username) => (
                                        <motion.div
                                            key={username}
                                            className={`p-2 rounded-lg backdrop-blur-xl ${colors.surface} ${colors.border} border`}
                                            whileHover={{ scale: 1.02 }}
                                        >
                                            <p className={`font-accent font-semibold ${colors.text}`}>
                                                {username}
                                            </p>
                                            {isHost && (
                                                <div className="flex gap-1 mt-2">
                                                    {teams.map((_, otherTeamIndex) => {
                                                        if (otherTeamIndex === teamIndex) return null;
                                                        return (
                                                            <button
                                                                key={otherTeamIndex}
                                                                onClick={() => handleMovePlayer(username, teamIndex, otherTeamIndex)}
                                                                className="text-xs px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white"
                                                            >
                                                                → Team {otherTeamIndex + 1}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </motion.div>
                                    ))
                                ) : (
                                    <p className={`text-sm italic ${colors.textSecondary}`}>
                                        No players assigned
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    ))}

                    {/* Unassigned Players */}
                    {unassignedPlayers.length > 0 && (
                        <motion.div
                            className={`p-4 rounded-xl border-2 ${colors.border} ${colors.bgSecondary}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <h4 className={`text-lg font-bold mb-3 ${colors.text}`}>
                                Unassigned Players
                            </h4>
                            <div className="space-y-2">
                                {unassignedPlayers.map((player) => (
                                    <motion.div
                                        key={player.username}
                                        className={`p-2 rounded-lg ${colors.surface} border ${colors.border}`}
                                        whileHover={{ scale: 1.02 }}
                                    >
                                        <p className={`font-accent font-semibold ${colors.text}`}>
                                            {player.username}
                                        </p>
                                        {isHost && (
                                            <div className="flex gap-1 mt-2">
                                                {teams.slice(0, numTeams).map((_, teamIndex) => (
                                                    <button
                                                        key={teamIndex}
                                                        onClick={() => handleMovePlayer(player.username, -1, teamIndex)}
                                                        className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
                                                    >
                                                        → Team {teamIndex + 1}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>
            ) : (
                /* Solo Mode - Show all players */
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {players.map((player, idx) => (
                        <motion.div
                            key={player.username}
                            className={`p-3 rounded-lg border ${colors.surface} ${colors.border}`}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <p className={`font-accent font-semibold text-center ${colors.text}`}>
                                {player.username}
                            </p>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Team Rules Info */}
            {teamMode && (
                <motion.div
                    className={`mt-6 p-4 rounded-lg ${colors.bgSecondary} border ${colors.border}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <h4 className={`font-bold mb-2 ${colors.text}`}>Team Rules:</h4>
                    <ul className={`text-sm space-y-1 ${colors.textSecondary}`}>
                        <li>✓ Teams share money and properties</li>
                        <li>✓ Teammates don't pay rent to each other</li>
                        <li>✓ Team wins when all other teams are bankrupt</li>
                        <li>✓ All team members can make decisions</li>
                    </ul>
                </motion.div>
            )}
        </div>
    );
}
