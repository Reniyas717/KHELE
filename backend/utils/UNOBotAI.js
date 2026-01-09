// UNO Bot AI - Server-side version for backend use
// Handles card playing strategy for bot players

/**
 * Evaluate card value for playing
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
    if (difficulty === 'hard') {
        if (card.value === 'wild_draw4') score += 3;
        if (card.value === 'draw2') score += 2;
    }

    return score;
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
            return card.value === 'draw2' || card.value === 'wild_draw4';
        } else if (gameState.currentValue === 'wild_draw4') {
            return card.value === 'wild_draw4';
        }
        return false;
    }

    // Normal play: match color or value
    return card.color === gameState.currentColor || card.value === gameState.currentValue;
}

/**
 * Select best card to play from hand
 * @param {Array} hand - Bot's cards
 * @param {Object} gameState - Current game state
 * @param {string} difficulty - Bot difficulty
 * @returns {Object|null} {cardIndex, card, chosenColor} or null
 */
function selectBotCard(hand, gameState, difficulty) {
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
        return null;
    }

    // Easy: pick random playable card
    if (difficulty === 'easy') {
        const chosen = playableCards[Math.floor(Math.random() * playableCards.length)];
        return {
            index: chosen.index,  // Changed from cardIndex to index
            card: chosen.card,
            chosenColor: chosen.card.color === 'wild' ? selectWildColor(hand, difficulty) : null
        };
    }

    // Medium/Hard: pick best card
    playableCards.sort((a, b) => b.score - a.score);
    const chosen = playableCards[0];

    return {
        index: chosen.index,  // Changed from cardIndex to index
        card: chosen.card,
        chosenColor: chosen.card.color === 'wild' ? selectWildColor(hand, difficulty) : null
    };
}

/**
 * Select color for wild card
 * @param {Array} hand - Bot's cards
 * @param {string} difficulty - Bot difficulty
 * @returns {string} Color choice
 */
function selectWildColor(hand, difficulty) {
    const colors = ['red', 'blue', 'green', 'yellow'];

    // Easy: random color
    if (difficulty === 'easy') {
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Medium/Hard: count colors in hand
    const colorCounts = { red: 0, blue: 0, green: 0, yellow: 0 };

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
 * Make bot decision for UNO turn
 * @param {Array} hand - Bot's cards
 * @param {Object} gameState - Current game state
 * @param {string} difficulty - Bot difficulty
 * @returns {Object} {action: 'play'|'draw', cardIndex?, cardId?, chosenColor?}
 */
function makeBotDecision(hand, gameState, difficulty) {
    console.log('🤖 makeBotDecision called with:', {
        handSize: hand?.length,
        difficulty,
        currentColor: gameState.currentColor,
        currentValue: gameState.currentValue
    });

    const playableCard = selectBotCard(hand, gameState, difficulty);

    console.log('🤖 selectBotCard returned:', playableCard);

    if (!playableCard) {
        console.log('🤖 No playable card, drawing');
        return { action: 'draw' };
    }

    // Easy bots sometimes draw even when they can play
    if (difficulty === 'easy' && Math.random() < 0.15) {
        console.log('🤖 Easy bot randomly choosing to draw');
        return { action: 'draw' };
    }

    const decision = {
        action: 'play',
        cardIndex: playableCard.index,
        cardId: playableCard.card?.id,
        chosenColor: playableCard.chosenColor
    };

    console.log('🤖 Final decision:', decision);
    return decision;
}

module.exports = {
    makeBotDecision,
    selectBotCard,
    canPlayCard
};
