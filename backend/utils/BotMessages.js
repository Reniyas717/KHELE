// Bot Messages - Fun chat messages for bot players
// Organized by event type and difficulty level

const BOT_MESSAGES = {
    onPlay: {
        easy: [
            "Here goes!",
            "My turn!",
            "Playing this one",
            "Hope this works!",
            "Let's try this",
            "Hmm, okay!"
        ],
        medium: [
            "Good move",
            "This should work",
            "Let's see...",
            "Calculated risk",
            "Interesting play",
            "Strategic choice"
        ],
        hard: [
            "Calculated",
            "Perfect play",
            "As planned",
            "Optimal move",
            "GG",
            "Checkmate"
        ]
    },
    onDraw: {
        easy: [
            "Oops",
            "No cards :(",
            "Drawing...",
            "Need more cards",
            "Darn it!",
            "Oh well"
        ],
        medium: [
            "Strategic draw",
            "Building my hand",
            "Patience...",
            "Setting up",
            "Interesting...",
            "Tactical decision"
        ],
        hard: [
            "As expected",
            "All according to plan",
            "Calculated draw",
            "Perfect timing",
            "Setting the trap",
            "You'll see"
        ]
    },
    onUNO: {
        easy: [
            "UNO!",
            "One card!",
            "Almost there!",
            "So close!",
            "One left!",
            "UNO! :D"
        ],
        medium: [
            "UNO! Watch out!",
            "One card left!",
            "Getting close!",
            "UNO! Be ready!",
            "Almost won!",
            "One more to go!"
        ],
        hard: [
            "UNO. Your move.",
            "One card. Good luck.",
            "Victory incoming.",
            "UNO. Inevitable.",
            "One card. GG.",
            "Endgame."
        ]
    },
    onWin: {
        easy: [
            "I won! :D",
            "Yay!",
            "That was fun!",
            "Woohoo!",
            "I did it!",
            "Victory!"
        ],
        medium: [
            "Good game!",
            "Victory!",
            "Well played!",
            "GG everyone!",
            "That was close!",
            "Nice match!"
        ],
        hard: [
            "GG",
            "As expected",
            "Too easy",
            "Flawless victory",
            "Calculated win",
            "Inevitable"
        ]
    },
    onFinish: {
        easy: [
            "Done!",
            "Finished!",
            "All out!",
            "No more cards!",
            "I'm done!",
            "Yay, finished!"
        ],
        medium: [
            "Finished! Good luck!",
            "Out of cards!",
            "Done playing!",
            "That's it for me!",
            "Finished my hand!",
            "All cards played!"
        ],
        hard: [
            "Finished. As planned.",
            "Out. Continue.",
            "Done. Your turn.",
            "Completed.",
            "Finished. GG.",
            "Out of the game."
        ]
    }
};

/**
 * Get a random bot message for an event
 * @param {string} event - Event type (onPlay, onDraw, onUNO, onWin, onFinish)
 * @param {string} difficulty - Bot difficulty (easy, medium, hard)
 * @returns {string} Random message
 */
function getBotMessage(event, difficulty = 'medium') {
    const messages = BOT_MESSAGES[event]?.[difficulty] || BOT_MESSAGES[event]?.medium || [];
    if (messages.length === 0) return '';

    return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Should bot send a message? (70% chance)
 * @returns {boolean}
 */
function shouldSendMessage() {
    return Math.random() < 0.7;
}

module.exports = {
    getBotMessage,
    shouldSendMessage,
    BOT_MESSAGES
};
