let autocheck = false;
let clues = [];
let revealMapping = {};
let difficultyLevel = 'easy';
let startTime;
let timerInterval;

document.addEventListener('DOMContentLoaded', () => {
    initializeGame();

    const easyButton = document.getElementById('easy-level');
    const mediumButton = document.getElementById('medium-level');
    const advancedButton = document.getElementById('advanced-level');
    const backButton = document.getElementById('back-button');
    const continueButton = document.getElementById('continue-button');
    const completionOkButton = document.getElementById('completion-ok-button');

    if (easyButton) easyButton.addEventListener('click', () => showLevelChangePopup('easy'));
    if (mediumButton) mediumButton.addEventListener('click', () => showLevelChangePopup('medium'));
    if (advancedButton) advancedButton.addEventListener('click', () => showLevelChangePopup('advanced'));
    if (backButton) backButton.addEventListener('click', closeLevelChangePopup);
    if (continueButton) continueButton.addEventListener('click', confirmLevelChange);
    if (completionOkButton) completionOkButton.addEventListener('click', closeCompletionPopup);
});

function showLevelChangePopup(level) {
    const levelChangeMessage = document.getElementById('level-change-message');
    const levelChangeModal = document.getElementById('level-change-modal');
    const continueButton = document.getElementById('continue-button');

    if (!levelChangeMessage || !levelChangeModal || !continueButton) return;

    let message = '';
    if (difficultyLevel === 'easy' && level === 'advanced') {
        message = 'Less letters are paired in Advanced mode.';
    } else if (difficultyLevel === 'advanced' && level === 'easy') {
        message = 'More letters are paired in Normal mode.';
    }
    levelChangeMessage.innerText = message;
    levelChangeModal.style.display = 'block';
    continueButton.dataset.level = level;
}

function closeLevelChangePopup() {
    const levelChangeModal = document.getElementById('level-change-modal');
    if (levelChangeModal) levelChangeModal.style.display = 'none';
}

function confirmLevelChange() {
    const continueButton = document.getElementById('continue-button');
    if (continueButton) {
        const level = continueButton.dataset.level;
        setDifficultyLevel(level);
        closeLevelChangePopup();
    }
}

function closeCompletionPopup() {
    const completionModal = document.getElementById('completion-modal');
    if (completionModal) completionModal.style.display = 'none';
}

function setDifficultyLevel(level) {
    difficultyLevel = level;
    initializeGame(); // Reinitialize the game with the new difficulty level
    updateSelectedButton(level);
}

function updateSelectedButton(level) {
    document.querySelectorAll('.level-buttons button').forEach(button => {
        button.classList.remove('selected');
    });

    const selectedButton = document.getElementById(`${level}-level`);
    if (selectedButton) selectedButton.classList.add('selected');
}

function getMappingPercentage() {
    switch (difficultyLevel) {
        case 'easy':
            return 100;
        case 'medium':
            return 70;
        case 'advanced':
            return 50;
        default:
            return 100;
    }
}

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
            startTimer(); // Start the timer when the game initializes
        })
        .catch(error => {
            console.error('Error loading puzzle:', error);
            alert('Puzzle not found for today. Please check back later.');
        });
}

function startTimer() {
    startTime = new Date();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    // Timer is running in the background, no need to update any UI element
}

function stopTimer() {
    clearInterval(timerInterval);
}

