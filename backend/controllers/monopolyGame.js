const GameRoom = require('../models/GameRoom');

// Monopoly Board Configuration (40 spaces)
const BOARD_SPACES = [
    { id: 0, type: 'go', name: 'GO', description: 'Collect $200' },
    { id: 1, type: 'property', name: 'Mediterranean Avenue', color: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50, group: 'brown' },
    { id: 2, type: 'community_chest', name: 'Community Chest' },
    { id: 3, type: 'property', name: 'Baltic Avenue', color: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50, group: 'brown' },
    { id: 4, type: 'tax', name: 'Income Tax', amount: 200 },
    { id: 5, type: 'railroad', name: 'Reading Railroad', price: 200, rent: [25, 50, 100, 200], group: 'railroad' },
    { id: 6, type: 'property', name: 'Oriental Avenue', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, group: 'lightblue' },
    { id: 7, type: 'chance', name: 'Chance' },
    { id: 8, type: 'property', name: 'Vermont Avenue', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, group: 'lightblue' },
    { id: 9, type: 'property', name: 'Connecticut Avenue', color: 'lightblue', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50, group: 'lightblue' },
    { id: 10, type: 'jail', name: 'Just Visiting / In Jail' },
    { id: 11, type: 'property', name: 'St. Charles Place', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, group: 'pink' },
    { id: 12, type: 'utility', name: 'Electric Company', price: 150, group: 'utility' },
    { id: 13, type: 'property', name: 'States Avenue', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, group: 'pink' },
    { id: 14, type: 'property', name: 'Virginia Avenue', color: 'pink', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100, group: 'pink' },
    { id: 15, type: 'railroad', name: 'Pennsylvania Railroad', price: 200, rent: [25, 50, 100, 200], group: 'railroad' },
    { id: 16, type: 'property', name: 'St. James Place', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, group: 'orange' },
    { id: 17, type: 'community_chest', name: 'Community Chest' },
    { id: 18, type: 'property', name: 'Tennessee Avenue', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, group: 'orange' },
    { id: 19, type: 'property', name: 'New York Avenue', color: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100, group: 'orange' },
    { id: 20, type: 'free_parking', name: 'Free Parking' },
    { id: 21, type: 'property', name: 'Kentucky Avenue', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, group: 'red' },
    { id: 22, type: 'chance', name: 'Chance' },
    { id: 23, type: 'property', name: 'Indiana Avenue', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, group: 'red' },
    { id: 24, type: 'property', name: 'Illinois Avenue', color: 'red', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150, group: 'red' },
    { id: 25, type: 'railroad', name: 'B. & O. Railroad', price: 200, rent: [25, 50, 100, 200], group: 'railroad' },
    { id: 26, type: 'property', name: 'Atlantic Avenue', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, group: 'yellow' },
    { id: 27, type: 'property', name: 'Ventnor Avenue', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, group: 'yellow' },
    { id: 28, type: 'utility', name: 'Water Works', price: 150, group: 'utility' },
    { id: 29, type: 'property', name: 'Marvin Gardens', color: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150, group: 'yellow' },
    { id: 30, type: 'go_to_jail', name: 'Go to Jail' },
    { id: 31, type: 'property', name: 'Pacific Avenue', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, group: 'green' },
    { id: 32, type: 'property', name: 'North Carolina Avenue', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, group: 'green' },
    { id: 33, type: 'community_chest', name: 'Community Chest' },
    { id: 34, type: 'property', name: 'Pennsylvania Avenue', color: 'green', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200, group: 'green' },
    { id: 35, type: 'railroad', name: 'Short Line', price: 200, rent: [25, 50, 100, 200], group: 'railroad' },
    { id: 36, type: 'chance', name: 'Chance' },
    { id: 37, type: 'property', name: 'Park Place', color: 'darkblue', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, group: 'darkblue' },
    { id: 38, type: 'tax', name: 'Luxury Tax', amount: 100 },
    { id: 39, type: 'property', name: 'Boardwalk', color: 'darkblue', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, group: 'darkblue' }
];

