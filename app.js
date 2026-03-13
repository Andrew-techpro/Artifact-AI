require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.json());

let scanHistory = [];
let temporaryScan = null;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/analyze', upload.single('image'), async (req, res) => {
    console.log("--- Analysis Started ---");
    try {
        if (!req.file) return res.status(400).send("No image uploaded.");

        // STRATEGY CHANGE: Using the -latest suffix which often resolves routing 404s
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        const result = await model.generateContent([
            "Identify this artifact. Provide a short Title and an interesting Description.", 
            imagePart
        ]);
        
        const response = await result.response;
        const text = response.text();

        const title = text.split('\n')[0].replace(/[*#]/g, '').trim() || "New Artifact";

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
        console.error("API ERROR:", error.message);
        res.status(500).send(`
            <html>
                <head><link rel="stylesheet" href="/style.css"></head>
                <body>
                    <div class="container">
                        <h2 style="color: #ef4444;">Connection Error</h2>
                        <p>${error.message}</p>
                        <a href="/">Back to Scan</a>
                    </div>
                </body>
            </html>
        `);
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
                    <h1>🏺 Your Collection</h1>
                    <div class="grid">${cardsHTML || "<p>No scans saved yet.</p>"}</div>
                    <a href="/" style="display:block; margin-top:20px;">+ SCAN SOMETHING ELSE</a>
                </div>
            </body>
        </html>
    `);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});