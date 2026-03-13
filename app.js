require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// DIAGNOSTIC ROUTE - This MUST work for the scan to work
app.get('/test-models', async (req, res) => {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${process.env.GEMINI_KEY}`);
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No image uploaded.");

        // FORCE v1 and use the Lite model for best Free Tier stability
        const model = genAI.getGenerativeModel(
            { model: "gemini-2.0-flash-lite" }, 
            { apiVersion: 'v1' }
        );

        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        const result = await model.generateContent([
            "Identify this artifact. Provide a short Title and an interesting Description in English.", 
            imagePart
        ]);
        
        const response = await result.response;
        const text = response.text();
        const title = text.split('\n')[0].replace(/[*#]/g, '').trim() || "Artifact Found";

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
                            <img src="data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}">
                            <div style="padding: 15px; text-align: left;"><p>${text}</p></div>
                        </div>
                        <a href="/" style="display:block; margin-top:20px; color: #3b82f6;">← Scan Another</a>
                    </div>
                </body>
            </html>
        `);

    } catch (error) {
        console.error("API Error:", error.message);
        const isQuota = error.message.includes("429");
        res.status(isQuota ? 429 : 500).send(`
            <html>
                <head><link rel="stylesheet" href="/style.css"></head>
                <body>
                    <div class="container">
                        <h2 style="color: #ef4444;">${isQuota ? "System Busy" : "Technical Error"}</h2>
                        <p>${isQuota ? "Please wait 60 seconds for the free tier to reset." : error.message}</p>
                        <a href="/">Try Again</a>
                    </div>
                </body>
            </html>
        `);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});