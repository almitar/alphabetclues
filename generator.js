let clues = [];
let revealMappings = {
    easy: {},
    medium: {},
    advanced: {}
};
let difficultyLevel = 'easy';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Document loaded, initializing event listeners.");
    initializeEventListeners();
});

function initializeEventListeners() {
    const generatePuzzleButton = document.getElementById('generate-puzzle');
    const copyHtmlButton = document.getElementById('copy-html');

    if (generatePuzzleButton) {
        console.log("Adding click event listener to Generate Puzzle button.");
        generatePuzzleButton.addEventListener('click', () => {
            const puzzleDate = document.getElementById('puzzle-date').value;
            console.log("Generate Puzzle button clicked, puzzle date:", puzzleDate);
            if (puzzleDate) {
                fetchPuzzleData(puzzleDate);
            } else {
                alert('Please select a puzzle date.');
            }
        });
    }

    if (copyHtmlButton) {
        console.log("Adding click event listener to Copy HTML button.");
        copyHtmlButton.addEventListener('click', copyGeneratedHtml);
    }
}

function fetchPuzzleData(puzzleDate) {
    const [year, month, day] = puzzleDate.split('-');
    const puzzleFileName = `puzzles/${year.slice(-2)}-${month}-${day}.json`;
    console.log("Fetching puzzle data from file:", puzzleFileName);

    fetch(puzzleFileName)
        .then(response => {
            if (!response.ok) {
                console.error('Puzzle not found for the selected date.');
                throw new Error('Puzzle not found for the selected date.');
            }
            console.log("Puzzle data fetched successfully.");
            return response.json();
        })
        .then(data => {
            console.log("Puzzle data:", data);
            clues = data.clues;
            console.log("Clues loaded:", clues);
            generateAllRevealMappings();
            generatePuzzleHtml(puzzleDate, data);
        })
        .catch(error => {
            console.error('Error loading puzzle:', error);
            alert('Puzzle not found for the selected date. Please check back later.');
        });
}

function generateAllRevealMappings() {
    console.log("Generating reveal mappings for all difficulty levels.");
    ['easy', 'medium', 'advanced'].forEach(level => {
        difficultyLevel = level;
        console.log("Generating reveal mappings for difficulty level:", difficultyLevel);
        generateRevealMappings();
    });
    difficultyLevel = 'easy'; // Reset to default level
    console.log("Reveal mappings generated for all difficulty levels:", revealMappings);
}

function generatePuzzleHtml(puzzleDate, puzzleData) {
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

        <div id="game-container">
          <div id="clue-section-container">
                ${container.innerHTML}
            </div>
        </div>
        <script>
            window.puzzleData = {
                clues: ${JSON.stringify(clues)},
                revealMappings: ${JSON.stringify(revealMappings)}
            };
        </script>
`;

    container.innerHTML = htmlContent;
    console.log("Puzzle HTML generated for date:", puzzleDate);
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
    console.log("Generated HTML copied to clipboard.");
}

function generateRevealMappings() {
    console.log("Generating reveal mappings for current difficulty level:", difficultyLevel);

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
    console.log(`Reveal mappings for ${difficultyLevel} level:`, mappings);
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
