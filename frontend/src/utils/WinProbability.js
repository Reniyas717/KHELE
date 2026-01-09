// UNO Win Probability Calculator
// Calculates each player's probability of winning based on their cards

/**
 * Calculate card value/strength
 * Higher value = better card
 */
export function getCardValue(card) {
    const values = {
        // Action cards are most valuable
        'wild_draw4': 50,
        'wild': 40,
        'draw2': 35,
        'skip': 30,
        'reverse': 30,
        // Number cards
        '0': 5,
        '1': 6,
        '2': 7,
        '3': 8,
        '4': 9,
        '5': 10,
        '6': 11,
        '7': 12,
        '8': 13,
        '9': 14
    };

    return values[card.value] || 10;
}

/**
 * Calculate hand strength
 * @param {Array} hand - Player's cards
 * @param {string} currentColor - Current game color
 * @param {string} currentValue - Current card value
 * @returns {number} Hand strength score
 */
export function calculateHandStrength(hand, currentColor, currentValue) {
    if (!hand || hand.length === 0) return 0;

    let strength = 0;
    let playableCards = 0;
    let wildCards = 0;
    let actionCards = 0;

    hand.forEach(card => {
        // Add base card value
        strength += getCardValue(card);

        // Bonus for playable cards
        if (card.color === 'wild' || card.color === currentColor || card.value === currentValue) {
            playableCards++;
            strength += 20;
        }

        // Count special cards
        if (card.color === 'wild') {
            wildCards++;
            strength += 10;
        }

        if (['skip', 'reverse', 'draw2', 'wild_draw4'].includes(card.value)) {
            actionCards++;
            strength += 5;
        }
    });

    // Penalties for large hand
    const handSizePenalty = hand.length * 5;
    strength -= handSizePenalty;

    // Bonus for having playable options
    strength += playableCards * 15;

    // Bonus for variety (color distribution)
    const colors = new Set(hand.filter(c => c.color !== 'wild').map(c => c.color));
    strength += colors.size * 10;

    return Math.max(0, strength);
}

/**
 * Calculate win probability for all players
 * @param {Object} gameState - Current game state
 * @returns {Object} Map of username -> probability percentage
 */
export function calculateWinProbabilities(gameState) {
    if (!gameState || !gameState.hands) return {};

    const players = Object.keys(gameState.hands);
    const strengths = {};
    let totalStrength = 0;

    // Calculate strength for each player
    players.forEach(username => {
        const hand = gameState.hands[username];
        const strength = calculateHandStrength(
            hand,
            gameState.currentColor,
            gameState.currentValue
        );

        // Bonus for players who finished (100% for them)
        if (gameState.finishedPlayers && gameState.finishedPlayers.includes(username)) {
            strengths[username] = 0; // Already finished
        } else {
            strengths[username] = strength;
            totalStrength += strength;
        }
    });

    // Convert to percentages
    const probabilities = {};

    if (totalStrength === 0) {
        // Equal probability if no one has cards
        const equalProb = 100 / players.filter(p => !gameState.finishedPlayers?.includes(p)).length;
        players.forEach(username => {
            probabilities[username] = gameState.finishedPlayers?.includes(username) ? 0 : equalProb;
        });
    } else {
        players.forEach(username => {
            if (gameState.finishedPlayers?.includes(username)) {
                probabilities[username] = 0;
            } else {
                probabilities[username] = Math.round((strengths[username] / totalStrength) * 100);
            }
        });
    }

    return probabilities;
}

/**
 * Get color class for probability
 * @param {number} probability - Win probability percentage
 * @returns {string} Color class
 */
export function getProbabilityColor(probability) {
    if (probability >= 60) return 'text-green-500';
    if (probability >= 40) return 'text-yellow-500';
    if (probability >= 20) return 'text-orange-500';
    return 'text-red-500';
}
