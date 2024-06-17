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
            revealMapping = data.revealMapping;

            // Generate reverse mappings automatically
            Object.keys(revealMapping).forEach(key => {
                const mapping = revealMapping[key];
                const targetClueLetter = clues[mapping.targetClueIndex].letter;
                revealMapping[targetClueLetter] = {
                    sourceLetterIndex: mapping.targetLetterIndex,
                    targetClueIndex: clues.findIndex(clue => clue.letter === key),
                    targetLetterIndex: mapping.sourceLetterIndex,
                    index: mapping.index
                };
            });

            setupGame();
        })
        .catch(error => {
            console.error('Error loading puzzle:', error);
            alert('Puzzle not found for today. Please check back later.');
        });
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
            
            // Check if this tile should have an index
            Object.keys(revealMapping).forEach(key => {
                const mapping = revealMapping[key];
                if ((mapping.sourceLetterIndex === i && clues[index].letter === key) || 
                    (mapping.targetLetterIndex === i && index === mapping.targetClueIndex)) {
                    const indexLabel = document.createElement('span');
                    indexLabel.className = 'tile-index';
                    indexLabel.innerText = mapping.index;
                    tileWrapper.appendChild(indexLabel);
                    tile.classList.add('index-' + mapping.index);
                    tile.dataset.index = mapping.index;
                }
            });

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

