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
        if (!req.file) return res.status(400).send("No file uploaded");

        // FIX pentru eroarea 404: Folosim gemini-1.5-flash fara v1beta daca e posibil
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        const result = await model.generateContent(["Analyze this artifact briefly.", imagePart]);
        const response = await result.response;
        const text = response.text();

        const newScan = {
            id: Date.now(),
            title: "Artifact Scan",
            description: text.substring(0, 100) + "...",
            image: `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`
        };
        scanHistory.unshift(newScan);

        res.send(`
            <html>
                <head><link rel="stylesheet" href="/style.css"></head>
                <body>
                    <div class="container">
                        <h1>Result</h1>
                        <div class="card">
                            <p>${text}</p>
                        </div>
                        <a href="/">← Back</a>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error(error);
        res.status(500).send(`<h1>Error</h1><p>${error.message}</p><a href="/">Back</a>`);
    }
});

app.get('/history', (req, res) => {
    let cardsHTML = scanHistory.map(s => `
        <div class="card">
            <img src="${s.image}">
            <h3>${s.title}</h3>
            <p>${s.description}</p>
        </div>
    `).join('');
    
    res.send(`
        <html>
            <head><link rel="stylesheet" href="/style.css"></head>
            <body>
                <div class="container">
                    <h1>Collection</h1>
                    <div class="grid">${cardsHTML || "<p>Empty</p>"}</div>
                    <a href="/">+ Add New</a>
                </div>
            </body>
        </html>
    `);
});

app.listen(port, () => console.log(`Server started on port ${port}`));