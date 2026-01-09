// Bot Player Utility - Manages bot players across all games
// Provides bot name generation, difficulty settings, and base AI interface

/**
 * Bot difficulty levels
 * - EASY: Makes random/simple decisions, slower reaction times
 * - MEDIUM: Balanced strategy, moderate reaction times  
 * - HARD: Smart decisions, quick reaction times
 */
export const BotDifficulty = {
    EASY: 'easy',
    MEDIUM: 'medium',
    HARD: 'hard'
};

/**
 * Fun bot names for different game types
 */
const BOT_NAMES = {
    scribble: [
        'Picasso Bot',
        'Doodle Master',
        'Sketch Wizard',
        'Art Bot 3000',
        'Canvas King',
        'Paint Pal',
        'Drawing Droid',
        'Pixel Painter'
    ],
    uno: [
        'Card Shark',
        'Uno Champion',
        'Deck Master',
        'Wild Card',
        'Color Matcher',
        'Stack Attack',
        'Draw King',
        'Reverse Bot'
    ],
    truthordare: [
        'Truth Seeker',
        'Dare Devil',
        'Challenge Bot',
        'Spin Master',
        'Party Bot',
        'Fun Times',
        'Game Changer',
        'Risk Taker'
    ]
};

/**
 * Generate a unique bot name for a specific game type
 * @param {string} gameType - 'scribble', 'uno', or 'truthordare'
 * @param {number} botIndex - Index of the bot (0-2)
 * @param {Array<string>} existingNames - Names already in use
 * @returns {string} Unique bot name
 */
export function generateBotName(gameType, botIndex, existingNames = []) {
    const names = BOT_NAMES[gameType] || BOT_NAMES.uno;

    // Try to get an unused name
    for (const name of names) {
        if (!existingNames.includes(name)) {
            return name;
        }
    }

    // Fallback: add number suffix
    return `Bot ${botIndex + 1}`;
}

/**
 * Create a bot player object
 * @param {string} gameType - Type of game
 * @param {number} botIndex - Index of the bot
 * @param {string} difficulty - Bot difficulty level
 * @param {Array<string>} existingNames - Existing player names
 * @returns {Object} Bot player object
 */
export function createBotPlayer(gameType, botIndex, difficulty = BotDifficulty.MEDIUM, existingNames = []) {
    const name = generateBotName(gameType, botIndex, existingNames);

    return {
        username: name,
        isBot: true,
        difficulty,
        botIndex,
        score: 0,
        status: 'waiting'
    };
}

/**
 * Get reaction delay based on difficulty
 * Simulates human-like timing for bot actions
 * @param {string} difficulty - Bot difficulty level
 * @returns {number} Delay in milliseconds
 */
export function getBotDelay(difficulty) {
    switch (difficulty) {
        case BotDifficulty.EASY:
            // Slow: 2-4 seconds
            return 2000 + Math.random() * 2000;
        case BotDifficulty.MEDIUM:
            // Medium: 1-2.5 seconds
            return 1000 + Math.random() * 1500;
        case BotDifficulty.HARD:
            // Fast: 0.5-1.5 seconds
            return 500 + Math.random() * 1000;
        default:
            return 1500;
    }
}

/**
 * Check if a player is a bot
 * @param {Object|string} player - Player object or username
 * @returns {boolean} True if player is a bot
 */
export function isBot(player) {
    if (typeof player === 'string') {
        // Check if username matches bot name pattern
        return BOT_NAMES.scribble.includes(player) ||
            BOT_NAMES.uno.includes(player) ||
            BOT_NAMES.truthordare.includes(player) ||
            player.startsWith('Bot ');
    }
    return player?.isBot === true;
}

/**
 * Get random element from array (helper for bot decisions)
 * @param {Array} array - Array to pick from
 * @returns {*} Random element
 */
export function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Make weighted random choice based on difficulty
 * Higher difficulty = better choices
 * @param {Array} choices - Array of {value, weight} objects
 * @param {string} difficulty - Bot difficulty
 * @returns {*} Selected value
 */
export function weightedChoice(choices, difficulty) {
    // Easy: ignore weights, pick randomly
    if (difficulty === BotDifficulty.EASY) {
        return getRandomElement(choices).value;
    }

    // Medium/Hard: use weights
    const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
    let random = Math.random() * totalWeight;

    for (const choice of choices) {
        random -= choice.weight;
        if (random <= 0) {
            return choice.value;
        }
    }

    return choices[0].value;
}