// Chance Cards
const CHANCE_CARDS = [
    { type: 'move', text: 'Advance to GO (Collect $200)', action: 'moveToGo' },
    { type: 'move', text: 'Advance to Illinois Avenue', action: 'moveTo', position: 24 },
    { type: 'move', text: 'Advance to St. Charles Place', action: 'moveTo', position: 11 },
    { type: 'move', text: 'Advance token to nearest Utility', action: 'moveToNearest', spaceType: 'utility' },
    { type: 'move', text: 'Advance token to nearest Railroad', action: 'moveToNearest', spaceType: 'railroad' },
    { type: 'money', text: 'Bank pays you dividend of $50', amount: 50 },
    { type: 'jail_free', text: 'Get Out of Jail Free', action: 'jailFree' },
    { type: 'move', text: 'Go Back 3 Spaces', action: 'moveBack', spaces: 3 },
    { type: 'jail', text: 'Go to Jail', action: 'goToJail' },
    { type: 'repairs', text: 'Make general repairs: $25 per house, $100 per hotel', houseCost: 25, hotelCost: 100 },
    { type: 'money', text: 'Pay poor tax of $15', amount: -15 },
    { type: 'move', text: 'Take a trip to Reading Railroad', action: 'moveTo', position: 5 },
    { type: 'move', text: 'Advance to Boardwalk', action: 'moveTo', position: 39 },
    { type: 'money', text: 'You have been elected Chairman of the Board. Pay each player $50', action: 'payEachPlayer', amount: 50 },
    { type: 'money', text: 'Your building loan matures. Collect $150', amount: 150 },
    { type: 'money', text: 'You have won a crossword competition. Collect $100', amount: 100 }
];

// Community Chest Cards
const COMMUNITY_CHEST_CARDS = [
    { type: 'move', text: 'Advance to GO (Collect $200)', action: 'moveToGo' },
    { type: 'money', text: 'Bank error in your favor. Collect $200', amount: 200 },
    { type: 'money', text: 'Doctor\'s fees. Pay $50', amount: -50 },
    { type: 'money', text: 'From sale of stock you get $50', amount: 50 },
    { type: 'jail_free', text: 'Get Out of Jail Free', action: 'jailFree' },
    { type: 'jail', text: 'Go to Jail', action: 'goToJail' },
    { type: 'money', text: 'Grand Opera Night. Collect $50 from every player', action: 'collectFromEachPlayer', amount: 50 },
    { type: 'money', text: 'Holiday Fund matures. Receive $100', amount: 100 },
    { type: 'money', text: 'Income tax refund. Collect $20', amount: 20 },
    { type: 'money', text: 'It is your birthday. Collect $10 from every player', action: 'collectFromEachPlayer', amount: 10 },
    { type: 'money', text: 'Life insurance matures. Collect $100', amount: 100 },
    { type: 'money', text: 'Hospital fees. Pay $100', amount: -100 },
    { type: 'money', text: 'School fees. Pay $50', amount: -50 },
    { type: 'money', text: 'Receive $25 consultancy fee', amount: 25 },
    { type: 'repairs', text: 'You are assessed for street repairs: $40 per house, $115 per hotel', houseCost: 40, hotelCost: 115 },
    { type: 'money', text: 'You have won second prize in a beauty contest. Collect $10', amount: 10 }
];

// Initialize Monopoly Game
function initMonopolyGame(players) {
    console.log('🎲 Initializing Monopoly game for players:', players.map(p => p.username || p));

    const playerNames = players.map(p => typeof p === 'string' ? p : p.username);

    // Shuffle card decks
    const chanceCards = shuffleArray([...CHANCE_CARDS]);
    const communityChestCards = shuffleArray([...COMMUNITY_CHEST_CARDS]);

    const gameState = {
        board: BOARD_SPACES,
        players: playerNames.map((name, index) => ({
            username: name,
            name: name,
            money: 1500,
            position: 0,
            properties: [],
            railroads: [],
            utilities: [],
            houses: {}, // propertyId: houseCount (0-4, 5 = hotel)
            inJail: false,
            jailTurns: 0,
            getOutOfJailCards: 0,
            doublesCount: 0,
            isBankrupt: false,
            isBot: players[index]?.isBot || false,
            difficulty: players[index]?.difficulty || 'medium'
        })),
        currentPlayerIndex: 0,
        currentPlayer: playerNames[0],
        diceRoll: null,
        lastRoll: { dice1: 0, dice2: 0, total: 0, isDoubles: false },
        turnPhase: 'roll', // 'roll', 'action', 'end'
        chanceCards,
        communityChestCards,
        chanceDiscardPile: [],
        communityChestDiscardPile: [],
        properties: {}, // propertyId: { owner, houses, mortgaged }
        gameOver: false,
        winner: null,
        activePlayers: playerNames.length,
        pendingAction: null // For actions that need player response
    };

    // Initialize properties
    BOARD_SPACES.forEach(space => {
        if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
            gameState.properties[space.id] = {
                owner: null,
                houses: 0,
                mortgaged: false
            };
        }
    });

    console.log('✅ Monopoly game initialized');
    return gameState;
}

