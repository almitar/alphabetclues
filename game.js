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

function parseIndex(index) {
    return parseInt(index, 10);
}

function parseIndices(clueIndex, tileIndex) {
    return [parseIndex(clueIndex), parseIndex(tileIndex)];
}

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
        console.error('Error loading puzzle:', error);
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
    const shareButton = document.getElementById('share-button');
    const completionShareButton = document.getElementById('completion-share-button');
    const closeButton = document.querySelector('.close-button');

    if (easyButton) easyButton.addEventListener('click', () => showLevelChangePopup('easy'));
    if (mediumButton) mediumButton.addEventListener('click', () => showLevelChangePopup('medium'));
    if (advancedButton) advancedButton.addEventListener('click', () => showLevelChangePopup('advanced'));
    if (backButton) backButton.addEventListener('click', closeLevelChangePopup);
    if (continueButton) continueButton.addEventListener('click', confirmLevelChange);
    if (autocheckToggle) autocheckToggle.addEventListener('change', () => {
        autocheck = autocheckToggle.checked;
        document.querySelectorAll('.tile').forEach(tile => {
            if (autocheck) {
                tile.classList.remove('autocheckoff');
            } else {
                tile.classList.add('autocheckoff');
                tile.disabled = false;
                tile.classList.remove('incorrect', 'correct');
            }
        });
        if (autocheck) {
            clearAllHighlights();
            checkAllTiles();
        }
        saveGameState();
    });
    if (shareButton) shareButton.addEventListener('click', sharePuzzle);
    if (completionShareButton) completionShareButton.addEventListener('click', sharePuzzle);
    if (closeButton) closeButton.addEventListener('click', closeCompletionPopup);
    if (completionOkButton) completionOkButton.addEventListener('click', closeCompletionPopup);

    // Add event listener for 'Esc' key
    document.addEventListener('keydown', function(event) {
        if (event.key === "Escape") {
            closeCompletionPopup();
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
    
    // Ensure all difficulty levels are present
    ['easy', 'medium', 'advanced'].forEach(level => {
        if (!revealMappings[level]) {
            console.warn(`No reveal mappings found for ${level} difficulty. Creating empty object.`);
            revealMappings[level] = {};
        }
    });

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
    console.log("Starting timer...");
    clearInterval(timerInterval);
    const currentDate = new Date().toISOString().split('T')[0];
    const storedElapsedTime = parseFloat(localStorage.getItem(`totalElapsedTime-${currentDate}`)) || 0;
    startTime = new Date(new Date().getTime() - storedElapsedTime);
    
    console.log(`Initial stored elapsed time: ${storedElapsedTime}ms`);

    timerInterval = setInterval(() => {
        const now = new Date();
        const totalElapsedTime = now - startTime;
        localStorage.setItem(`totalElapsedTime-${currentDate}`, totalElapsedTime);
        
        console.log(`Updated total elapsed time: ${totalElapsedTime}ms`);
    }, 1000);
}

function saveGameState() {
    console.log("Saving game state...");
    
    const currentDate = new Date().toISOString().split('T')[0];
    const now = new Date();
    const gameState = {
        clues,
        revealMappings,
        difficultyLevel,
        filledTiles: [],
        totalElapsedTime: parseFloat(localStorage.getItem(`totalElapsedTime-${currentDate}`)) || 0,
        lastSaveTime: now.toISOString(),
        autocheck,
        isCompleted: false,
        completionTime: null
    };

    document.querySelectorAll('.tile').forEach(tile => {
        gameState.filledTiles.push({
            clueIndex: tile.dataset.clueIndex,
            tileIndex: tile.dataset.tileIndex,
            value: tile.value,
            disabled: tile.disabled,
            revealed: tile.dataset.revealed,
            correct: tile.classList.contains('correct'),
            incorrect: tile.classList.contains('incorrect')
        });
    });

    const allCorrect = document.querySelectorAll('.tile.correct').length === document.querySelectorAll('.tile').length;
    
    if (allCorrect) {
        gameState.isCompleted = true;
        if (!gameState.completionTime) {
            gameState.completionTime = gameState.totalElapsedTime;
            console.log(`Game completed. Saving completion time: ${gameState.completionTime}ms`);
        }
    }

    localStorage.setItem(`gameState-${currentDate}`, JSON.stringify(gameState));
    console.log(`Saved total elapsed time: ${gameState.totalElapsedTime}ms`);
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
        const completionShareButton = document.getElementById('completion-share-button');
        const completionOkButton = document.getElementById('completion-ok-button');
        
        if (completionModal && completionMessage && completionShareButton && completionOkButton) {
            if (allCorrect) {
                clearInterval(timerInterval); // Stop the timer
                const currentDate = new Date().toISOString().split('T')[0];
                const totalElapsedTime = parseFloat(localStorage.getItem(`totalElapsedTime-${currentDate}`)) || 0;
                
                const minutes = Math.floor(totalElapsedTime / 60000);
                const seconds = Math.floor((totalElapsedTime % 60000) / 1000);
                const timeString = `${minutes}m ${seconds}s`;

                completionMessage.innerText = `Congratulations! You have completed the puzzle correctly in ${timeString}!`;
                completionShareButton.style.display = 'inline-block';
                completionOkButton.style.display = 'none';
                completionModal.style.display = 'block';
                
                // Mark all tiles as correct and disable them
                clues.forEach((clue, clueIndex) => {
                    for (let i = 0; i < clue.answer.length; i++) {
                        const tile = document.getElementById(`answer-${clueIndex}-${i}`);
                        if (tile) {
                            tile.classList.add('correct');
                            tile.disabled = true;
                        }
                    }
                });
                
                saveGameState(); // Save the final state
            } else {
                completionMessage.innerText = 'All tiles are filled, but some answers are incorrect.';
                completionShareButton.style.display = 'none';
                completionOkButton.style.display = 'inline-block';
                completionModal.style.display = 'block';
            }
        }
    }
}

function loadGameState() {
    console.log("Loading game state...");
    resetDailyTimer();

    const currentDate = new Date().toISOString().split('T')[0];
    const savedGameState = localStorage.getItem(`gameState-${currentDate}`);
    
    if (!savedGameState) {
        console.log("No saved game state found. Starting new game.");
        startTime = new Date();
        localStorage.setItem(`totalElapsedTime-${currentDate}`, '0');
        startTimer();
        return;
    }

    const gameState = JSON.parse(savedGameState);
    console.log("Loaded game state:", gameState);

    clues = gameState.clues;
    revealMappings = gameState.revealMappings;
    difficultyLevel = gameState.difficultyLevel;
    autocheck = gameState.autocheck;

    gameState.filledTiles.forEach(tileData => {
        const tile = document.getElementById(`answer-${tileData.clueIndex}-${tileData.tileIndex}`);
        if (tile) {
            tile.value = tileData.value;
            tile.disabled = tileData.disabled;
            tile.dataset.revealed = tileData.revealed;
            if (tileData.correct) {
                tile.classList.add('correct');
            }
            if (tileData.incorrect) {
                tile.classList.add('incorrect');
            }
        }
    });

    updateSelectedButton(difficultyLevel);
    document.getElementById('autocheck-toggle').checked = autocheck;

    if (gameState.isCompleted) {
        console.log(`Loading completed game. Completion time: ${gameState.completionTime}ms`);
        localStorage.setItem(`totalElapsedTime-${currentDate}`, gameState.completionTime);
        document.querySelectorAll('.tile').forEach(tile => {
            tile.disabled = true;
            tile.classList.add('correct');
        });
        showCompletionModal();
    } else {
        const savedElapsedTime = gameState.totalElapsedTime || 0;
        console.log(`Loading ongoing game. Saved elapsed time: ${savedElapsedTime}ms`);
        startTime = new Date(new Date().getTime() - savedElapsedTime);
        startTimer();
    }

    if (autocheck) {
        document.querySelectorAll('.tile').forEach(tile => {
            tile.classList.remove('autocheckoff');
            if (tile.classList.contains('correct')) {
                tile.disabled = true;
            }
        });
    } else {
        document.querySelectorAll('.tile').forEach(tile => {
            tile.classList.add('autocheckoff');
            if (!gameState.isCompleted) {
                tile.disabled = false;
            }
        });
    }
}

function showCompletionModal() {
    console.log("Showing completion modal...");
    clearInterval(timerInterval);

    const currentDate = new Date().toISOString().split('T')[0];
    const savedGameState = JSON.parse(localStorage.getItem(`gameState-${currentDate}`));
    const completionTime = savedGameState.completionTime || parseFloat(localStorage.getItem(`totalElapsedTime-${currentDate}`)) || 0;
    
    console.log(`Completion time from saved state: ${completionTime}ms`);

    const minutes = Math.floor(completionTime / 60000);
    const seconds = Math.floor((completionTime % 60000) / 1000);
    const timeString = `${minutes}m ${seconds}s`;

    console.log(`Displaying completion time: ${timeString}`);

    const completionModal = document.getElementById('completion-modal');
    const completionMessage = document.getElementById('completion-message');
    const completionShareButton = document.getElementById('completion-share-button');
    const completionOkButton = document.getElementById('completion-ok-button');
    const nextPuzzleMessage = document.getElementById('next-puzzle-message');
    
    if (completionModal && completionMessage && completionShareButton && completionOkButton && nextPuzzleMessage) {
        completionMessage.innerText = `Congratulations! You have completed the puzzle correctly in ${timeString}!`;
        completionShareButton.style.display = 'inline-block';
        completionOkButton.style.display = 'none';
        
        startNextPuzzleCountdown(nextPuzzleMessage);
        
        completionModal.style.display = 'block';
        
        clues.forEach((clue, clueIndex) => {
            for (let i = 0; i < clue.answer.length; i++) {
                const tile = document.getElementById(`answer-${clueIndex}-${i}`);
                if (tile) {
                    tile.classList.add('correct');
                    tile.disabled = true;
                }
            }
        });
        
        saveGameState();
    }
}

function resetDailyTimer() {
    const currentDate = new Date().toISOString().split('T')[0];
    const lastPlayedDate = localStorage.getItem('lastPlayedDate');

    if (lastPlayedDate !== currentDate) {
        clearInterval(timerInterval);
        localStorage.removeItem(`totalElapsedTime-${currentDate}`);
        localStorage.removeItem(`gameState-${currentDate}`);  // Clear the entire game state
        localStorage.setItem('lastPlayedDate', currentDate);
    }
}



function showIncorrectCompletionModal() {
    const completionModal = document.getElementById('completion-modal');
    const completionMessage = document.getElementById('completion-message');
    const completionShareButton = document.getElementById('completion-share-button');
    const completionOkButton = document.getElementById('completion-ok-button');
    
    if (completionModal && completionMessage && completionShareButton && completionOkButton) {
        completionMessage.innerText = 'All tiles are filled, but some answers are incorrect.';
        completionShareButton.style.display = 'none';
        completionOkButton.style.display = 'inline-block';
        completionModal.style.display = 'block';
    }
}

function startNextPuzzleCountdown(messageElement) {
    console.log("Starting next puzzle countdown", messageElement); // Debugging line

    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    function updateCountdown() {
        const now = new Date();
        const timeLeft = tomorrow - now;
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        const countdownText = `Next puzzle available in: ${hours}h ${minutes}m ${seconds}s`;
        console.log("Updating countdown:", countdownText); // Debugging line
        messageElement.innerText = countdownText;

        if (timeLeft > 0) {
            setTimeout(updateCountdown, 1000);
        } else {
            messageElement.innerText = 'New puzzle available now!';
        }
    }

    updateCountdown();
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
    const [parsedClueIndex, parsedTileIndex] = parseIndices(clueIndex, tileIndex);
    clearAllHighlights();

    const mappingKey = `${parsedClueIndex}-${parsedTileIndex}`;
    const currentTile = document.getElementById(`answer-${parsedClueIndex}-${parsedTileIndex}`);
    currentTile.classList.add('highlight');
    currentTile.dataset.previousValue = currentTile.value;

    if (revealMappings[difficultyLevel] && revealMappings[difficultyLevel][mappingKey]) {
        const { targetClueIndex, targetLetterIndex } = revealMappings[difficultyLevel][mappingKey];
        const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
        if (targetTile) targetTile.classList.add('highlight');
    }
}

function clearTile(tile, clueIndex, tileIndex) {
    const [parsedClueIndex, parsedTileIndex] = parseIndices(clueIndex, tileIndex);
    tile.value = '';
    tile.dataset.revealed = 'false';
    tile.classList.remove('incorrect');

    if (!autocheck || (autocheck && !tile.disabled)) {
        const mappingKey = `${parsedClueIndex}-${parsedTileIndex}`;
        if (revealMappings[difficultyLevel] && revealMappings[difficultyLevel][mappingKey]) {
            const { targetClueIndex, targetLetterIndex } = revealMappings[difficultyLevel][mappingKey];
            const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
            if (targetTile && (!autocheck || (autocheck && !targetTile.disabled))) {
                targetTile.value = '';
                targetTile.dataset.revealed = 'false';
                targetTile.classList.remove('incorrect');
            }
        }
    }
    saveGameState();
}

function checkTile(clueIndex, tileIndex, correctAnswer, tile) {
    const [parsedClueIndex, parsedTileIndex] = parseIndices(clueIndex, tileIndex);
    const userInput = tile.value.trim();
    const isCorrect = userInput.toLowerCase() === correctAnswer[parsedTileIndex].toLowerCase();

    if (userInput === '') {
        tile.classList.remove('incorrect', 'correct');
        tile.disabled = false; // Add this line
    } else if (isCorrect) {
        tile.classList.remove('incorrect');
        tile.classList.add('correct');
        tile.disabled = autocheck; // Change this line
    } else {
        tile.classList.remove('correct');
        tile.disabled = false; // Add this line
        if (autocheck) {
            tile.classList.add('incorrect');
        }
    }

    propagateLetter(parsedClueIndex, parsedTileIndex, tile.value);
}

function propagateLetter(clueIndex, tileIndex, value) {
    const mappingKey = `${clueIndex}-${tileIndex}`;
    if (revealMappings[difficultyLevel] && revealMappings[difficultyLevel][mappingKey]) {
        const { targetClueIndex, targetLetterIndex } = revealMappings[difficultyLevel][mappingKey];
        const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
        if (targetTile) {
            targetTile.value = value.toUpperCase();
            targetTile.dataset.revealed = 'true';

            // Check correctness against the target clue
            const targetClue = clues[targetClueIndex];
            const isCorrect = value.toLowerCase() === targetClue.answer[targetLetterIndex].toLowerCase();

            if (autocheck) {
                if (isCorrect) {
                    targetTile.classList.remove('incorrect');
                    targetTile.classList.add('correct');
                    targetTile.disabled = true;
                } else {
                    targetTile.classList.remove('correct');
                    targetTile.classList.add('incorrect');
                    targetTile.disabled = false;
                }
            } else {
                targetTile.classList.remove('correct', 'incorrect');
                targetTile.disabled = false;
            }
        }
    }
    saveGameState();
}

function handleKeydown(event, clueIndex, tileIndex) {
    const [parsedClueIndex, parsedTileIndex] = parseIndices(clueIndex, tileIndex);
    const tile = document.getElementById(`answer-${parsedClueIndex}-${parsedTileIndex}`);

    if (event.key === 'Backspace') {
        event.preventDefault();
        if (tile.value !== '') {
            clearTile(tile, parsedClueIndex, parsedTileIndex);
        } else {
            if (!autocheck) {
                handleBackspaceNoAutoCheck(parsedClueIndex, parsedTileIndex);
            } else {
                handleBackspaceAutoCheck(parsedClueIndex, parsedTileIndex);
            }
        }
    } else if (event.key === 'Delete') {
        event.preventDefault();
        if (tile.value !== '') {
            clearTile(tile, parsedClueIndex, parsedTileIndex);
            const nextTile = getNextTile(parsedClueIndex, parsedTileIndex);
            if (nextTile) {
                nextTile.focus();
            }
        } else {
            const previousTile = getPreviousTile(parsedClueIndex, parsedTileIndex);
            if (previousTile) {
                previousTile.focus();
                if (previousTile.value !== '') {
                    clearTile(previousTile, parseIndex(previousTile.dataset.clueIndex), parseIndex(previousTile.dataset.tileIndex));
                }
            }
        }
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveLeft(parsedClueIndex, parsedTileIndex);
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveRight(parsedClueIndex, parsedTileIndex);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveToPreviousClue(parsedClueIndex, parsedTileIndex);
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveToNextClue(parsedClueIndex);
    }
}

function moveToPreviousClue(clueIndex, tileIndex) {
    let previousClueIndex = clueIndex - 1;

    while (previousClueIndex >= 0) {
        const previousClueLength = clues[previousClueIndex].answer.length;
        for (let i = previousClueLength - 1; i >= 0; i--) {
            const previousTile = document.getElementById(`answer-${previousClueIndex}-${i}`);
            if (previousTile && (!autocheck || (autocheck && !previousTile.disabled && previousTile.value.trim() === ''))) {
                previousTile.focus();
                return;
            }
        }
        previousClueIndex--;
    }

    // If no empty tile is found above, wrap around to the last clue
    for (let i = clues.length - 1; i > clueIndex; i--) {
        const clueLength = clues[i].answer.length;
        for (let j = clueLength - 1; j >= 0; j--) {
            const tile = document.getElementById(`answer-${i}-${j}`);
            if (tile && (!autocheck || (autocheck && !tile.disabled && tile.value.trim() === ''))) {
                tile.focus();
                return;
            }
        }
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

    // If we've reached here, move to the next clue
    moveToNextClue(clueIndex);
}

function moveToNextClue(clueIndex) {
    let nextClueIndex = clueIndex + 1;
    let loopCount = 0;

    while (loopCount < clues.length) {
        if (nextClueIndex >= clues.length) {
            nextClueIndex = 0;
        }

        const nextClue = clues[nextClueIndex];
        if (nextClue && nextClue.answer) {
            for (let i = 0; i < nextClue.answer.length; i++) {
                const nextTile = document.getElementById(`answer-${nextClueIndex}-${i}`);
                if (nextTile && (nextTile.value.trim() === '' || (autocheck && nextTile.classList.contains('incorrect')))) {
                    nextTile.focus();
                    return;
                }
            }
        }

        nextClueIndex++;
        loopCount++;
    }
}

function handleInput(event, clueIndex, tileIndex, correctAnswer) {
    const [parsedClueIndex, parsedTileIndex] = parseIndices(clueIndex, tileIndex);
    const tile = document.getElementById(`answer-${parsedClueIndex}-${parsedTileIndex}`);
    const previousValue = tile.dataset.previousValue || '';
    const userInput = event.target.value.trim().toUpperCase();

    if (previousValue && previousValue !== userInput) {
        clearTile(tile, parsedClueIndex, parsedTileIndex);
    }

    tile.value = userInput;

    if (tile.value.length > 1) {
        tile.value = tile.value.slice(-1);
    }

    tile.dataset.previousValue = tile.value;
    
    // Check and propagate the letter
    checkTile(parsedClueIndex, parsedTileIndex, correctAnswer, tile);
    propagateLetter(parsedClueIndex, parsedTileIndex, tile.value);

    if (tile.value === '') {
        clearTile(tile, parsedClueIndex, parsedTileIndex);
    } else if (tile.value.length === 1 && parsedTileIndex < correctAnswer.length - 1) {
        focusNextTile(parsedClueIndex, parsedTileIndex);
    } else if (tile.value.length === 1 && parsedTileIndex === correctAnswer.length - 1) {
        moveToNextClue(parsedClueIndex);
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
        clearTile(previousTile, parseIndex(previousTile.dataset.clueIndex), parseIndex(previousTile.dataset.tileIndex));
        previousTile.focus();
    }
    saveGameState();
}

function handleBackspaceAutoCheck(clueIndex, tileIndex) {
    const currentTile = document.getElementById(`answer-${clueIndex}-${tileIndex}`);
    if (currentTile.value !== '') {
        clearTile(currentTile, clueIndex, tileIndex);
        return;
    }

    let previousTile = getPreviousTile(clueIndex, tileIndex);

    while (previousTile && previousTile.value.toLowerCase() === clues[previousTile.dataset.clueIndex]?.answer[previousTile.dataset.tileIndex]?.toLowerCase()) {
        previousTile = getPreviousTile(parseIndex(previousTile.dataset.clueIndex), parseIndex(previousTile.dataset.tileIndex));
    }

    while (previousTile && previousTile.disabled) {
        previousTile = getPreviousTile(parseIndex(previousTile.dataset.clueIndex), parseIndex(previousTile.dataset.tileIndex));
    }

    if (previousTile) {
        clearTile(previousTile, parseIndex(previousTile.dataset.clueIndex), parseIndex(previousTile.dataset.tileIndex));
        previousTile.focus();
    }
    saveGameState();
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
            previousTile = getPreviousTile(parseIndex(previousTile.dataset.clueIndex), parseIndex(previousTile.dataset.tileIndex));
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
            const currentClueIndex = parseIndex(nextTile.dataset.clueIndex);
            const currentTileIndex = parseIndex(nextTile.dataset.tileIndex);
            nextTile = getNextTile(currentClueIndex, currentTileIndex);
        }
    }

    if (nextTile) {
        nextTile.focus();
    }
}

