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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!process.env.GEMINI_KEY) throw new Error("API key is missing");
        if (!req.file) throw new Error("No image uploaded");

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const base64Data = req.file.buffer.toString("base64");

        const imagePart = {
            inlineData: { data: base64Data, mimeType: req.file.mimetype }
        };

        const result = await model.generateContent(["Identify this artifact, give it a title and a short description.", imagePart]);
        const response = await result.response;
        const text = response.text();

        const title = text.split('\n')[0].replace('#', '').trim() || "Artifact Scan";

        const newScan = {
            id: Date.now(),
            title: title,
            description: text.substring(0, 100) + "...",
            image: `data:${req.file.mimetype};base64,${base64Data}`
        };
        scanHistory.unshift(newScan);

        res.send(`
            <html>
                <head>
                    <link rel="stylesheet" href="/style.css">
                    <title>Result - Artifact AI</title>
                </head>
                <body>
                    <div class="container">
                        <h1>Analysis Result</h1>
                        <div class="card" style="text-align:left; padding:20px;">
                            <img src="${newScan.image}" style="width:100%; border-radius:10px; margin-bottom:15px;">
                            <h3>${title}</h3>
                            <p>${text}</p>
                        </div>
                        <a href="/history" style="background:#3b82f6; color:white; padding:10px 20px; border-radius:5px; display:inline-block; margin-top:20px;">Add to Collection</a>
                        <br><a href="/">Scan another</a>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send(`<h1>Error</h1><p>${error.message}</p><a href="/">Back</a>`);
    }
});

app.get('/history', (req, res) => {
    let cardsHTML = scanHistory.map(scan => `
        <div class="card">
            <img src="${scan.image}" alt="artifact">
            <h3>${scan.title}</h3>
            <p>${scan.description}</p>
        </div>
    `).join('');

    if (scanHistory.length === 0) {
        cardsHTML = "<p>Your collection is empty. Start scanning!</p>";
    }

    res.send(`
        <html>
            <head>
                <link rel="stylesheet" href="/style.css">
                <title>Your Collection - Artifact AI</title>
            </head>
            <body>
                <div class="container">
                    <h1>🏺 Your Collection</h1>
                    <div class="grid">${cardsHTML}</div>
                    <a href="/" style="margin-top:30px; display:block;">+ ADD NEW SCAN</a>
                </div>
            </body>
        </html>
    `);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});