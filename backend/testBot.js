// Simple test to verify bot detection
// Run this in backend terminal: node testBot.js

const players = [
    { username: 'Human Player', isBot: false },
    { username: 'Card Shark', isBot: true, difficulty: 'medium' }
];

console.log('Testing bot detection:');
players.forEach((player, index) => {
    console.log(`Player ${index}:`, {
        username: player.username,
        isBot: player.isBot,
        difficulty: player.difficulty
    });

    if (player.isBot) {
        console.log(`✅ ${player.username} is a bot!`);
    } else {
        console.log(`👤 ${player.username} is human`);
    }
});

// Test game state structure
const gameState = {
    players: players.map(p => ({
        username: p.username,
        name: p.username,
        isBot: p.isBot || false,
        difficulty: p.difficulty || 'medium',
        cardCount: 7
    })),
    currentPlayerIndex: 1
};

console.log('\nGame state players:');
console.log(JSON.stringify(gameState.players, null, 2));

const nextPlayer = gameState.players[gameState.currentPlayerIndex];
console.log('\nNext player:', nextPlayer);
console.log('Is bot?', nextPlayer.isBot);
console.log('Should trigger bot?', nextPlayer && nextPlayer.isBot);
