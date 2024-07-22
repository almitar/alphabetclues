let autocheck = false;
let clues = [];
let revealMappings = {
    easy: {},
    medium: {},
    advanced: {}
};
let difficultyLevel = 'easy';
let startTime;
let timerInterval;

document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadGameState();
});

function initializeEventListeners() {
    const generatePuzzleButton = document.getElementById('generate-puzzle');
    const copyHtmlButton = document.getElementById('copy-html');

    if (generatePuzzleButton) {
        generatePuzzleButton.addEventListener('click', () => {
            const puzzleDate = document.getElementById('puzzle-date').value;
            if (puzzleDate) {
                fetchPuzzleData(puzzleDate);
            } else {
                alert('Please select a puzzle date.');
            }
        });
    }

    if (copyHtmlButton) {
        copyHtmlButton.addEventListener('click', copyGeneratedHtml);
    }

    const easyButton = document.getElementById('easy-level');
    const mediumButton = document.getElementById('medium-level');
    const advancedButton = document.getElementById('advanced-level');
    const backButton = document.getElementById('back-button');
    const continueButton = document.getElementById('continue-button');
    const completionOkButton = document.getElementById('completion-ok-button');
    const autocheckToggle = document.getElementById('autocheck-toggle');

    if (easyButton) easyButton.addEventListener('click', () => showLevelChangePopup('easy'));
    if (mediumButton) mediumButton.addEventListener('click', () => showLevelChangePopup('medium'));
    if (advancedButton) advancedButton.addEventListener('click', () => showLevelChangePopup('advanced'));
    if (backButton) backButton.addEventListener('click', closeLevelChangePopup);
    if (continueButton) continueButton.addEventListener('click', confirmLevelChange);
    if (completionOkButton) completionOkButton.addEventListener('click', closeCompletionPopup);
    if (autocheckToggle) autocheckToggle.addEventListener('change', () => {
        autocheck = autocheckToggle.checked;
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
            clearAllHighlights();
            checkAllTiles();
        }
    });

    if (document.getElementById('puzzle-container').innerHTML.trim()) {
        reinitializePuzzle();
    }
}

function fetchPuzzleData(puzzleDate) {
    const [year, month, day] = puzzleDate.split('-');
    const puzzleFileName = `puzzles/${day}-${month}-${year.slice(-2)}.json`;

    fetch(puzzleFileName)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            clues = data.clues;
            generateAllRevealMappings();
            generatePuzzleHtml(puzzleDate);
        })
        .catch(error => {
            console.error('Error loading puzzle:', error);
            alert('Puzzle not found for the selected date. Please check back later.');
        });
}

function generateAllRevealMappings() {
    ['easy', 'medium', 'advanced'].forEach(level => {
        difficultyLevel = level;
        generateRevealMappings();
    });
    difficultyLevel = 'easy'; // Reset to default level
}

