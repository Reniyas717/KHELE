// Truth or Dare Bot AI - Handles bot actions in Truth or Dare game
import { BotDifficulty, getBotDelay, getRandomElement } from './BotPlayer';

/**
 * Bot selects a card from available options
 * @param {Array} cards - Available cards to choose from
 * @param {string} difficulty - Bot difficulty
 * @returns {number} Index of selected card
 */
export function selectBotCard(cards, difficulty) {
    if (!cards || cards.length === 0) {
        return 0;
    }

    // Easy: always pick first card
    if (difficulty === BotDifficulty.EASY) {
        return 0;
    }

    // Medium: pick randomly
    if (difficulty === BotDifficulty.MEDIUM) {
        return Math.floor(Math.random() * cards.length);
    }

    // Hard: prefer dare cards (more exciting)
    const dareIndices = cards
        .map((card, index) => ({ card, index }))
        .filter(item => item.card.type === 'dare')
        .map(item => item.index);

    if (dareIndices.length > 0 && Math.random() < 0.6) {
        return getRandomElement(dareIndices);
    }

    return Math.floor(Math.random() * cards.length);
}

/**
 * Bot rates another player's performance
 * @param {string} difficulty - Bot difficulty
 * @param {string} challengeType - 'truth' or 'dare'
 * @returns {number} Rating from 1-10
 */
export function generateBotRating(difficulty, challengeType) {
    let baseRating;
    let variance;

    switch (difficulty) {
        case BotDifficulty.EASY:
            // Easy bots give random ratings (1-10)
            return Math.floor(Math.random() * 10) + 1;

        case BotDifficulty.MEDIUM:
            // Medium bots give moderate ratings (4-8)
            baseRating = 6;
            variance = 2;
            break;

        case BotDifficulty.HARD:
            // Hard bots give fair ratings (5-9)
            baseRating = 7;
            variance = 2;
            break;

        default:
            baseRating = 6;
            variance = 2;
    }

    // Add some randomness
    const rating = baseRating + (Math.random() * variance * 2 - variance);

    // Clamp between 1-10
    return Math.max(1, Math.min(10, Math.round(rating)));
}

/**
 * Determine if bot should spin the wheel
 * (Always returns true after appropriate delay)
 * @param {string} difficulty - Bot difficulty
 * @returns {boolean} Always true (bots always spin)
 */
export function shouldBotSpin(difficulty) {
    // Bots always spin, just with different delays
    return true;
}

/**
 * Get delay before bot spins wheel
 * @param {string} difficulty - Bot difficulty
 * @returns {number} Delay in milliseconds
 */
export function getSpinDelay(difficulty) {
    return getBotDelay(difficulty);
}

/**
 * Get delay before bot selects card
 * @param {string} difficulty - Bot difficulty
 * @returns {number} Delay in milliseconds
 */
export function getCardSelectionDelay(difficulty) {
    // Slightly longer than normal delay (thinking time)
    return getBotDelay(difficulty) + 500;
}

/**
 * Get delay before bot submits rating
 * @param {string} difficulty - Bot difficulty
 * @returns {number} Delay in milliseconds
 */
export function getRatingDelay(difficulty) {
    return getBotDelay(difficulty);
}