// Shuffle array helper
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Roll Dice
function rollDice(gameState, username) {
    console.log('🎲 Rolling dice for:', username);

    if (gameState.currentPlayer !== username) {
        return { success: false, message: 'Not your turn' };
    }

    if (gameState.turnPhase !== 'roll') {
        return { success: false, message: 'Cannot roll now' };
    }

    const player = gameState.players.find(p => p.username === username);
    if (!player) {
        return { success: false, message: 'Player not found' };
    }

    // Roll two dice
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2;
    const isDoubles = dice1 === dice2;

    gameState.lastRoll = { dice1, dice2, total, isDoubles };

    console.log(`🎲 Rolled: ${dice1} + ${dice2} = ${total} ${isDoubles ? '(DOUBLES!)' : ''}`);

    // Handle jail
    if (player.inJail) {
        if (isDoubles) {
            console.log('🔓 Rolled doubles - getting out of jail!');
            player.inJail = false;
            player.jailTurns = 0;
            player.doublesCount = 0;
            // Move player
            movePlayer(gameState, player, total);
            gameState.turnPhase = 'action';
        } else {
            player.jailTurns++;
            if (player.jailTurns >= 3) {
                console.log('⚠️ 3 turns in jail - must pay $50');
                player.money -= 50;
                player.inJail = false;
                player.jailTurns = 0;
                movePlayer(gameState, player, total);
                gameState.turnPhase = 'action';
            } else {
                console.log(`🔒 Still in jail (turn ${player.jailTurns}/3)`);
                gameState.turnPhase = 'end';
            }
        }
        return { success: true, gameState, roll: gameState.lastRoll };
    }

    // Handle doubles
    if (isDoubles) {
        player.doublesCount++;
        console.log(`🎲 Doubles count: ${player.doublesCount}`);

        if (player.doublesCount >= 3) {
            console.log('🚔 Three doubles in a row - Go to Jail!');
            sendToJail(gameState, player);
            player.doublesCount = 0;
            gameState.turnPhase = 'end';
            return { success: true, gameState, roll: gameState.lastRoll, threeDoubles: true };
        }
    } else {
        player.doublesCount = 0;
    }

    // Move player
    movePlayer(gameState, player, total);
    gameState.turnPhase = 'action';

    return { success: true, gameState, roll: gameState.lastRoll };
}

// Move Player
function movePlayer(gameState, player, spaces) {
    const oldPosition = player.position;
    player.position = (player.position + spaces) % 40;

    console.log(`🚶 ${player.username} moved from ${oldPosition} to ${player.position}`);

    // Check if passed GO
    if (player.position < oldPosition || (oldPosition + spaces >= 40)) {
        console.log('💰 Passed GO! Collect $200');
        player.money += 200;
    }

    // Handle landing on space
    const space = BOARD_SPACES[player.position];
    handleLandOnSpace(gameState, player, space);
}

// Handle Landing on Space
function handleLandOnSpace(gameState, player, space) {
    console.log(`📍 ${player.username} landed on: ${space.name} (${space.type})`);

    switch (space.type) {
        case 'go':
            // Already collected $200 in movePlayer
            break;

        case 'property':
        case 'railroad':
        case 'utility':
            const propertyState = gameState.properties[space.id];
            if (!propertyState.owner) {
                // Unowned - offer to buy
                gameState.pendingAction = {
                    type: 'buy_property',
                    spaceId: space.id,
                    player: player.username
                };
            } else if (propertyState.owner !== player.username && !propertyState.mortgaged) {
                // Owned by someone else - pay rent
                const rent = calculateRent(gameState, space, propertyState);
                payRent(gameState, player.username, propertyState.owner, rent);
            }
            break;

        case 'chance':
            drawCard(gameState, player, 'chance');
            break;

        case 'community_chest':
            drawCard(gameState, player, 'community_chest');
            break;

        case 'tax':
            console.log(`💸 Tax: Pay $${space.amount}`);
            player.money -= space.amount;
            if (player.money < 0) {
                handleBankruptcy(gameState, player.username);
            }
            break;

        case 'go_to_jail':
            sendToJail(gameState, player);
            break;

        case 'jail':
            // Just visiting
            console.log('👀 Just visiting jail');
            break;

        case 'free_parking':
            console.log('🅿️ Free parking - nothing happens');
            break;
    }
}