function generatePuzzleHtml(puzzleDate) {
    const container = document.getElementById('puzzle-container');
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
            tile.autocomplete = 'off';
            tile.onfocus = () => handleFocus(index, i);
            tile.oninput = (event) => handleInput(event, index, i, clue.answer);
            tile.onkeydown = (e) => handleKeydown(e, index, i);
            tile.onblur = () => handleBlur(index, i);
            tile.addEventListener('input', saveGameState);

            const mappingKey = `${index}-${i}`;
            if (revealMappings[difficultyLevel][mappingKey]) {
                const indexLabel = document.createElement('span');
                indexLabel.className = 'tile-index';
                indexLabel.innerText = revealMappings[difficultyLevel][mappingKey].index;
                tileWrapper.appendChild(indexLabel);
                tile.classList.add('index-' + revealMappings[difficultyLevel][mappingKey].index);
                tile.dataset.index = revealMappings[difficultyLevel][mappingKey].index;
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

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Puzzle for ${puzzleDate}</title>
        <link rel="stylesheet" href="styles.css">
    </head>
    <body>
        <div id="game-container">
            <h1>ALPHABET CLUES</h1>
            <p>Find the hidden words for each letter of the alphabet. Tiles that highlight at the same time mean they contain the same letter.</p>
            <div id="clue-section-container">
                ${container.innerHTML}
            </div>
        </div>
        <script>
            window.revealMappings = ${JSON.stringify(revealMappings)};
        </script>
        <script src="generator.js"></script>
    </body>
    </html>`;

    container.innerHTML = htmlContent;
    saveGameState();
}

function copyGeneratedHtml() {
    const container = document.getElementById('puzzle-container');
    const htmlContent = container.innerHTML;

    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = htmlContent;
    document.body.appendChild(tempTextarea);
    tempTextarea.select();
    document.execCommand('copy');
    document.body.removeChild(tempTextarea);

    alert('Generated HTML copied to clipboard!');
}

function generateRevealMappings() {
    const createMappings = () => {
        const mappings = {};
        const letterElements = [];
        clues.forEach((clue, clueIndex) => {
            clue.answer.split('').forEach((letter, letterIndex) => {
                letterElements.push({ clueIndex, letterIndex, letter });
            });
        });

        const percentage = getMappingPercentage();
        const totalLetters = letterElements.length;
        const lettersToAssign = Math.floor(totalLetters * (percentage / 100));

        const selectedLetters = [];
        const letterGroups = {};

        clues.forEach((clue, clueIndex) => {
            const letterIndexes = clue.answer.split('').map((letter, letterIndex) => ({ clueIndex, letterIndex, letter }));
            shuffleArray(letterIndexes);
            selectedLetters.push(letterIndexes[0]);
        });

        const remainingLetters = letterElements.filter(element => !selectedLetters.some(sel => sel.clueIndex === element.clueIndex && sel.letterIndex === element.letterIndex));
        shuffleArray(remainingLetters);

        let remainingLettersToAssign = lettersToAssign - selectedLetters.length;
        for (const letterElement of remainingLetters) {
            if (remainingLettersToAssign <= 0) break;
            const alreadyMappedWord = selectedLetters.some(sel => sel.clueIndex === letterElement.clueIndex);
            if (!alreadyMappedWord) {
                selectedLetters.push(letterElement);
                remainingLettersToAssign--;
            }
        }

        if (remainingLettersToAssign > 0) {
            const finalLetters = remainingLetters.filter(element => !selectedLetters.some(sel => sel.clueIndex === element.clueIndex && sel.letterIndex === element.letterIndex));
            selectedLetters.push(...finalLetters.slice(0, remainingLettersToAssign));
        }

        selectedLetters.forEach(letterElement => {
            const letter = letterElement.letter;
            if (!letterGroups[letter]) {
                letterGroups[letter] = [];
            }
            letterGroups[letter].push(letterElement);
        });

        const usedNumbers = new Set();
        let currentNumber;

        for (const letter in letterGroups) {
            const group = letterGroups[letter];
            if (group.length > 1) {
                shuffleArray(group);
                for (let i = 0; i < group.length; i += 3) {
                    do {
                        currentNumber = getRandomInt(1, 100);
                    } while (usedNumbers.has(currentNumber));
                    usedNumbers.add(currentNumber);

                    group.slice(i, i + 3).forEach((item, index, arr) => {
                        mappings[`${item.clueIndex}-${item.letterIndex}`] = {
                            targetClueIndex: arr[(index + 1) % arr.length].clueIndex,
                            targetLetterIndex: arr[(index + 1) % arr.length].letterIndex,
                            index: currentNumber
                        };
                    });
                }
            }
        }

        return mappings;
    };

    const validateMappings = (mappings) => {
        let allWordsMapped = true;
        clues.forEach((clue, clueIndex) => {
            const hasMapping = clue.answer.split('').some((letter, letterIndex) => {
                return mappings.hasOwnProperty(`${clueIndex}-${letterIndex}`);
            });
            if (!hasMapping) {
                allWordsMapped = false;
            }
        });
        return allWordsMapped;
    };

    let mappings;
    do {
        mappings = createMappings();
    } while (!validateMappings(mappings));

    revealMappings[difficultyLevel] = mappings;
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

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function reinitializePuzzle() {
    if (window.puzzleData) {
        clues = window.puzzleData.clues;
        revealMappings = window.revealMappings || revealMappings;
    }

    const tiles = document.querySelectorAll('.tile');
    tiles.forEach(tile => {
        const clueIndex = tile.dataset.clueIndex;
        const tileIndex = tile.dataset.tileIndex;
        tile.onfocus = () => handleFocus(clueIndex, tileIndex);
        tile.oninput = (event) => handleInput(event, clueIndex, tileIndex, clues[clueIndex].answer);
        tile.onkeydown = (event) => handleKeydown(event, clueIndex, tileIndex);
        tile.onblur = () => handleBlur(clueIndex, tileIndex);
    });

    setupGame();
    loadGameState();
}

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
    updateSelectedButton(level);
    setupGame();
    saveGameState();
}

function updateSelectedButton(level) {
    document.querySelectorAll('.level-buttons button').forEach(button => {
        button.classList.remove('selected');
    });

    const selectedButton = document.getElementById(`${level}-level`);
    if (selectedButton) selectedButton.classList.add('selected');
}

function handleFocus(clueIndex, tileIndex) {
    clearAllHighlights();

    const mappingKey = `${clueIndex}-${tileIndex}`;
    const currentTile = document.getElementById(`answer-${clueIndex}-${tileIndex}`);
    currentTile.classList.add('highlight');
    currentTile.dataset.previousValue = currentTile.value;

    if (revealMappings[difficultyLevel][mappingKey]) {
        const { targetClueIndex, targetLetterIndex } = revealMappings[difficultyLevel][mappingKey];
        const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
        targetTile.classList.add('highlight');
    }
}

function clearTile(tile, clueIndex, tileIndex) {
    tile.value = '';
    tile.dataset.revealed = 'false';
    tile.classList.remove('incorrect');

    if (!autocheck || (autocheck && !tile.disabled)) {
        const mappingKey = `${clueIndex}-${tileIndex}`;
        if (revealMappings[difficultyLevel][mappingKey]) {
            const { targetClueIndex, targetLetterIndex } = revealMappings[difficultyLevel][mappingKey];
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
    const isCorrect = userInput.toLowerCase() === correctAnswer[tileIndex].toLowerCase();

    if (userInput === '') {
        tile.classList.remove('incorrect');
    } else if (isCorrect) {
        tile.classList.remove('incorrect');
        if (autocheck) {
            tile.disabled = true;
        }
    } else {
        if (autocheck) {
            tile.classList.add('incorrect');
        }
    }

    propagateLetter(clueIndex, tileIndex, tile.value, isCorrect);
}

function propagateLetter(clueIndex, tileIndex, value, isCorrect) {
    const mappingKey = `${clueIndex}-${tileIndex}`;
    if (revealMappings[difficultyLevel][mappingKey]) {
        const { targetClueIndex, targetLetterIndex } = revealMappings[difficultyLevel][mappingKey];
        const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
        targetTile.value = value.toUpperCase();
        targetTile.dataset.revealed = 'true';

        if (autocheck) {
            if (isCorrect) {
                targetTile.disabled = true;
                targetTile.classList.remove('incorrect');
            } else {
                targetTile.classList.add('incorrect');
            }
        }
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
        previousClueIndex = clues.length - 1;
    }

    const previousClueLength = clues[previousClueIndex].answer.length;
    const targetTileIndex = Math.min(tileIndex, previousClueLength - 1);

    const previousTile = document.getElementById(`answer-${previousClueIndex}-${targetTileIndex}`);
    if (previousTile) {
        previousTile.focus();
    }
}

function focusNextTile(clueIndex, tileIndex) {
    const clueLength = clues[clueIndex].answer.length;

    for (let i = tileIndex + 1; i < clueLength; i++) {
        const nextTile = document.getElementById(`answer-${clueIndex}-${i}`);
        if (nextTile && (nextTile.value.trim() === '' || (autocheck && nextTile.classList.contains('incorrect')))) {
            nextTile.focus();
            return;
        }
    }

    for (let i = 0; i < clueLength; i++) {
        const nextTile = document.getElementById(`answer-${clueIndex}-${i}`);
        if (nextTile && (nextTile.value.trim() === '' || (autocheck && nextTile.classList.contains('incorrect')))) {
            nextTile.focus();
            return;
        }
    }

    moveToNextClue(clueIndex, tileIndex);
}

function moveToNextClue(clueIndex) {
    let nextClueIndex = clueIndex + 1;

    while (nextClueIndex !== clueIndex) {
        if (nextClueIndex >= clues.length) {
            nextClueIndex = 0;
        }

        const nextClueLength = clues[nextClueIndex].answer.length;

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
    const tile = document.getElementById(`answer-${clueIndex}-${tileIndex}`);
    const previousValue = tile.dataset.previousValue || '';
    const userInput = event.target.value.trim().toUpperCase();

    if (previousValue && previousValue !== userInput) {
        clearTile(tile, clueIndex, tileIndex);
    }

    tile.value = userInput;

    if (tile.value.length == 2) {
        tile.value = tile.value.replace(previousValue, '');
    }

    tile.dataset.previousValue = tile.value;
    checkTile(clueIndex, tileIndex, correctAnswer, tile);

    if (tile.value === '') {
        clearTile(tile, clueIndex, tileIndex);
    } else {
        focusNextTile(clueIndex, tileIndex);
    }

    checkGameCompletion();
    saveGameState();
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
    if (revealMappings[difficultyLevel][mappingKey]) {
        const { targetClueIndex, targetLetterIndex } = revealMappings[difficultyLevel][mappingKey];
        const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
        if (targetTile && targetTile.classList.contains('index-' + revealMappings[difficultyLevel][mappingKey].index)) {
            targetTile.value = '';
            targetTile.dataset.revealed = 'false';
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

function clearAllHighlights() {
    document.querySelectorAll('.tile').forEach(tile => {
        tile.classList.remove('highlight');
    });
}

function handleBlur(clueIndex, tileIndex) {
    const mappingKey = `${clueIndex}-${tileIndex}`;
    const currentTile = document.getElementById(`answer-${clueIndex}-${tileIndex}`);
    currentTile.classList.remove('highlight');
    if (revealMappings[difficultyLevel][mappingKey]) {
        const { targetClueIndex, targetLetterIndex } = revealMappings[difficultyLevel][mappingKey];
        const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
        targetTile.classList.remove('highlight');
    }
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

function setupGame() {
    const container = document.getElementById('puzzle-container');
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
            tile.autocomplete = 'off';
            tile.onfocus = () => handleFocus(index, i);
            tile.oninput = (event) => handleInput(event, index, i, clue.answer);
            tile.onkeydown = (e) => handleKeydown(e, index, i);
            tile.onblur = () => handleBlur(index, i);
            tile.addEventListener('input', saveGameState);

            const mappingKey = `${index}-${i}`;
            if (revealMappings[difficultyLevel][mappingKey]) {
                const indexLabel = document.createElement('span');
                indexLabel.className = 'tile-index';
                indexLabel.innerText = revealMappings[difficultyLevel][mappingKey].index;
                tileWrapper.appendChild(indexLabel);
                tile.classList.add('index-' + revealMappings[difficultyLevel][mappingKey].index);
                tile.dataset.index = revealMappings[difficultyLevel][mappingKey].index;
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
    if (toggleButton) {
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
                clearAllHighlights();
                checkAllTiles();
            }
        });
    }

    clearAllHighlights();
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

function saveGameState() {
    const gameState = {
        clues,
        revealMappings,
        difficultyLevel,
        filledTiles: [],
        startTime: new Date().toISOString()
    };

    document.querySelectorAll('.tile').forEach(tile => {
        gameState.filledTiles.push({
            clueIndex: tile.dataset.clueIndex,
            tileIndex: tile.dataset.tileIndex,
            value: tile.value,
            disabled: tile.disabled,
            revealed: tile.dataset.revealed
        });
    });

    localStorage.setItem(`gameState-${new Date().toISOString().split('T')[0]}`, JSON.stringify(gameState));
    console.log('Game state saved:', gameState);
}

function loadGameState() {
    const savedGameState = localStorage.getItem(`gameState-${new Date().toISOString().split('T')[0]}`);
    if (!savedGameState) {
        console.log('No saved game state for today.');
        return;
    }

    const gameState = JSON.parse(savedGameState);
    clues = gameState.clues;
    revealMappings = gameState.revealMappings;
    difficultyLevel = gameState.difficultyLevel;
    startTime = new Date(gameState.startTime);

    gameState.filledTiles.forEach(tileData => {
        const tile = document.getElementById(`answer-${tileData.clueIndex}-${tileData.tileIndex}`);
        if (tile) {
            tile.value = tileData.value;
            tile.disabled = tileData.disabled === 'true';
            tile.dataset.revealed = tileData.revealed;
        }
    });

    updateSelectedButton(difficultyLevel);
    console.log('Game state loaded:', gameState);
}

function isInSameWord(group, item) {
    return group.some(other => other.clueIndex === item.clueIndex && other.letterIndex !== item.letterIndex);
}
