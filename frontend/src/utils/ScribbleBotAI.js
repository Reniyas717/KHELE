// Scribble Bot AI - Handles drawing and guessing for bot players
import { BotDifficulty, getBotDelay, getRandomElement, weightedChoice } from './BotPlayer';

/**
 * Simple drawing patterns for bots
 * Bots draw basic shapes to represent words
 */
const DRAWING_PATTERNS = {
    // Basic shapes
    circle: (ctx, x, y, size) => {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.stroke();
    },
    square: (ctx, x, y, size) => {
        ctx.strokeRect(x - size / 2, y - size / 2, size, size);
    },
    triangle: (ctx, x, y, size) => {
        ctx.beginPath();
        ctx.moveTo(x, y - size / 2);
        ctx.lineTo(x - size / 2, y + size / 2);
        ctx.lineTo(x + size / 2, y + size / 2);
        ctx.closePath();
        ctx.stroke();
    },
    line: (ctx, x1, y1, x2, y2) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
};

/**
 * Generate simple drawing for a word
 * Bots draw basic representations (not actual drawings)
 * @param {string} word - Word to draw
 * @param {string} difficulty - Bot difficulty
 * @returns {Array} Array of drawing commands
 */
export function generateBotDrawing(word, difficulty) {
    const commands = [];
    const canvasWidth = 800;
    const canvasHeight = 600;

    // Number of shapes based on difficulty
    const shapeCount = difficulty === BotDifficulty.EASY ? 2 :
        difficulty === BotDifficulty.MEDIUM ? 3 : 4;

    // Generate random shapes
    for (let i = 0; i < shapeCount; i++) {
        const x = Math.random() * (canvasWidth - 100) + 50;
        const y = Math.random() * (canvasHeight - 100) + 50;
        const size = 30 + Math.random() * 50;

        const shapes = ['circle', 'square', 'triangle'];
        const shape = getRandomElement(shapes);

        commands.push({
            type: shape,
            x,
            y,
            size,
            color: getRandomElement(['#000000', '#FF0000', '#0000FF', '#00FF00'])
        });
    }

    return commands;
}

/**
 * Bot guessing logic - tries to guess the word
 * @param {string} currentWord - The actual word (masked with underscores)
 * @param {string} difficulty - Bot difficulty
 * @param {number} timeElapsed - Time elapsed in round (seconds)
 * @param {Array<string>} previousGuesses - Guesses already made
 * @returns {string|null} Guess or null if not guessing yet
 */
export function makeBotGuess(currentWord, difficulty, timeElapsed, previousGuesses = []) {
    // Common words for guessing (simplified for demo)
    const commonWords = [
        'cat', 'dog', 'house', 'tree', 'car', 'sun', 'moon', 'star',
        'flower', 'bird', 'fish', 'apple', 'ball', 'book', 'chair',
        'table', 'phone', 'computer', 'pizza', 'cake', 'smile', 'heart'
    ];

    // Difficulty affects when bot guesses
    const guessThreshold = difficulty === BotDifficulty.EASY ? 30 :
        difficulty === BotDifficulty.MEDIUM ? 20 : 10;

    // Don't guess too early
    if (timeElapsed < guessThreshold) {
        return null;
    }

    // Random chance to guess based on difficulty
    const guessChance = difficulty === BotDifficulty.EASY ? 0.1 :
        difficulty === BotDifficulty.MEDIUM ? 0.2 : 0.3;

    if (Math.random() > guessChance) {
        return null;
    }

    // Filter out previous guesses
    const availableWords = commonWords.filter(w => !previousGuesses.includes(w));

    if (availableWords.length === 0) {
        return null;
    }

    // Hard bots have better chance of guessing correctly
    if (difficulty === BotDifficulty.HARD && Math.random() < 0.3) {
        // Try to match word length
        const wordLength = currentWord.replace(/[^_]/g, '').length / 2; // Approximate
        const matchingLength = availableWords.filter(w => w.length === wordLength);
        if (matchingLength.length > 0) {
            return getRandomElement(matchingLength);
        }
    }

    return getRandomElement(availableWords);
}

/**
 * Bot word selection - chooses a word from options
 * @param {Array<string>} wordOptions - Available word choices
 * @param {string} difficulty - Bot difficulty
 * @returns {string} Selected word
 */
export function selectBotWord(wordOptions, difficulty) {
    if (!wordOptions || wordOptions.length === 0) {
        return null;
    }

    // Easy: pick randomly
    if (difficulty === BotDifficulty.EASY) {
        return getRandomElement(wordOptions);
    }

    // Medium/Hard: prefer shorter words (easier to draw)
    const choices = wordOptions.map(word => ({
        value: word,
        weight: 10 - word.length // Shorter words get higher weight
    }));

    return weightedChoice(choices, difficulty);
}

/**
 * Execute bot drawing on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} drawCommands - Drawing commands from generateBotDrawing
 * @param {Function} onDrawComplete - Callback when drawing is complete
 */
export function executeBotDrawing(ctx, drawCommands, onDrawComplete) {
    let currentCommand = 0;

    const drawNext = () => {
        if (currentCommand >= drawCommands.length) {
            if (onDrawComplete) onDrawComplete();
            return;
        }

        const cmd = drawCommands[currentCommand];
        ctx.strokeStyle = cmd.color;
        ctx.lineWidth = 3;

        // Draw the shape
        if (DRAWING_PATTERNS[cmd.type]) {
            DRAWING_PATTERNS[cmd.type](ctx, cmd.x, cmd.y, cmd.size);
        }

        currentCommand++;

        // Delay between shapes (200-500ms)
        setTimeout(drawNext, 200 + Math.random() * 300);
    };

    drawNext();
}
