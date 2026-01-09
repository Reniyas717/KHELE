// Bot Controller - Handles automated bot actions for all games
// This runs on the server and triggers bot moves at appropriate times

/**
 * Check if a player is a bot
 * @param {Object} player - Player object
 * @returns {boolean} True if player is a bot
 */
function isBot(player) {
    return player?.isBot === true;
}

/**
 * Get bot delay based on difficulty
 * @param {string} difficulty - Bot difficulty level
 * @returns {number} Delay in milliseconds
 */
function getBotDelay(difficulty) {
    switch (difficulty) {
        case 'easy':
            return 2000 + Math.random() * 2000; // 2-4 seconds
        case 'medium':
            return 1000 + Math.random() * 1500; // 1-2.5 seconds
        case 'hard':
            return 500 + Math.random() * 1000; // 0.5-1.5 seconds
        default:
            return 1500;
    }
}

/**
 * Schedule bot action for UNO game
 * @param {Object} gameState - Current game state
 * @param {string} roomCode - Room code
 * @param {Function} sendMessage - Function to send WebSocket message
 * @param {Function} broadcastToRoom - Function to broadcast to room
 */
async function scheduleBotUNOAction(gameState, roomCode, sendMessage, broadcastToRoom) {
    const currentPlayer = gameState.players.find(p => p.name === gameState.currentPlayer);

    if (!currentPlayer || !isBot(currentPlayer)) {
        return; // Not a bot's turn
    }

    console.log(`🤖 Bot ${currentPlayer.name} is thinking...`);

    const delay = getBotDelay(currentPlayer.difficulty || 'medium');

    setTimeout(async () => {
        try {
            // Import UNO bot AI
            const { makeBotDecision } = require('../utils/UNOBotAI');

            // Get bot's hand (this would need to be retrieved from game state)
            const botHand = gameState.hands[currentPlayer.name] || [];

            // Make decision
            const decision = makeBotDecision(botHand, gameState, currentPlayer.difficulty);

            if (decision.action === 'play') {
                // Bot plays a card
                console.log(`🤖 Bot ${currentPlayer.name} playing card`);
                // Trigger card play through websocket handler
                // This would call handlePlayCard
            } else {
                // Bot draws a card
                console.log(`🤖 Bot ${currentPlayer.name} drawing card`);
                // Trigger draw through websocket handler
            }
        } catch (error) {
            console.error('❌ Error in bot UNO action:', error);
        }
    }, delay);
}

/**
 * Schedule bot action for Scribble game
 * @param {Object} gameState - Current game state
 * @param {string} roomCode - Room code
 * @param {string} botUsername - Bot username
 * @param {Function} sendMessage - Function to send WebSocket message
 * @param {Function} broadcastToRoom - Function to broadcast to room
 */
async function scheduleBotScribbleAction(gameState, roomCode, botUsername, sendMessage, broadcastToRoom) {
    const botPlayer = gameState.players.find(p => p.username === botUsername);

    if (!botPlayer || !isBot(botPlayer)) {
        return;
    }

    const isDrawer = gameState.currentDrawer === botUsername;
    const delay = getBotDelay(botPlayer.difficulty || 'medium');

    if (isDrawer && gameState.wordOptions && gameState.wordOptions.length > 0) {
        // Bot needs to select a word
        setTimeout(() => {
            const { selectBotWord } = require('../utils/ScribbleBotAI');
            const selectedWord = selectBotWord(gameState.wordOptions, botPlayer.difficulty);

            console.log(`🤖 Bot ${botUsername} selected word: ${selectedWord}`);

            // Trigger word selection
            // This would call handleSelectWord
        }, delay);
    } else if (!isDrawer && gameState.roundActive) {
        // Bot might guess
        setTimeout(() => {
            const { makeBotGuess } = require('../utils/ScribbleBotAI');
            const timeElapsed = 30; // Would track actual time
            const guess = makeBotGuess(gameState.currentWord, botPlayer.difficulty, timeElapsed, []);

            if (guess) {
                console.log(`🤖 Bot ${botUsername} guessing: ${guess}`);
                // Trigger guess submission
            }
        }, delay + 5000); // Wait a bit before guessing
    }
}

/**
 * Schedule bot action for Truth or Dare game
 * @param {string} action - Action type ('spin', 'selectCard', 'rate')
 * @param {Object} gameState - Current game state
 * @param {string} roomCode - Room code
 * @param {string} botUsername - Bot username
 * @param {Function} sendMessage - Function to send WebSocket message
 */
async function scheduleBotTruthOrDareAction(action, gameState, roomCode, botUsername, sendMessage) {
    const botPlayer = gameState.players?.find(p => p.username === botUsername);

    if (!botPlayer || !isBot(botPlayer)) {
        return;
    }

    const delay = getBotDelay(botPlayer.difficulty || 'medium');

    setTimeout(() => {
        try {
            if (action === 'spin') {
                console.log(`🤖 Bot ${botUsername} spinning wheel`);
                // Trigger wheel spin
            } else if (action === 'selectCard') {
                const { selectBotCard } = require('../utils/TruthDareBotAI');
                const cardIndex = selectBotCard(gameState.cards || [], botPlayer.difficulty);
                console.log(`🤖 Bot ${botUsername} selected card ${cardIndex}`);
                // Trigger card selection
            } else if (action === 'rate') {
                const { generateBotRating } = require('../utils/TruthDareBotAI');
                const rating = generateBotRating(botPlayer.difficulty, 'dare');
                console.log(`🤖 Bot ${botUsername} rated: ${rating}`);
                // Trigger rating submission
            }
        } catch (error) {
            console.error('❌ Error in bot Truth or Dare action:', error);
        }
    }, delay);
}

module.exports = {
    isBot,
    getBotDelay,
    scheduleBotUNOAction,
    scheduleBotScribbleAction,
    scheduleBotTruthOrDareAction
};
