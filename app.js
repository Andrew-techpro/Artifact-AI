require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Inițializare Google AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.json());

// Baza de date temporară pentru istoric
let scanHistory = [];
let temporaryScan = null;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// RUTA DE ANALIZĂ - Aici am aplicat fix-ul pentru eroarea 404
app.post('/analyze', upload.single('image'), async (req, res) => {
    console.log("--- Început Analiză ---");
    try {
        if (!req.file) return res.status(400).send("Nu ai urcat nicio imagine.");

        // FIX CRITIC: Forțăm apiVersion 'v1' pentru a evita v1beta (care dă 404)
        const model = genAI.getGenerativeModel(
            { model: "gemini-1.5-flash" },
            { apiVersion: 'v1' } 
        );

        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        const result = await model.generateContent([
            "Identifică acest artefact. Oferă un Titlu scurt și o Descriere interesantă.", 
            imagePart
        ]);
        
        const response = await result.response;
        const text = response.text();

        // Extragem titlul (prima linie)
        const title = text.split('\n')[0].replace(/[*#]/g, '').trim() || "Artefact Nou";

        // Salvăm în variabila temporară pentru butonul SAVE
        temporaryScan = {
            id: Date.now(),
            title: title,
            description: text,
            image: `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`
        };

        // Pagina de rezultat cu designul compact (narrow)
        res.send(`
            <html>
                <head>
                    <link rel="stylesheet" href="/style.css">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body>
                    <div class="container">
                        <h1 style="color: #3b82f6;">${title}</h1>
                        <div class="card">
                            <img src="${temporaryScan.image}">
                            <div style="padding: 15px; text-align: left;">
                                <p>${text}</p>
                            </div>
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
        console.error("DETALII EROARE:", error.message);
        res.status(500).send(`
            <html>
                <head><link rel="stylesheet" href="/style.css"></head>
                <body>
                    <div class="container">
                        <h2 style="color: #ef4444;">Eroare API</h2>
                        <p>${error.message}</p>
                        <a href="/">Înapoi la scanare</a>
                    </div>
                </body>
            </html>
        `);
    }
});

// Ruta pentru salvarea efectivă în istoric
app.get('/save', (req, res) => {
    if (temporaryScan) {
        scanHistory.unshift(temporaryScan); // Adaugă la începutul listei
        temporaryScan = null; // Golește buffer-ul
    }
    res.redirect('/history');
});

// Pagina cu colecția de artefacte
app.get('/history', (req, res) => {
    let cardsHTML = scanHistory.map(s => `
        <div class="card" style="margin-bottom: 20px;">
            <img src="${s.image}">
            <h3 style="padding: 10px;">${s.title}</h3>
        </div>
    `).join('');
    
    res.send(`
        <html>
            <head><link rel="stylesheet" href="/style.css"></head>
            <body>
                <div class="container" style="max-width: 500px;">
                    <h1>🏺 Colecția Ta</h1>
                    <div class="grid">${cardsHTML || "<p>Nu ai nicio scanare salvată.</p>"}</div>
                    <a href="/" style="display:block; margin-top:20px;">+ SCANEAZĂ ALTCEVA</a>
                </div>
            </body>
        </html>
    `);
});

app.listen(port, () => {
    console.log(`Serverul rulează pe portul ${port}`);
});