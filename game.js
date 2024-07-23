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
    loadPuzzle().then(() => {
        initializeEventListeners();
        loadGameState();
    });
});

async function loadPuzzle() {
    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = String(currentDate.getFullYear()).slice(-2);
    const puzzleHtmlFileName = `puzzles/${year}-${month}-${day}.html`;


    try {
        const response = await fetch(puzzleHtmlFileName);
        if (!response.ok) {
            throw new Error('Puzzle not found for today.');
        }
        const html = await response.text();
        const puzzleContainer = document.getElementById('puzzle-container');
        puzzleContainer.innerHTML = html;

        // Execute any scripts in the loaded HTML
        const scripts = puzzleContainer.getElementsByTagName('script');
        for (let script of scripts) {
            eval(script.innerText);
        }

        // Wait for puzzleData to be available
        await new Promise(resolve => {
            if (window.puzzleData) {
                resolve();
            } else {
                const observer = new MutationObserver(() => {
                    if (window.puzzleData) {
                        observer.disconnect();
                        resolve();
                    }
                });
                observer.observe(puzzleContainer, { childList: true, subtree: true });
            }
        });

        initializeGameAfterLoading();
    } catch (error) {
        document.getElementById('puzzle-container').innerText = 'Puzzle not found for today. Please check back later.';
    }
}

function initializeEventListeners() {
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
}

function initializeGameAfterLoading() {
    const puzzleData = window.puzzleData;
    if (!puzzleData) {
        throw new Error('Puzzle data not found in the HTML.');
    }

    clues = puzzleData.clues;
    revealMappings = puzzleData.revealMappings;
    window.revealMappings = revealMappings;
    setupGame();
    reinitializePuzzle();
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

            const mappingKey = `${index}-${i}`;
            const mapping = revealMappings[difficultyLevel] && revealMappings[difficultyLevel][mappingKey];
            if (mapping) {
                const indexLabel = document.createElement('span');
                indexLabel.className = 'tile-index';
                indexLabel.innerText = mapping.index;
                tileWrapper.appendChild(indexLabel);
                tile.classList.add('index-' + mapping.index);
                tile.dataset.index = mapping.index;
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

    clearAllHighlights();
    initializeControls();
}

function reinitializePuzzle() {
    if (window.puzzleData) {
        clues = window.puzzleData.clues;
        revealMappings = window.revealMappings || revealMappings;
    }

    initializeControls();
    setupGame();
}

function initializeControls() {
    const tiles = document.querySelectorAll('.tile');
    tiles.forEach(tile => {
        const clueIndex = tile.dataset.clueIndex;
        const tileIndex = tile.dataset.tileIndex;
        tile.onfocus = () => handleFocus(clueIndex, tileIndex);
        tile.oninput = (event) => handleInput(event, clueIndex, tileIndex, clues[clueIndex].answer);
        tile.onkeydown = (event) => handleKeydown(event, clueIndex, tileIndex);
        tile.onblur = () => handleBlur(clueIndex, tileIndex);
    });
}

function startTimer() {
    startTime = new Date();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
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
}

function loadGameState() {
    const savedGameState = localStorage.getItem(`gameState-${new Date().toISOString().split('T')[0]}`);
    if (!savedGameState) {
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
    } else if (tile.value.length === 1) {
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
    let nextTile = getNextTile(parseInt(clueIndex), parseInt(tileIndex));

    if (autocheck) {
        while (nextTile && clues[nextTile.dataset.clueIndex] && nextTile.value.toLowerCase() === clues[nextTile.dataset.clueIndex].answer[nextTile.dataset.tileIndex].toLowerCase()) {
            const currentClueIndex = parseInt(nextTile.dataset.clueIndex);
            const currentTileIndex = parseInt(nextTile.dataset.tileIndex);
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
            if (allCorrect) {
                completionMessage.innerText = 'Congratulations! You have completed the puzzle correctly!';
                completionModal.style.display = 'block';
                stopTimer();
            } else if (!autocheck) {
                completionMessage.innerText = 'All tiles are filled, but some answers are incorrect.';
                completionModal.style.display = 'block';
            }
        }
    }
}
