let autocheck = false;
let clues = [];
let revealMapping = {};

function initializeGame() {
    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = String(currentDate.getFullYear()).slice(-2);
    const puzzleFileName = `puzzles/${day}-${month}-${year}.json`;

    fetch(puzzleFileName)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            clues = data.clues;

            // Generate reveal mappings
            generateRevealMappings();

            setupGame();
        })
        .catch(error => {
            console.error('Error loading puzzle:', error);
            alert('Puzzle not found for today. Please check back later.');
        });
}

function generateRevealMappings() {
    let success = false;
    const maxRetries = 10; // Maximum number of retries to find a valid mapping

    for (let attempt = 0; attempt < maxRetries && !success; attempt++) {
        success = tryGenerateMappings();
    }

    if (!success) {
        console.error('Failed to generate valid mappings after maximum retries.');
        alert('Failed to generate puzzle mappings. Please try again.');
    }
}

function tryGenerateMappings() {
    revealMapping = {}; // Reset reveal mapping
    const letterElements = [];
    clues.forEach((clue, clueIndex) => {
        clue.answer.split('').forEach((letter, letterIndex) => {
            letterElements.push({ clueIndex, letterIndex, letter });
        });
    });

    const percentage = 40; // Percentage of letters to assign numbers
    const totalLetters = letterElements.length;
    const lettersToAssign = Math.floor(totalLetters * (percentage / 100));

    // Ensure every answer has at least one letter mapped
    const selectedLetters = [];
    const letterGroups = {};

    clues.forEach((clue, clueIndex) => {
        const letterIndexes = clue.answer.split('').map((letter, letterIndex) => ({ clueIndex, letterIndex, letter }));
        shuffleArray(letterIndexes);
        selectedLetters.push(letterIndexes[0]); // Select one letter from each answer
    });

    // Randomly select remaining letters based on percentage
    const remainingLetters = letterElements.filter(element => !selectedLetters.some(sel => sel.clueIndex === element.clueIndex && sel.letterIndex === element.letterIndex));
    shuffleArray(remainingLetters);
    selectedLetters.push(...remainingLetters.slice(0, Math.max(0, lettersToAssign - selectedLetters.length)));

    // Group selected letters by their character
    selectedLetters.forEach(letterElement => {
        const letter = letterElement.letter;
        if (!letterGroups[letter]) {
            letterGroups[letter] = [];
        }
        letterGroups[letter].push(letterElement);
    });

    const usedNumbers = new Set(); // Set to keep track of used numbers
    let currentNumber;

    // Attempt to assign data values to letter pairs
    for (const letter in letterGroups) {
        const group = letterGroups[letter];
        if (group.length > 1) {
            shuffleArray(group); // Shuffle the group to randomize pairs
            for (let i = 0; i < group.length - 1; i += 2) {
                do {
                    currentNumber = getRandomInt(1, 100); // Adjust the range here
                } while (usedNumbers.has(currentNumber)); // Ensure the number hasn't been used
                usedNumbers.add(currentNumber); // Add the number to the set of used numbers
                revealMapping[`${group[i].clueIndex}-${group[i].letterIndex}`] = {
                    targetClueIndex: group[i + 1].clueIndex,
                    targetLetterIndex: group[i + 1].letterIndex,
                    index: currentNumber
                };
                revealMapping[`${group[i + 1].clueIndex}-${group[i + 1].letterIndex}`] = {
                    targetClueIndex: group[i].clueIndex,
                    targetLetterIndex: group[i].letterIndex,
                    index: currentNumber
                };
            }
        }
    }

    // Check if each clue has at least one mapping
    let allCluesMapped = true;
    clues.forEach((clue, clueIndex) => {
        const hasMapping = clue.answer.split('').some((_, letterIndex) => revealMapping.hasOwnProperty(`${clueIndex}-${letterIndex}`));
        if (!hasMapping) {
            allCluesMapped = false;
        }
    });

    return allCluesMapped;
}