// Calculate Rent
function calculateRent(gameState, space, propertyState) {
    if (space.type === 'property') {
        const houses = propertyState.houses;
        return space.rent[houses];
    } else if (space.type === 'railroad') {
        // Count railroads owned by same owner
        const owner = propertyState.owner;
        const railroadsOwned = Object.values(gameState.properties).filter(
            p => p.owner === owner && BOARD_SPACES.find(s => s.id === parseInt(Object.keys(gameState.properties).find(key => gameState.properties[key] === p)))?.type === 'railroad'
        ).length;
        return space.rent[railroadsOwned - 1];
    } else if (space.type === 'utility') {
        // Count utilities owned by same owner
        const owner = propertyState.owner;
        const utilitiesOwned = Object.values(gameState.properties).filter(
            p => p.owner === owner && BOARD_SPACES.find(s => s.id === parseInt(Object.keys(gameState.properties).find(key => gameState.properties[key] === p)))?.type === 'utility'
        ).length;
        const multiplier = utilitiesOwned === 1 ? 4 : 10;
        return gameState.lastRoll.total * multiplier;
    }
    return 0;
}

// Pay Rent
function payRent(gameState, payerUsername, ownerUsername, amount) {
    console.log(`💰 ${payerUsername} pays $${amount} rent to ${ownerUsername}`);

    const payer = gameState.players.find(p => p.username === payerUsername);
    const owner = gameState.players.find(p => p.username === ownerUsername);

    if (!payer || !owner) return { success: false, message: 'Player not found' };

    payer.money -= amount;
    owner.money += amount;

    if (payer.money < 0) {
        handleBankruptcy(gameState, payerUsername, ownerUsername);
    }

    return { success: true, gameState };
}

// Buy Property
function buyProperty(gameState, username, spaceId) {
    console.log(`🏠 ${username} attempting to buy property ${spaceId}`);

    const player = gameState.players.find(p => p.username === username);
    const space = BOARD_SPACES[spaceId];
    const propertyState = gameState.properties[spaceId];

    if (!player || !space || !propertyState) {
        return { success: false, message: 'Invalid property' };
    }

    // CRITICAL: Check if player is actually on this property
    if (player.position !== spaceId) {
        console.log(`❌ ${username} is not on property ${spaceId} (current position: ${player.position})`);
        return { success: false, message: 'You must be on the property to buy it' };
    }

    if (propertyState.owner) {
        return { success: false, message: 'Property already owned' };
    }

    if (player.money < space.price) {
        return { success: false, message: 'Not enough money' };
    }

    // Purchase property
    player.money -= space.price;
    propertyState.owner = username;

    if (space.type === 'property') {
        player.properties.push(spaceId);
    } else if (space.type === 'railroad') {
        player.railroads.push(spaceId);
    } else if (space.type === 'utility') {
        player.utilities.push(spaceId);
    }

    console.log(`✅ ${username} bought ${space.name} for $${space.price}`);

    gameState.pendingAction = null;
    return { success: true, gameState };
}

// Draw Card
function drawCard(gameState, player, cardType) {
    const deck = cardType === 'chance' ? gameState.chanceCards : gameState.communityChestCards;
    const discardPile = cardType === 'chance' ? gameState.chanceDiscardPile : gameState.communityChestDiscardPile;

    if (deck.length === 0) {
        // Reshuffle discard pile
        const reshuffled = shuffleArray(discardPile);
        if (cardType === 'chance') {
            gameState.chanceCards = reshuffled;
            gameState.chanceDiscardPile = [];
        } else {
            gameState.communityChestCards = reshuffled;
            gameState.communityChestDiscardPile = [];
        }
    }

    const card = deck.shift();
    console.log(`🎴 Drew ${cardType} card: ${card.text}`);

    // Execute card action
    executeCardAction(gameState, player, card);

    // Discard card (unless it's Get Out of Jail Free)
    if (card.type !== 'jail_free') {
        discardPile.push(card);
    }

    return { success: true, gameState, card };
}

