const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to save puzzle
app.post('/save-puzzle', express.json(), (req, res) => {
    const { htmlContent, filename } = req.body;
    const filePath = path.join(__dirname, 'public', 'puzzles', filename);

    fs.writeFile(filePath, htmlContent, (err) => {
        if (err) {
            console.error('Error saving puzzle:', err);
            res.status(500).send('Failed to save puzzle');
        } else {
            res.send('Puzzle saved successfully');
        }
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