function setupGame() {
    const container = document.getElementById('clue-section-container');
    container.innerHTML = '';

    clues.forEach((clue, index) => {
        const clueSection = document.createElement('div');
        clueSection.className = 'clue-section';

        const clueText = document.createElement('div');
        clueText.className = 'clue';
        clueText.innerHTML = `<span class="clue-type">${clue.type === 'contains' ? 'Contains' : 'Starts with'} ${clue.letter}</span><br>${clue.clue}`;

        const tileContainer = document.createElement('div');
        tileContainer.className = 'tile-container';
        
        for (let i = 0; i < clue.answer.length; i++) {
            const tileWrapper = document.createElement('div');
            tileWrapper.className = 'tile-wrapper';

            const tile = document.createElement('input');
            tile.type = 'text';
            tile.maxLength = 1;
            tile.className = 'tile autocheckoff';
            tile.id = `answer-${index}-${i}`;
            tile.dataset.clueIndex = index;
            tile.dataset.tileIndex = i;
            tile.oninput = () => handleInput(index, i, clue.answer);
            tile.onkeydown = (e) => handleKeydown(e, index, i);
            tile.onfocus = () => handleFocus(index, i);
            tile.onblur = () => handleBlur(index, i);

            const mappingKey = `${index}-${i}`;
            if (revealMapping[mappingKey]) {
                const indexLabel = document.createElement('span');
                indexLabel.className = 'tile-index';
                indexLabel.innerText = revealMapping[mappingKey].index;
                tileWrapper.appendChild(indexLabel);
                tile.classList.add('index-' + revealMapping[mappingKey].index);
                tile.dataset.index = revealMapping[mappingKey].index;
            }

            tileWrapper.appendChild(tile);
            tileContainer.appendChild(tileWrapper);
        }

        const resultText = document.createElement('span');
        resultText.className = 'result';
        resultText.id = `result-${index}`;

        clueSection.appendChild(clueText);
        clueSection.appendChild(tileContainer);
        clueSection.appendChild(resultText);

        container.appendChild(clueSection);
    });

    const toggleButton = document.getElementById('autocheck-toggle');
    toggleButton.addEventListener('change', () => {
        autocheck = toggleButton.checked;
        document.querySelectorAll('.tile').forEach(tile => {
            if (autocheck) {
                tile.classList.remove('autocheckoff');
            } else {
                tile.classList.add('autocheckoff');
                tile.disabled = false;
                tile.classList.remove('incorrect');
            }
        });
        if (autocheck) {
            checkAllTiles();
        }
    });
}

function handleFocus(clueIndex, tileIndex) {
    const mappingKey = `${clueIndex}-${tileIndex}`;
    if (revealMapping[mappingKey]) {
        const { targetClueIndex, targetLetterIndex } = revealMapping[mappingKey];
        const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
        document.getElementById(`answer-${clueIndex}-${tileIndex}`).classList.add('highlight');
        targetTile.classList.add('highlight');
    }
}

function handleBlur(clueIndex, tileIndex) {
    const mappingKey = `${clueIndex}-${tileIndex}`;
    if (revealMapping[mappingKey]) {
        const { targetClueIndex, targetLetterIndex } = revealMapping[mappingKey];
        const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
        document.getElementById(`answer-${clueIndex}-${tileIndex}`).classList.remove('highlight');
        targetTile.classList.remove('highlight');
    }
}

function handleInput(clueIndex, tileIndex, correctAnswer) {
    const tile = document.getElementById(`answer-${clueIndex}-${tileIndex}`);
    tile.value = tile.value.toUpperCase(); // Ensure input is capitalized
    const userInput = tile.value.trim();

    checkTile(clueIndex, tileIndex, correctAnswer, tile);

    if (userInput === '') {
        clearTile(tile, clueIndex, tileIndex);
    } else {
        focusNextTile(clueIndex, tileIndex);
    }
}

function checkTile(clueIndex, tileIndex, correctAnswer, tile) {
    const userInput = tile.value.trim();
    if (userInput === '') {
        tile.classList.remove('incorrect');
    } else if (userInput.toLowerCase() === correctAnswer[tileIndex].toLowerCase()) {
        tile.classList.remove('incorrect');
        if (autocheck) {
            tile.disabled = true; // Mark as correct and make it non-editable
        }
    } else {
        if (autocheck) {
            tile.classList.add('incorrect');
        }
    }

    propagateLetter(clueIndex, tileIndex, tile.value);
}

function propagateLetter(clueIndex, tileIndex, value) {
    const mappingKey = `${clueIndex}-${tileIndex}`;
    if (revealMapping[mappingKey]) {
        const { targetClueIndex, targetLetterIndex } = revealMapping[mappingKey];
        const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
        targetTile.value = value.toUpperCase(); // Populate regardless of correctness
        targetTile.dataset.revealed = 'true'; // Mark the tile as revealed
        targetTile.classList.add('highlight');
    }
}