function generateRevealMappings(attempt = 0, maxRetries = 10) {
    if (attempt >= maxRetries) {
        console.error('Failed to generate valid mappings after maximum retries.');
        initializeGame(); // Reinitialize the game to regenerate the puzzle
        return;
    }

    const success = tryGenerateMappings();

    if (!success) {
        console.log(`Attempt ${attempt + 1} failed, retrying...`);
        generateRevealMappings(attempt + 1, maxRetries);
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

    const percentage = getMappingPercentage(); // Use the difficulty level percentage
    const totalLetters = letterElements.length;
    const lettersToAssign = Math.floor(totalLetters * (percentage / 100));

    const selectedLetters = [];
    const letterGroups = {};

    // Group selected letters by their character
    letterElements.forEach(letterElement => {
        const letter = letterElement.letter;
        if (!letterGroups[letter]) {
            letterGroups[letter] = [];
        }
        letterGroups[letter].push(letterElement);
    });

    const usedNumbers = new Set(); // Set to keep track of used numbers
    let currentNumber = 1;

    // Assign data values to letter groups in order
    for (const letter in letterGroups) {
        const group = letterGroups[letter];
        const groupLength = group.length;

        if (groupLength > 1) {
            for (let i = 0; i < groupLength; i++) {
                if (revealMapping[`${group[i].clueIndex}-${group[i].letterIndex}`]) continue; // Skip if already mapped
                let mapped = false;

                for (let j = i + 1; j < groupLength; j++) {
                    if (!revealMapping[`${group[j].clueIndex}-${group[j].letterIndex}`]) {
                        revealMapping[`${group[i].clueIndex}-${group[i].letterIndex}`] = {
                            targetClueIndex: group[j].clueIndex,
                            targetLetterIndex: group[j].letterIndex,
                            index: currentNumber
                        };
                        revealMapping[`${group[j].clueIndex}-${group[j].letterIndex}`] = {
                            targetClueIndex: group[i].clueIndex,
                            targetLetterIndex: group[i].letterIndex,
                            index: currentNumber
                        };
                        currentNumber++;
                        mapped = true;
                        break;
                    }
                }

                if (!mapped) {
                    for (let j = 0; j < i; j++) {
                        if (!revealMapping[`${group[j].clueIndex}-${group[j].letterIndex}`]) {
                            revealMapping[`${group[i].clueIndex}-${group[i].letterIndex}`] = {
                                targetClueIndex: group[j].clueIndex,
                                targetLetterIndex: group[j].letterIndex,
                                index: currentNumber
                            };
                            revealMapping[`${group[j].clueIndex}-${group[j].letterIndex}`] = {
                                targetClueIndex: group[i].clueIndex,
                                targetLetterIndex: group[i].letterIndex,
                                index: currentNumber
                            };
                            currentNumber++;
                            break;
                        }
                    }
                }
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



function handleFocus(clueIndex, tileIndex) {
    clearAllHighlights();

    const mappingKey = `${clueIndex}-${tileIndex}`;
    const currentTile = document.getElementById(`answer-${clueIndex}-${tileIndex}`);
    currentTile.classList.add('highlight');
    currentTile.dataset.previousValue = currentTile.value; // Store the previous value on focus
    
    if (revealMapping[mappingKey]) {
        const { targetClueIndex, targetLetterIndex } = revealMapping[mappingKey];
        const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
        targetTile.classList.add('highlight');
    }
}

function clearTile(tile, clueIndex, tileIndex) {
    console.log('clearTile called', clueIndex, tileIndex); // Debug log
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

function focusNextTile(clueIndex, tileIndex) {
    const clueLength = clues[clueIndex].answer.length;

    // Find the next focusable tile within the same word
    for (let i = tileIndex + 1; i < clueLength; i++) {
        const nextTile = document.getElementById(`answer-${clueIndex}-${i}`);
        if (nextTile && (nextTile.value.trim() === '' || (autocheck && nextTile.classList.contains('incorrect')))) {
            nextTile.focus();
            return;
        }
    }

    // If no focusable tile is found, cycle back to the first empty or incorrect tile within the word
    for (let i = 0; i < clueLength; i++) {
        const nextTile = document.getElementById(`answer-${clueIndex}-${i}`);
        if (nextTile && (nextTile.value.trim() === '' || (autocheck && nextTile.classList.contains('incorrect')))) {
            nextTile.focus();
            return;
        }
    }

    // If all tiles in the current word are filled or correct, move to the next clue
    moveToNextClue(clueIndex, tileIndex);
}

function moveToNextClue(clueIndex) {
    let nextClueIndex = clueIndex + 1;

    // Continue searching in the next clues if current clue is completely filled or correct
    while (nextClueIndex !== clueIndex) {
        if (nextClueIndex >= clues.length) {
            nextClueIndex = 0; // Wrap around to the first clue if we're at the last one
        }

        const nextClueLength = clues[nextClueIndex].answer.length;

        // Find the first focusable tile in the next clue
        for (let i = 0; i < nextClueLength; i++) {
            const nextTile = document.getElementById(`answer-${nextClueIndex}-${i}`);
            if (nextTile && (nextTile.value.trim() === '' || (autocheck && nextTile.classList.contains('incorrect')))) {
                nextTile.focus();
                return;
            }
        }

        nextClueIndex++;
    }
}

function handleInput(event, clueIndex, tileIndex, correctAnswer) {
    console.log('handleInput called', clueIndex, tileIndex); // Debug log

    const tile = document.getElementById(`answer-${clueIndex}-${tileIndex}`);

    const previousValue = tile.dataset.previousValue || ''; // Store the previous value
    const userInput = event.target.value.trim().toUpperCase(); // Ensure input is capitalized

    console.log('Previous Value:', previousValue, 'User Input:', userInput); // Debug log

    if (previousValue && previousValue !== userInput) {
        console.log('Previous value differs, clearing tile'); // Debug log
        clearTile(tile, clueIndex, tileIndex); // Clear the tile if it has a previous value
    }

    tile.value = userInput; // Set the new input value

    if (tile.value.length == 2) {
        tile.value = tile.value.replace(previousValue, '');
    }

    tile.dataset.previousValue = tile.value; // Store the current value as previous for future checks

    checkTile(clueIndex, tileIndex, correctAnswer, tile);

    if (tile.value === '') {
        clearTile(tile, clueIndex, tileIndex);
    } else {
        focusNextTile(clueIndex, tileIndex);
    }

    // Check if the game is completed
    checkGameCompletion();
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

function checkAllTiles() {
    clearAllHighlights();
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

function clearAllHighlights() {
    document.querySelectorAll('.tile').forEach(tile => {
        tile.classList.remove('highlight');
    });
}

function handleBlur(clueIndex, tileIndex) {
    const mappingKey = `${clueIndex}-${tileIndex}`;
    const currentTile = document.getElementById(`answer-${clueIndex}-${tileIndex}`);
    currentTile.classList.remove('highlight');
    if (revealMapping[mappingKey]) {
        const { targetClueIndex, targetLetterIndex } = revealMapping[mappingKey];
        const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
        targetTile.classList.remove('highlight');
    }
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
            tile.maxLength = 2;
            tile.className = 'tile autocheckoff';
            tile.id = `answer-${index}-${i}`;
            tile.dataset.clueIndex = index;
            tile.dataset.tileIndex = i;
            tile.autocomplete = 'off'; // Disable keyboard autofill
            tile.onfocus = () => handleFocus(index, i); // Attach handleFocus event
            tile.oninput = (event) => {
                console.log(`Input event fired: clueIndex=${index}, tileIndex=${i}`);
                handleInput(event, index, i, clue.answer);
            }; // Attach handleInput event
            tile.onkeydown = (e) => handleKeydown(e, index, i);
            tile.onblur = () => handleBlur(index, i); // Attach handleBlur event

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
            clearAllHighlights(); // Clear highlights before checking tiles
            checkAllTiles();
        }
    });

    clearAllHighlights();
}

function checkGameCompletion() {
    let allCorrect = true;
    let allFilled = true;

    clues.forEach((clue, clueIndex) => {
        for (let i = 0; i < clue.answer.length; i++) {
            const tile = document.getElementById(`answer-${clueIndex}-${i}`);
            if (!tile) continue;
            const userInput = tile.value.trim().toLowerCase();
            if (userInput === '') {
                allFilled = false;
            }
            if (userInput !== clue.answer[i].toLowerCase()) {
                allCorrect = false;
            }
        }
    });

    if (allFilled) {
        const completionModal = document.getElementById('completion-modal');
        const completionMessage = document.getElementById('completion-message');
        if (completionModal && completionMessage) {
            const elapsedTime = new Date(new Date() - startTime);
            const minutes = String(elapsedTime.getUTCMinutes()).padStart(2, '0');
            const seconds = String(elapsedTime.getUTCSeconds()).padStart(2, '0');
            if (allCorrect) {
                stopTimer();
                completionMessage.innerText = `Congratulations! You've solved today's puzzle in ${minutes}:${seconds}`;
            } else {
                completionMessage.innerText = 'Keep trying! Some of your answers are incorrect.';
            }
            completionModal.style.display = 'block';
        }
    }
}
