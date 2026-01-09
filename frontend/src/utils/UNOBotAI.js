// UNO Bot AI - Handles card playing strategy for bot players
import { BotDifficulty, getRandomElement, weightedChoice } from './BotPlayer';

/**
 * Evaluate card value for playing
 * Higher score = better to play
 * @param {Object} card - Card to evaluate
 * @param {Object} gameState - Current game state
 * @param {string} difficulty - Bot difficulty
 * @returns {number} Card score
 */
function evaluateCard(card, gameState, difficulty) {
    let score = 0;

    // Color match is good
    if (card.color === gameState.currentColor) {
        score += 10;
    }

    // Value match is good
    if (card.value === gameState.currentValue) {
        score += 8;
    }

    // Action cards are valuable
    if (card.value === 'skip') score += 5;
    if (card.value === 'reverse') score += 5;
    if (card.value === 'draw2') score += 7;
    if (card.value === 'wild_draw4') score += 9;
    if (card.value === 'wild') score += 6;

    // Hard bots consider strategy
    if (difficulty === BotDifficulty.HARD) {
        // Prefer to get rid of high-value cards
        if (card.value === 'wild_draw4') score += 3;
        if (card.value === 'draw2') score += 2;
    }

    return score;
}

/**
 * Select best card to play from hand
 * @param {Array} hand - Bot's cards
 * @param {Object} gameState - Current game state
 * @param {string} difficulty - Bot difficulty
 * @returns {Object|null} {cardIndex, card, chosenColor} or null
 */
export function selectBotCard(hand, gameState, difficulty) {
    if (!hand || hand.length === 0) {
        return null;
    }

    // Find playable cards
    const playableCards = hand.map((card, index) => ({
        card,
        index,
        score: canPlayCard(card, gameState) ? evaluateCard(card, gameState, difficulty) : -1
    })).filter(item => item.score >= 0);

    if (playableCards.length === 0) {
        return null; // Must draw
    }

    // Easy: pick random playable card
    if (difficulty === BotDifficulty.EASY) {
        const chosen = getRandomElement(playableCards);
        return {
            cardIndex: chosen.index,
            card: chosen.card,
            chosenColor: chosen.card.color === 'wild' ? selectWildColor(hand, difficulty) : null
        };
    }

    // Medium/Hard: use weighted selection
    const choices = playableCards.map(item => ({
        value: item,
        weight: item.score
    }));

    const chosen = weightedChoice(choices, difficulty);

    return {
        cardIndex: chosen.index,
        card: chosen.card,
        chosenColor: chosen.card.color === 'wild' ? selectWildColor(hand, difficulty) : null
    };
}

/**
 * Check if card can be played (matches UNO rules)
 * @param {Object} card - Card to check
 * @param {Object} gameState - Current game state
 * @returns {boolean} True if playable
 */
function canPlayCard(card, gameState) {
    // Wild cards always playable
    if (card.color === 'wild') {
        return true;
    }

    // Handle draw stack (stacking rules)
    if (gameState.drawStack > 0) {
        if (gameState.currentValue === 'draw2') {
            // On +2: can play +2 or +4
            return card.value === 'draw2' || card.value === 'wild_draw4';
        } else if (gameState.currentValue === 'wild_draw4') {
            // On +4: can only play +4
            return card.value === 'wild_draw4';
        }
        return false;
    }

    // Normal play: match color or value
    return card.color === gameState.currentColor || card.value === gameState.currentValue;
}

/**
 * Select color for wild card
 * Chooses most common color in hand
 * @param {Array} hand - Bot's cards
 * @param {string} difficulty - Bot difficulty
 * @returns {string} Color choice
 */
function selectWildColor(hand, difficulty) {
    // Easy: random color
    if (difficulty === BotDifficulty.EASY) {
        return getRandomElement(['red', 'blue', 'green', 'yellow']);
    }

    // Medium/Hard: count colors in hand
    const colorCounts = {
        red: 0,
        blue: 0,
        green: 0,
        yellow: 0
    };

    hand.forEach(card => {
        if (card.color !== 'wild') {
            colorCounts[card.color] = (colorCounts[card.color] || 0) + 1;
        }
    });

    // Pick most common color
    let maxColor = 'red';
    let maxCount = 0;

    for (const [color, count] of Object.entries(colorCounts)) {
        if (count > maxCount) {
            maxCount = count;
            maxColor = color;
        }
    }

    return maxColor;
}

/**
 * Decide whether bot should draw or play
 * @param {Array} hand - Bot's cards
 * @param {Object} gameState - Current game state
 * @param {string} difficulty - Bot difficulty
 * @returns {Object} {action: 'play'|'draw', cardIndex?, chosenColor?}
 */
export function makeBotDecision(hand, gameState, difficulty) {
    const playableCard = selectBotCard(hand, gameState, difficulty);

    if (!playableCard) {
        // No playable cards, must draw
        return { action: 'draw' };
    }

    // Easy bots sometimes draw even when they can play (mistakes)
    if (difficulty === BotDifficulty.EASY && Math.random() < 0.15) {
        return { action: 'draw' };
    }

    // Play the selected card
    return {
        action: 'play',
        cardIndex: playableCard.index,
        cardId: playableCard.card.id,
        chosenColor: playableCard.chosenColor
    };
}

/**
 * Decide if bot should call UNO
 * @param {number} handSize - Current hand size
 * @param {string} difficulty - Bot difficulty
 * @returns {boolean} True if should call UNO
 */
export function shouldCallUno(handSize, difficulty) {
    if (handSize !== 1) {
        return false;
    }

    // Easy bots sometimes forget to call UNO
    if (difficulty === BotDifficulty.EASY) {
        return Math.random() < 0.7; // 70% chance
    }

    // Medium bots usually remember
    if (difficulty === BotDifficulty.MEDIUM) {
        return Math.random() < 0.9; // 90% chance
    }

    // Hard bots always call UNO
    return true;
}