function deletePropagatedLetter(clueIndex, tileIndex) {
    const mappingKey = `${clueIndex}-${tileIndex}`;
    if (revealMappings[difficultyLevel] && revealMappings[difficultyLevel][mappingKey]) {
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
    const [parsedClueIndex, parsedTileIndex] = parseIndices(clueIndex, tileIndex);
    const mappingKey = `${parsedClueIndex}-${parsedTileIndex}`;
    const currentTile = document.getElementById(`answer-${parsedClueIndex}-${parsedTileIndex}`);
    currentTile.classList.remove('highlight');
    if (revealMappings[difficultyLevel] && revealMappings[difficultyLevel][mappingKey]) {
        const { targetClueIndex, targetLetterIndex } = revealMappings[difficultyLevel][mappingKey];
        const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
        if (targetTile) targetTile.classList.remove('highlight');
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

    if (allFilled && allCorrect) {
        clearInterval(timerInterval); // Stop the timer immediately
        
        const completionModal = document.getElementById('completion-modal');
        const completionMessage = document.getElementById('completion-message');
        const completionShareButton = document.getElementById('completion-share-button');
        const completionOkButton = document.getElementById('completion-ok-button');
        
        if (completionModal && completionMessage && completionShareButton && completionOkButton) {
            const currentDate = new Date().toISOString().split('T')[0];
            updateElapsedTime(); // Update one last time
            const totalElapsedTime = parseFloat(localStorage.getItem(`totalElapsedTime-${currentDate}`)) || 0;
            
            const minutes = Math.floor(totalElapsedTime / 60000);
            const seconds = Math.floor((totalElapsedTime % 60000) / 1000);
            const timeString = `${minutes}m ${seconds}s`;

            completionMessage.innerText = `Congratulations! You have completed the puzzle correctly in ${timeString}!`;
            completionShareButton.style.display = 'inline-block';
            completionOkButton.style.display = 'none';
            completionModal.style.display = 'block';
            
            // Mark all tiles as correct and disable them
            clues.forEach((clue, clueIndex) => {
                for (let i = 0; i < clue.answer.length; i++) {
                    const tile = document.getElementById(`answer-${clueIndex}-${i}`);
                    if (tile) {
                        tile.classList.add('correct');
                        tile.disabled = true;
                    }
                }
            });
            
            saveGameState(); // Save the final state
        }
    } else if (allFilled) {
        const completionModal = document.getElementById('completion-modal');
        const completionMessage = document.getElementById('completion-message');
        const completionShareButton = document.getElementById('completion-share-button');
        const completionOkButton = document.getElementById('completion-ok-button');
        
        if (completionModal && completionMessage && completionShareButton && completionOkButton) {
            completionMessage.innerText = 'All tiles are filled, but some answers are incorrect.';
            completionShareButton.style.display = 'none';
            completionOkButton.style.display = 'inline-block';
            completionModal.style.display = 'block';
        }
    }
}



function sharePuzzle() {
    const shareUrl = 'https://alphabetclues.com';
    const shareText = 'Check out this Alphabet Clues puzzle!';

    if (navigator.share) {
        navigator.share({
            title: 'Alphabet Clues',
            text: shareText,
            url: shareUrl,
        })
        .then(() => console.log('Successful share'))
        .catch((error) => console.log('Error sharing:', error));
    } else {
        // Fallback for browsers that don't support the Web Share API
        const fallbackShareText = `${shareText} ${shareUrl}`;
        prompt('Copy this link to share:', fallbackShareText);
    }
}

function updateElapsedTime() {
    const currentDate = new Date().toISOString().split('T')[0];
    const now = new Date();
    const storedElapsedTime = parseFloat(localStorage.getItem(`totalElapsedTime-${currentDate}`)) || 0;
    const elapsedSinceStart = now - startTime;
    const totalElapsedTime = storedElapsedTime + (isNaN(elapsedSinceStart) ? 0 : elapsedSinceStart);
    localStorage.setItem(`totalElapsedTime-${currentDate}`, totalElapsedTime);
    console.log(`Updated elapsed time: ${totalElapsedTime}ms (stored: ${storedElapsedTime}ms, since start: ${elapsedSinceStart}ms)`);
}

window.addEventListener('beforeunload', function() {
    saveGameState();
});

document.addEventListener('visibilitychange', function() {
    const currentDate = new Date().toISOString().split('T')[0];
    const savedGameState = localStorage.getItem(`gameState-${currentDate}`);

    if (document.hidden) {
        clearInterval(timerInterval);
        saveGameState();
    } else if (savedGameState) {
        const gameState = JSON.parse(savedGameState);
        if (!gameState.isCompleted) {
            startTimer(); // Resume timer
        }
    }
});