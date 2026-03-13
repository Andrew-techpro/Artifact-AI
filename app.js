require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Configurare cu forțare API v1 pentru a evita eroarea 404
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.json());

let scanHistory = [];
let temporaryScan = null; // Stocăm scanarea până când utilizatorul decide Save/Discard

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No file uploaded");

        // FIX CRITIC: Specificăm modelul fără v1beta
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        const result = await model.generateContent([
            "Identify this artifact. Provide a short Title and a Description.", 
            imagePart
        ]);
        const response = await result.response;
        const text = response.text();

        // Extragem un titlu din prima linie
        const title = text.split('\n')[0].replace(/[*#]/g, '').trim() || "New Artifact";

        // Salvăm temporar
        temporaryScan = {
            id: Date.now(),
            title: title,
            description: text,
            image: `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`
        };

        res.send(`
            <html>
                <head><link rel="stylesheet" href="/style.css"></head>
                <body>
                    <div class="container">
                        <h1>${temporaryScan.title}</h1>
                        <div class="card">
                            <img src="${temporaryScan.image}" style="width:100%; border-radius:10px;">
                            <p>${temporaryScan.description}</p>
                        </div>
                        <div style="display:flex; gap:10px; margin-top:20px;">
                            <button onclick="location.href='/save'" style="background:#22c55e;">SAVE SCAN</button>
                            <button onclick="location.href='/'" style="background:#ef4444;">DISCARD</button>
                        </div>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error(error);
        res.status(500).send(`<h1>Error</h1><p>${error.message}</p><a href="/">Back</a>`);
    }
});

app.get('/save', (req, res) => {
    if (temporaryScan) {
        scanHistory.unshift(temporaryScan);
        temporaryScan = null;
    }
    res.redirect('/history');
});

app.get('/history', (req, res) => {
    let cardsHTML = scanHistory.map(s => `
        <div class="card">
            <img src="${s.image}">
            <h3>${s.title}</h3>
            <p>${s.description.substring(0, 100)}...</p>
        </div>
    `).join('');
    
    res.send(`
        <html>
            <head><link rel="stylesheet" href="/style.css"></head>
            <body>
                <div class="container" style="max-width: 800px;">
                    <h1>Your Collection</h1>
                    <div class="grid">${cardsHTML || "<p>Empty</p>"}</div>
                    <a href="/">+ Add New Scan</a>
                </div>
            </body>
        </html>
    `);
});

app.listen(port, () => console.log(`Server started on port ${port}`));