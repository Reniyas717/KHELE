// Monopoly Bot AI
// Implements strategic decision-making for bot players in Monopoly

/**
 * Make a bot decision for Monopoly
 * @param {Object} gameState - Current game state
 * @param {Object} botPlayer - The bot player object
 * @param {string} difficulty - Bot difficulty: 'easy', 'medium', 'hard'
 * @returns {Object} Decision object with action and parameters
 */
function makeBotDecision(gameState, botPlayer, difficulty = 'medium') {
    console.log(`🤖 ${botPlayer.username} (${difficulty}) making decision...`);

    const currentSpace = gameState.board[botPlayer.position];
    const pendingAction = gameState.pendingAction;

    // Handle pending actions first
    if (pendingAction && pendingAction.player === botPlayer.username) {
        if (pendingAction.type === 'buy_property') {
            return decideBuyProperty(gameState, botPlayer, currentSpace, difficulty);
        }
    }

    // If in jail, decide how to get out
    if (botPlayer.inJail) {
        return decideJailAction(gameState, botPlayer, difficulty);
    }

    // Default: end turn or build houses
    return decideBuildOrEndTurn(gameState, botPlayer, difficulty);
}

/**
 * Decide whether to buy a property
 */
function decideBuyProperty(gameState, botPlayer, space, difficulty) {
    const price = space.price;
    const money = botPlayer.money;

    // Calculate if we can afford it
    const canAfford = money >= price;

    // Reserve some money for rent/taxes
    const reserveAmount = difficulty === 'easy' ? 200 : difficulty === 'medium' ? 300 : 500;
    const shouldBuy = canAfford && (money - price) >= reserveAmount;

    // Easy bots: buy if they can afford + reserve
    if (difficulty === 'easy') {
        if (shouldBuy) {
            console.log(`🤖 Easy bot buying ${space.name}`);
            return { action: 'buy', spaceId: space.id };
        }
        return { action: 'skip' };
    }

    // Medium bots: consider property value and color groups
    if (difficulty === 'medium') {
        if (!canAfford) return { action: 'skip' };

        // Check if we already own properties in this color group
        const colorGroup = gameState.board.filter(s =>
            s.type === 'property' && s.group === space.group
        );
        const ownedInGroup = colorGroup.filter(s =>
            gameState.properties[s.id]?.owner === botPlayer.username
        ).length;

        // Prioritize completing color groups
        if (ownedInGroup > 0 && shouldBuy) {
            console.log(`🤖 Medium bot buying ${space.name} to complete color group`);
            return { action: 'buy', spaceId: space.id };
        }

        // Buy railroads and utilities
        if ((space.type === 'railroad' || space.type === 'utility') && shouldBuy) {
            console.log(`🤖 Medium bot buying ${space.name} (railroad/utility)`);
            return { action: 'buy', spaceId: space.id };
        }

        // Buy if price is reasonable
        if (price <= 200 && shouldBuy) {
            console.log(`🤖 Medium bot buying cheap property ${space.name}`);
            return { action: 'buy', spaceId: space.id };
        }

        return { action: 'skip' };
    }

    // Hard bots: strategic buying based on ROI and monopoly potential
    if (difficulty === 'hard') {
        if (!canAfford) return { action: 'skip' };

        // Calculate strategic value
        const strategicValue = calculatePropertyValue(gameState, botPlayer, space);

        // Buy if strategic value is high enough
        if (strategicValue > 0.6 && shouldBuy) {
            console.log(`🤖 Hard bot buying ${space.name} (strategic value: ${strategicValue.toFixed(2)})`);
            return { action: 'buy', spaceId: space.id };
        }

        return { action: 'skip' };
    }

    return { action: 'skip' };
}

/**
 * Calculate strategic value of a property (0-1)
 */
function calculatePropertyValue(gameState, botPlayer, space) {
    let value = 0.5; // Base value

    if (space.type === 'property') {
        // Check color group completion potential
        const colorGroup = gameState.board.filter(s =>
            s.type === 'property' && s.group === space.group
        );
        const ownedInGroup = colorGroup.filter(s =>
            gameState.properties[s.id]?.owner === botPlayer.username
        ).length;
        const totalInGroup = colorGroup.length;

        // Higher value if we own more of the group
        value += (ownedInGroup / totalInGroup) * 0.3;

        // Check if opponents own properties in this group
        const opponentOwnsInGroup = colorGroup.some(s => {
            const owner = gameState.properties[s.id]?.owner;
            return owner && owner !== botPlayer.username;
        });

        // Lower value if opponent is collecting this group
        if (opponentOwnsInGroup) {
            value -= 0.2;
        }

        // Higher value for cheaper properties (better ROI)
        if (space.price <= 150) value += 0.1;
        if (space.price <= 100) value += 0.1;
    }

    if (space.type === 'railroad') {
        // Count railroads owned
        const railroadsOwned = botPlayer.railroads.length;
        value = 0.6 + (railroadsOwned * 0.1);
    }

    if (space.type === 'utility') {
        // Count utilities owned
        const utilitiesOwned = botPlayer.utilities.length;
        value = 0.5 + (utilitiesOwned * 0.2);
    }

    return Math.min(value, 1.0);
}

/**
 * Decide how to get out of jail
 */
