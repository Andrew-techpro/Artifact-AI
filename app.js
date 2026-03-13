require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Inițializare Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.json());

// Baza de date temporară
let scanHistory = [];
let temporaryScan = null; 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// RUTA ANALIZĂ - Repară eroarea 404 și adaugă Save/Discard
app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No file uploaded");

        // FIX: Forțăm apiVersion 'v1' pentru a evita eroarea 404 Not Found
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash" 
        }, { apiVersion: 'v1' }); 

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

        // Curățăm titlul
        const title = text.split('\n')[0].replace(/[*#]/g, '').trim() || "New Artifact";

        // Salvăm scanarea în memorie temporară
        temporaryScan = {
            id: Date.now(),
            title: title,
            description: text,
            image: `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`
        };

        res.send(`
            <html>
                <head>
                    <link rel="stylesheet" href="/style.css">
                    <title>Result - Artifact AI</title>
                </head>
                <body>
                    <div class="container">
                        <h1 style="color: #3b82f6;">${title}</h1>
                        <div class="card">
                            <img src="${temporaryScan.image}" style="width:100%; border-radius:10px;">
                            <p style="text-align: left; font-size: 0.9rem; margin-top: 15px;">${text}</p>
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
        res.status(500).send(`<html><head><link rel="stylesheet" href="/style.css"></head><body><div class="container"><h1>Error</h1><p>${error.message}</p><a href="/">Back</a></div></body></html>`);
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
                <div class="container" style="max-width: 600px;">
                    <h1>🏺 Your Collection</h1>
                    <div class="grid">${cardsHTML || "<p>Your collection is empty.</p>"}</div>
                    <a href="/">+ ADD NEW SCAN</a>
                </div>
            </body>
        </html>
    `);
});

app.listen(port, () => console.log(`Server started on port ${port}`));