function handleInput(clueIndex, tileIndex, correctAnswer) {
    const tile = document.getElementById(`answer-${clueIndex}-${tileIndex}`);
    tile.value = tile.value.toUpperCase(); // Ensure input is capitalized
    const userInput = tile.value.trim();

    checkTile(clueIndex, tileIndex, correctAnswer, tile);

    if (userInput !== '') {
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
    // Check if this clue has a reveal mapping
    const clueLetter = clues[clueIndex].letter;
    if (revealMapping[clueLetter] && revealMapping[clueLetter].sourceLetterIndex === tileIndex) {
        const { targetClueIndex, targetLetterIndex } = revealMapping[clueLetter];
        const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
        targetTile.value = value.toUpperCase(); // Populate regardless of correctness
        targetTile.dataset.revealed = 'true'; // Mark the tile as revealed
    }

    // Check if this tile should reveal another tile based on reverse mapping
    Object.keys(revealMapping).forEach(key => {
        const mapping = revealMapping[key];
        if (mapping.targetClueIndex === clueIndex && mapping.targetLetterIndex === tileIndex) {
            const sourceTile = document.getElementById(`answer-${mapping.targetClueIndex}-${mapping.targetLetterIndex}`);
            sourceTile.value = value.toUpperCase(); // Populate regardless of correctness
            sourceTile.dataset.revealed = 'true'; // Mark the tile as revealed
        }
    });
}

function handleKeydown(event, clueIndex, tileIndex) {
    const tile = document.getElementById(`answer-${clueIndex}-${tileIndex}`);

    if (event.key === 'Backspace') {
        event.preventDefault();
        if (tile.value !== '') {
            clearTile(tile);
        } else {
            if (!autocheck) {
                handleBackspaceNoAutoCheck(clueIndex, tileIndex);
            } else {
                handleBackspaceAutoCheck(clueIndex, tileIndex);
            }
        }
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveLeft(clueIndex, tileIndex);
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveRight(clueIndex, tileIndex);
    }
}

function handleBackspaceNoAutoCheck(clueIndex, tileIndex) {
    const currentTile = document.getElementById(`answer-${clueIndex}-${tileIndex}`);
    if (currentTile.value !== '') {
        clearTile(currentTile);
        return;
    }
    
    let previousTile = getPreviousTile(clueIndex, tileIndex);

    if (previousTile) {
        if (previousTile.classList.contains('index-' + getTileIndex(previousTile))) {
            clearTile(previousTile);
            clearTile(document.getElementById(`answer-${revealMapping[clues[clueIndex].letter].targetClueIndex}-${revealMapping[clues[clueIndex].letter].targetLetterIndex}`));
        } else {
            clearTile(previousTile);
        }
        previousTile.focus();
    }
}

function handleBackspaceAutoCheck(clueIndex, tileIndex) {
    const currentTile = document.getElementById(`answer-${clueIndex}-${tileIndex}`);
    if (currentTile.value !== '') {
        clearTile(currentTile);
        return;
    }

    let previousTile = getPreviousTile(clueIndex, tileIndex);

    console.log(`Starting Backspace: clueIndex=${clueIndex}, tileIndex=${tileIndex}`);

    while (previousTile && previousTile.value.toLowerCase() === clues[previousTile.dataset.clueIndex]?.answer[previousTile.dataset.tileIndex]?.toLowerCase()) {
        console.log(`Skipping correct tile: clueIndex=${previousTile.dataset.clueIndex}, tileIndex=${previousTile.dataset.tileIndex}`);
        previousTile = getPreviousTile(previousTile.dataset.clueIndex, previousTile.dataset.tileIndex);
    }

    while (previousTile && previousTile.disabled) {
        console.log(`Skipping disabled tile: clueIndex=${previousTile.dataset.clueIndex}, tileIndex=${previousTile.dataset.tileIndex}`);
        previousTile = getPreviousTile(previousTile.dataset.clueIndex, previousTile.dataset.tileIndex);
    }

    if (previousTile) {
        if (previousTile.value === '') {
            console.log(`Focusing empty tile: clueIndex=${previousTile.dataset.clueIndex}, tileIndex=${previousTile.dataset.tileIndex}`);
            previousTile.focus();
        } else if (previousTile.classList.contains('incorrect')) {
            console.log(`Clearing incorrect tile: clueIndex=${previousTile.dataset.clueIndex}, tileIndex=${previousTile.dataset.tileIndex}`);
            clearTile(previousTile);
            if (previousTile.classList.contains('index-' + getTileIndex(previousTile))) {
                // Clear the corresponding propagated letter tile
                const mapping = revealMapping[clues[previousTile.dataset.clueIndex].letter];
                clearTile(document.getElementById(`answer-${mapping.targetClueIndex}-${mapping.targetLetterIndex}`));
            }
            previousTile.focus();
        } else if (previousTile.classList.contains('index-' + getTileIndex(previousTile))) {
            console.log(`Clearing index tile: clueIndex=${previousTile.dataset.clueIndex}, tileIndex=${previousTile.dataset.tileIndex}`);
            // Clear the value of the index tile and its corresponding tile
            const mapping = revealMapping[clues[previousTile.dataset.clueIndex].letter];
            clearTile(previousTile);
            clearTile(document.getElementById(`answer-${mapping.targetClueIndex}-${mapping.targetLetterIndex}`));
            previousTile.focus();
        }
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

    console.log(`getPreviousTile: clueIndex=${previousTile?.dataset.clueIndex}, tileIndex=${previousTile?.dataset.tileIndex}`);
    return previousTile;
}


function clearTile(tile) {
    tile.value = '';
    tile.dataset.revealed = 'false';
    tile.classList.remove('incorrect');
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


function deletePropagatedLetter(clueIndex, tileIndex) {
    const clueLetter = clues[clueIndex].letter;

    // Handle direct mapping
    if (revealMapping[clueLetter] && revealMapping[clueLetter].sourceLetterIndex === tileIndex) {
        const { targetClueIndex, targetLetterIndex } = revealMapping[clueLetter];
        const targetTile = document.getElementById(`answer-${targetClueIndex}-${targetLetterIndex}`);
        if (targetTile && targetTile.classList.contains('index-' + revealMapping[clueLetter].index)) {
            targetTile.value = ''; // Clear the propagated letter
            targetTile.dataset.revealed = 'false'; // Mark it as not revealed
            targetTile.classList.remove('incorrect');
        }
    }

    // Handle reverse mapping
    Object.keys(revealMapping).forEach(key => {
        const mapping = revealMapping[key];
        if (mapping.targetClueIndex === clueIndex && mapping.targetLetterIndex === tileIndex) {
            const sourceTile = document.getElementById(`answer-${mapping.targetClueIndex}-${mapping.targetLetterIndex}`);
            if (sourceTile && sourceTile.classList.contains('index-' + mapping.index)) {
                sourceTile.value = ''; // Clear the propagated letter
                sourceTile.dataset.revealed = 'false'; // Mark it as not revealed
                sourceTile.classList.remove('incorrect');
            }
        }
    });
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

// Initialize the game immediately
document.addEventListener('DOMContentLoaded', initializeGame);