function decideJailAction(gameState, botPlayer, difficulty) {
    const hasCard = botPlayer.getOutOfJailCards > 0;
    const hasMoney = botPlayer.money >= 50;
    const jailTurns = botPlayer.jailTurns;

    // Easy bots: pay immediately if they have money
    if (difficulty === 'easy') {
        if (hasMoney) {
            console.log(`🤖 Easy bot paying to get out of jail`);
            return { action: 'pay_jail' };
        }
        if (hasCard) {
            console.log(`🤖 Easy bot using jail card`);
            return { action: 'use_jail_card' };
        }
        return { action: 'roll' }; // Try to roll doubles
    }

    // Medium bots: use card if available, otherwise wait 1-2 turns
    if (difficulty === 'medium') {
        if (hasCard) {
            console.log(`🤖 Medium bot using jail card`);
            return { action: 'use_jail_card' };
        }
        if (jailTurns >= 2 && hasMoney) {
            console.log(`🤖 Medium bot paying after 2 turns`);
            return { action: 'pay_jail' };
        }
        return { action: 'roll' }; // Try to roll doubles
    }

    // Hard bots: strategic - save card for emergencies, wait 2 turns
    if (difficulty === 'hard') {
        // Only use card if low on money
        if (hasCard && botPlayer.money < 200) {
            console.log(`🤖 Hard bot using jail card (low money)`);
            return { action: 'use_jail_card' };
        }
        // Pay on last turn
        if (jailTurns >= 2 && hasMoney) {
            console.log(`🤖 Hard bot paying on last turn`);
            return { action: 'pay_jail' };
        }
        return { action: 'roll' }; // Try to roll doubles
    }

    return { action: 'roll' };
}

/**
 * Decide whether to build houses or end turn
 */
function decideBuildOrEndTurn(gameState, botPlayer, difficulty) {
    // Check if we can build houses
    const ownedProperties = botPlayer.properties;

    // Easy bots: don't build houses
    if (difficulty === 'easy') {
        return { action: 'end_turn' };
    }

    // Medium and Hard bots: try to build houses
    if (difficulty === 'medium' || difficulty === 'hard') {
        // Find complete color groups
        const completeGroups = findCompleteColorGroups(gameState, botPlayer);

        for (const group of completeGroups) {
            // Find property with fewest houses
            let minHouses = 5;
            let propertyToBuild = null;

            for (const propId of group.properties) {
                const space = gameState.board[propId];
                const houses = gameState.properties[propId].houses || 0;

                if (houses < minHouses && houses < 5) {
                    minHouses = houses;
                    propertyToBuild = space;
                }
            }

            // Check if we can afford to build
            if (propertyToBuild && botPlayer.money >= propertyToBuild.houseCost + 200) {
                console.log(`🤖 ${difficulty} bot building house on ${propertyToBuild.name}`);
                return { action: 'build_house', spaceId: propertyToBuild.id };
            }
        }
    }

    // Default: end turn
    return { action: 'end_turn' };
}

/**
 * Find complete color groups owned by bot
 */
function findCompleteColorGroups(gameState, botPlayer) {
    const groups = {};

    // Group properties by color
    for (const propId of botPlayer.properties) {
        const space = gameState.board[propId];
        if (space.type === 'property') {
            if (!groups[space.group]) {
                groups[space.group] = [];
            }
            groups[space.group].push(propId);
        }
    }

    // Find complete groups
    const completeGroups = [];
    for (const [group, properties] of Object.entries(groups)) {
        const totalInGroup = gameState.board.filter(s =>
            s.type === 'property' && s.group === group
        ).length;

        if (properties.length === totalInGroup) {
            completeGroups.push({ group, properties });
        }
    }

    return completeGroups;
}

/**
 * Execute bot turn
 * @param {Object} gameState - Current game state
 * @param {Object} botPlayer - The bot player
 * @param {Function} sendAction - Function to send action to server
 * @param {string} difficulty - Bot difficulty
 */
async function executeBotTurn(gameState, botPlayer, sendAction, difficulty = 'medium') {
    console.log(`🤖 ${botPlayer.username} executing turn...`);

    // Add delay based on difficulty (for realism)
    const delay = difficulty === 'easy' ? 2000 : difficulty === 'medium' ? 1500 : 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    const decision = makeBotDecision(gameState, botPlayer, difficulty);

    switch (decision.action) {
        case 'buy':
            sendAction('MONOPOLY_BUY_PROPERTY', { spaceId: decision.spaceId });
            break;
        case 'build_house':
            sendAction('MONOPOLY_BUILD_HOUSE', { spaceId: decision.spaceId });
            break;
        case 'pay_jail':
            sendAction('MONOPOLY_PAY_JAIL_FEE', {});
            break;
        case 'use_jail_card':
            sendAction('MONOPOLY_USE_JAIL_CARD', {});
            break;
        case 'end_turn':
            sendAction('MONOPOLY_END_TURN', {});
            break;
        case 'skip':
            // Skip buying, just end turn
            await new Promise(resolve => setTimeout(resolve, 500));
            sendAction('MONOPOLY_END_TURN', {});
            break;
        case 'roll':
            // This is handled by the game logic
            break;
    }
}

module.exports = {
    makeBotDecision,
    executeBotTurn,
    decideBuyProperty,
    decideJailAction,
    decideBuildOrEndTurn
};