function handleKeydown(event, clueIndex, tileIndex) {
    const tile = document.getElementById(`answer-${clueIndex}-${tileIndex}`);

    if (event.key === 'Backspace') {
        event.preventDefault();
        if (tile.value !== '') {
            clearTile(tile, clueIndex, tileIndex);
        } else {
            if (!autocheck) {
                handleBackspaceNoAutoCheck(clueIndex, tileIndex);
            } else {
                handleBackspaceAutoCheck(clueIndex, tileIndex);
            }
        }
    } else if (event.key === 'Delete') {
        event.preventDefault();
        if (tile.value !== '') {
            clearTile(tile, clueIndex, tileIndex);
            const nextTile = getNextTile(clueIndex, tileIndex);
            if (nextTile) {
                nextTile.focus();
            }
        } else {
            const previousTile = getPreviousTile(clueIndex, tileIndex);
            if (previousTile) {
                previousTile.focus();
                if (previousTile.value !== '') {
                    clearTile(previousTile, parseInt(previousTile.dataset.clueIndex), parseInt(previousTile.dataset.tileIndex));
                }
            }
        }
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveLeft(clueIndex, tileIndex);
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveRight(clueIndex, tileIndex);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveToPreviousClue(clueIndex, tileIndex);
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveToNextClue(clueIndex, tileIndex);
    }
}

function moveToPreviousClue(clueIndex, tileIndex) {
    let previousClueIndex = clueIndex - 1;

    if (previousClueIndex < 0) {
        previousClueIndex = clues.length - 1; // Wrap around to the last clue
    }

    const previousClueLength = clues[previousClueIndex].answer.length;
    const targetTileIndex = Math.min(tileIndex, previousClueLength - 1); // Ensure we don't go out of bounds

    const previousTile = document.getElementById(`answer-${previousClueIndex}-${targetTileIndex}`);
    if (previousTile) {
        previousTile.focus();
    }
}

function moveToNextClue(clueIndex, tileIndex) {
    let nextClueIndex = clueIndex + 1;

    if (nextClueIndex >= clues.length) {
        nextClueIndex = 0; // Wrap around to the first clue
    }

    const nextClueLength = clues[nextClueIndex].answer.length;
    const targetTileIndex = Math.min(tileIndex, nextClueLength - 1); // Ensure we don't go out of bounds

    const nextTile = document.getElementById(`answer-${nextClueIndex}-${targetTileIndex}`);
    if (nextTile) {
        nextTile.focus();
    }
}


function clearTile(tile, clueIndex, tileIndex) {
    tile.value = '';
    tile.dataset.revealed = 'false';
    tile.classList.remove('incorrect');

    // Clear the propagated letter if in autocheck mode or if the user is not in autocheck mode
    if (!autocheck || (autocheck && !tile.disabled)) {
        const mappingKey = `${clueIndex}-${tileIndex}`;
        if (revealMapping[mappingKey]) {
            const { targetClueIndex, targetLetterIndex } = revealMapping[mappingKey];
            const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
            if (!autocheck || (autocheck && !targetTile.disabled)) {
                targetTile.value = '';
                targetTile.dataset.revealed = 'false';
                targetTile.classList.remove('incorrect');
            }
        }
    }
}


function handleBackspaceNoAutoCheck(clueIndex, tileIndex) {
    const currentTile = document.getElementById(`answer-${clueIndex}-${tileIndex}`);
    if (currentTile.value !== '') {
        clearTile(currentTile, clueIndex, tileIndex);
        return;
    }
    
    let previousTile = getPreviousTile(clueIndex, tileIndex);

    if (previousTile) {
        clearTile(previousTile, previousTile.dataset.clueIndex, previousTile.dataset.tileIndex);
        previousTile.focus();
    }
}

function handleBackspaceAutoCheck(clueIndex, tileIndex) {
    const currentTile = document.getElementById(`answer-${clueIndex}-${tileIndex}`);
    if (currentTile.value !== '') {
        clearTile(currentTile, clueIndex, tileIndex);
        return;
    }

    let previousTile = getPreviousTile(clueIndex, tileIndex);

    while (previousTile && previousTile.value.toLowerCase() === clues[previousTile.dataset.clueIndex]?.answer[previousTile.dataset.tileIndex]?.toLowerCase()) {
        previousTile = getPreviousTile(previousTile.dataset.clueIndex, previousTile.dataset.tileIndex);
    }

    while (previousTile && previousTile.disabled) {
        previousTile = getPreviousTile(previousTile.dataset.clueIndex, previousTile.dataset.tileIndex);
    }

    if (previousTile) {
        clearTile(previousTile, previousTile.dataset.clueIndex, previousTile.dataset.tileIndex);
        previousTile.focus();
    }
}