// Execute Card Action
function executeCardAction(gameState, player, card) {
    switch (card.type) {
        case 'money':
            player.money += card.amount;
            if (player.money < 0) {
                handleBankruptcy(gameState, player.username);
            }
            break;

        case 'move':
            if (card.action === 'moveToGo') {
                player.position = 0;
                player.money += 200;
            } else if (card.action === 'moveTo') {
                const oldPos = player.position;
                player.position = card.position;
                if (player.position < oldPos) {
                    player.money += 200; // Passed GO
                }
                handleLandOnSpace(gameState, player, BOARD_SPACES[player.position]);
            } else if (card.action === 'moveBack') {
                player.position = (player.position - card.spaces + 40) % 40;
                handleLandOnSpace(gameState, player, BOARD_SPACES[player.position]);
            } else if (card.action === 'moveToNearest') {
                // Find nearest space of type
                let nearestPos = player.position;
                for (let i = 1; i <= 40; i++) {
                    const checkPos = (player.position + i) % 40;
                    if (BOARD_SPACES[checkPos].type === card.spaceType) {
                        nearestPos = checkPos;
                        break;
                    }
                }
                const oldPos = player.position;
                player.position = nearestPos;
                if (nearestPos < oldPos) {
                    player.money += 200; // Passed GO
                }
                handleLandOnSpace(gameState, player, BOARD_SPACES[nearestPos]);
            }
            break;

        case 'jail':
            sendToJail(gameState, player);
            break;

        case 'jail_free':
            player.getOutOfJailCards++;
            console.log(`🎫 ${player.username} got a Get Out of Jail Free card`);
            break;

        case 'repairs':
            const totalHouses = Object.values(player.houses).reduce((sum, count) => sum + (count < 5 ? count : 0), 0);
            const totalHotels = Object.values(player.houses).reduce((sum, count) => sum + (count === 5 ? 1 : 0), 0);
            const repairCost = (totalHouses * card.houseCost) + (totalHotels * card.hotelCost);
            player.money -= repairCost;
            console.log(`🔧 Repair cost: $${repairCost}`);
            if (player.money < 0) {
                handleBankruptcy(gameState, player.username);
            }
            break;
    }
}

// Send to Jail
function sendToJail(gameState, player) {
    console.log(`🚔 ${player.username} sent to jail`);
    player.position = 10; // Jail position
    player.inJail = true;
    player.jailTurns = 0;
    player.doublesCount = 0;
}

// Build House
function buildHouse(gameState, username, spaceId) {
    const player = gameState.players.find(p => p.username === username);
    const space = BOARD_SPACES[spaceId];
    const propertyState = gameState.properties[spaceId];

    if (!player || !space || space.type !== 'property') {
        return { success: false, message: 'Invalid property' };
    }

    if (propertyState.owner !== username) {
        return { success: false, message: 'You do not own this property' };
    }

    // Check if player owns all properties in color group
    const colorGroup = BOARD_SPACES.filter(s => s.type === 'property' && s.group === space.group);
    const ownsAll = colorGroup.every(s => gameState.properties[s.id].owner === username);

    if (!ownsAll) {
        return { success: false, message: 'Must own all properties in color group' };
    }

    // Check current house count
    const currentHouses = propertyState.houses || 0;
    if (currentHouses >= 5) {
        return { success: false, message: 'Already has hotel' };
    }

    // Check money
    if (player.money < space.houseCost) {
        return { success: false, message: 'Not enough money' };
    }

    // Build house
    player.money -= space.houseCost;
    propertyState.houses = currentHouses + 1;
    player.houses[spaceId] = propertyState.houses;

    console.log(`🏠 ${username} built house on ${space.name} (${propertyState.houses}/5)`);

    return { success: true, gameState };
}

