const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/generate', (req, res) => {
    const dateParam = req.query.date;
    const selectedDate = new Date(dateParam);
    const puzzleNumber = dateToPuzzleNumber(selectedDate);
    const htmlFilePath = path.join(__dirname, 'public', 'puzzles', 'html', `${puzzleNumber}.html`);
    const jsonFilePath = path.join(__dirname, 'public', 'puzzles', 'json', `${puzzleNumber}.json`);

    // Check if the puzzle already exists
    if (fs.existsSync(htmlFilePath)) {
        return res.status(400).send('Puzzle already exists for the selected date.');
    }

    // Generate puzzle JSON
    const puzzleData = generatePuzzleData();
    fs.writeFileSync(jsonFilePath, JSON.stringify(puzzleData, null, 2), 'utf-8');

    // Generate puzzle HTML
    const puzzleHtml = generatePuzzleHtml(puzzleData);
    fs.writeFileSync(htmlFilePath, puzzleHtml, 'utf-8');

    res.send('Puzzle generated successfully.');
});

function dateToPuzzleNumber(date) {
    const startDate = new Date(2024, 6, 18); // July 18, 2024
    const diffTime = Math.abs(date - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return 100 + diffDays;
}

function generatePuzzleData() {
    // Implement your puzzle data generation logic here
    return {
        clues: [
            { type: 'contains', letter: 'A', clue: 'Clue for A', answer: 'ANSWER' },
            { type: 'starts_with', letter: 'B', clue: 'Clue for B', answer: 'BEGIN' },
            // Add more clues as needed
        ]
    };
}

function generatePuzzleHtml(puzzleData) {
    let html = `
    <div id="clue-section-container">
        ${puzzleData.clues.map((clue, index) => `
            <div class="clue-section">
                <div class="clue">
                    <span class="clue-type">${clue.type === 'contains' ? 'Contains' : 'Starts with'} ${clue.letter}</span><br>${clue.clue}
                </div>
                <div class="tile-container">
                    ${clue.answer.split('').map((_, i) => `
                        <div class="tile-wrapper">
                            <input type="text" maxlength="2" class="tile" id="answer-${index}-${i}" data-clue-index="${index}" data-tile-index="${i}" autocomplete="off">
                        </div>
                    `).join('')}
                </div>
                <span class="result" id="result-${index}"></span>
            </div>
        `).join('')}
    </div>
    `;
    return html;
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