function getPreviousTile(clueIndex, tileIndex) {
    let previousTile = document.getElementById(`answer-${clueIndex}-${tileIndex - 1}`);

    if (!previousTile) {
        for (let i = clueIndex - 1; i >= 0; i--) {
            const previousClueLength = clues[i].answer.length;
            previousTile = document.getElementById(`answer-${i}-${previousClueLength - 1}`);
            if (previousTile) break;
        }

        if (!previousTile) {
            for (let i = clues.length - 1; i >= 0; i--) {
                const previousClueLength = clues[i].answer.length;
                previousTile = document.getElementById(`answer-${i}-${previousClueLength - 1}`);
                if (previousTile) break;
            }
        }
    }

    return previousTile;
}

function getNextTile(clueIndex, tileIndex) {
    let nextTile = document.getElementById(`answer-${clueIndex}-${tileIndex + 1}`);

    if (!nextTile) {
        for (let i = clueIndex + 1; i < clues.length; i++) {
            for (let j = 0; j < clues[i].answer.length; j++) {
                nextTile = document.getElementById(`answer-${i}-${j}`);
                if (nextTile) break;
            }
            if (nextTile) break;
        }
    }

    if (!nextTile) {
        for (let i = 0; i <= clueIndex; i++) {
            for (let j = 0; j < clues[i].answer.length; j++) {
                nextTile = document.getElementById(`answer-${i}-${j}`);
                if (nextTile) break;
            }
            if (nextTile) break;
        }
    }

    return nextTile;
}


function moveLeft(clueIndex, tileIndex) {
    let previousTile = getPreviousTile(clueIndex, tileIndex);
    
    if (autocheck) {
        while (previousTile && previousTile.value.toLowerCase() === clues[previousTile.dataset.clueIndex]?.answer[previousTile.dataset.tileIndex]?.toLowerCase()) {
            previousTile = getPreviousTile(previousTile.dataset.clueIndex, previousTile.dataset.tileIndex);
        }
    }

    if (previousTile) {
        previousTile.focus();
    }
}

function moveRight(clueIndex, tileIndex) {
    let nextTile = getNextTile(clueIndex, tileIndex);

    if (autocheck) {
        while (nextTile && clues[nextTile.dataset.clueIndex] && nextTile.value.toLowerCase() === clues[nextTile.dataset.clueIndex].answer[nextTile.dataset.tileIndex].toLowerCase()) {
            const currentClueIndex = parseInt(nextTile.dataset.clueIndex, 10);
            const currentTileIndex = parseInt(nextTile.dataset.tileIndex, 10);
            nextTile = getNextTile(currentClueIndex, currentTileIndex);
        }
    }

    if (nextTile) {
        nextTile.focus();
    }
}

function deletePropagatedLetter(clueIndex, tileIndex) {
    const mappingKey = `${clueIndex}-${tileIndex}`;
    if (revealMapping[mappingKey]) {
        const { targetClueIndex, targetLetterIndex } = revealMapping[mappingKey];
        const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
        if (targetTile && targetTile.classList.contains('index-' + revealMapping[mappingKey].index)) {
            targetTile.value = ''; // Clear the propagated letter
            targetTile.dataset.revealed = 'false'; // Mark it as not revealed
            targetTile.classList.remove('incorrect');
        }
    }
}

function getTileIndex(tile) {
    const classes = tile.className.split(' ');
    const indexClass = classes.find(c => c.startsWith('index-'));
    return indexClass ? indexClass.split('-')[1] : null;
}

function focusNextTile(clueIndex, tileIndex) {
    let nextTile = document.getElementById(`answer-${clueIndex}-${tileIndex + 1}`);

    if (!nextTile) {
        for (let i = clueIndex + 1; i < clues.length; i++) {
            for (let j = 0; j < clues[i].answer.length; j++) {
                nextTile = document.getElementById(`answer-${i}-${j}`);
                if (nextTile && nextTile.value.trim() === '') {
                    nextTile.focus();
                    return;
                }
            }
        }
        for (let i = 0; i <= clueIndex; i++) {
            for (let j = 0; j < clues[i].answer.length; j++) {
                nextTile = document.getElementById(`answer-${i}-${j}`);
                if (nextTile && nextTile.value.trim() === '') {
                    nextTile.focus();
                    return;
                }
            }
        }
    } else if (nextTile.value.trim() !== '') {
        focusNextTile(clueIndex, tileIndex + 1);
    } else {
        nextTile.focus();
    }
}

function checkAllTiles() {
    clues.forEach((clue, index) => {
        for (let i = 0; i < clue.answer.length; i++) {
            const tile = document.getElementById(`answer-${index}-${i}`);
            if (tile && tile.value.trim() !== '') {
                checkTile(index, i, clue.answer, tile);
            }
        }
    });
}

// Utility functions
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (min + max + 1)) + min;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Initialize the game immediately
document.addEventListener('DOMContentLoaded', initializeGame);