// Mortgage Property
function mortgageProperty(gameState, username, spaceId) {
    const player = gameState.players.find(p => p.username === username);
    const space = BOARD_SPACES[spaceId];
    const propertyState = gameState.properties[spaceId];

    if (!player || !space) {
        return { success: false, message: 'Invalid property' };
    }

    if (propertyState.owner !== username) {
        return { success: false, message: 'You do not own this property' };
    }

    if (propertyState.mortgaged) {
        return { success: false, message: 'Already mortgaged' };
    }

    if (propertyState.houses > 0) {
        return { success: false, message: 'Must sell houses first' };
    }

    // Mortgage property
    const mortgageValue = Math.floor(space.price / 2);
    player.money += mortgageValue;
    propertyState.mortgaged = true;

    console.log(`💵 ${username} mortgaged ${space.name} for $${mortgageValue}`);

    return { success: true, gameState };
}

// End Turn
function endTurn(gameState, username) {
    if (gameState.currentPlayer !== username) {
        return { success: false, message: 'Not your turn' };
    }

    const player = gameState.players.find(p => p.username === username);

    // If rolled doubles and not in jail, can roll again
    if (gameState.lastRoll.isDoubles && !player.inJail && player.doublesCount < 3) {
        console.log('🎲 Rolled doubles - roll again!');
        gameState.turnPhase = 'roll';
        return { success: true, gameState, rollAgain: true };
    }

    // Move to next player
    player.doublesCount = 0;

    let nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;

    // Skip bankrupt players
    while (gameState.players[nextIndex].isBankrupt) {
        nextIndex = (nextIndex + 1) % gameState.players.length;
    }

    gameState.currentPlayerIndex = nextIndex;
    gameState.currentPlayer = gameState.players[nextIndex].username;
    gameState.turnPhase = 'roll';
    gameState.pendingAction = null;

    console.log(`➡️ Turn passed to ${gameState.currentPlayer}`);

    return { success: true, gameState };
}

// Handle Bankruptcy
function handleBankruptcy(gameState, username, creditor = null) {
    console.log(`💸 ${username} is bankrupt!`);

    const player = gameState.players.find(p => p.username === username);
    if (!player) return;

    player.isBankrupt = true;
    gameState.activePlayers--;

    // Transfer properties
    Object.keys(gameState.properties).forEach(spaceId => {
        const propertyState = gameState.properties[spaceId];
        if (propertyState.owner === username) {
            if (creditor) {
                // Transfer to creditor
                propertyState.owner = creditor;
                const creditorPlayer = gameState.players.find(p => p.username === creditor);
                const space = BOARD_SPACES[parseInt(spaceId)];
                if (space.type === 'property') {
                    creditorPlayer.properties.push(parseInt(spaceId));
                } else if (space.type === 'railroad') {
                    creditorPlayer.railroads.push(parseInt(spaceId));
                } else if (space.type === 'utility') {
                    creditorPlayer.utilities.push(parseInt(spaceId));
                }
            } else {
                // Return to bank
                propertyState.owner = null;
                propertyState.houses = 0;
                propertyState.mortgaged = false;
            }
        }
    });

    // Check for game over
    if (gameState.activePlayers === 1) {
        const winner = gameState.players.find(p => !p.isBankrupt);
        gameState.gameOver = true;
        gameState.winner = winner.username;
        console.log(`🏆 ${winner.username} wins!`);
    }

    return { success: true, gameState };
}

// Use Get Out of Jail Free Card
function useJailCard(gameState, username) {
    const player = gameState.players.find(p => p.username === username);

    if (!player || !player.inJail) {
        return { success: false, message: 'Not in jail' };
    }

    if (player.getOutOfJailCards === 0) {
        return { success: false, message: 'No Get Out of Jail Free cards' };
    }

    player.getOutOfJailCards--;
    player.inJail = false;
    player.jailTurns = 0;

    console.log(`🎫 ${username} used Get Out of Jail Free card`);

    return { success: true, gameState };
}

// Pay Jail Fee
function payJailFee(gameState, username) {
    const player = gameState.players.find(p => p.username === username);

    if (!player || !player.inJail) {
        return { success: false, message: 'Not in jail' };
    }

    if (player.money < 50) {
        return { success: false, message: 'Not enough money' };
    }

    player.money -= 50;
    player.inJail = false;
    player.jailTurns = 0;

    console.log(`💵 ${username} paid $50 to get out of jail`);

    return { success: true, gameState };
}

module.exports = {
    initMonopolyGame,
    rollDice,
    buyProperty,
    payRent,
    buildHouse,
    mortgageProperty,
    endTurn,
    useJailCard,
    payJailFee,
    BOARD_SPACES
};
