require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai'); // NEW 2026 SDK
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Initialize using the new Client object pattern
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No image provided.");

        const base64Image = req.file.buffer.toString("base64");

        // Using the 2026 Stable Workhorse Model
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: [
                { type: 'text', text: 'Identify this artifact. Provide a Title and a brief history.' },
                { type: 'image', data: base64Image, mime_type: req.file.mimetype }
            ]
        });

        const resultText = response.text;

        res.send(`
            <div style="font-family:sans-serif; max-width:600px; margin:auto; text-align:center;">
                <h1 style="color:#2563eb;">Analysis Complete</h1>
                <img src="data:${req.file.mimetype};base64,${base64Image}" style="width:100%; border-radius:12px;">
                <div style="text-align:left; margin-top:20px; line-height:1.6;">${resultText}</div>
                <br><a href="/" style="color:#2563eb; text-decoration:none; font-weight:bold;">← Scan Another</a>
            </div>
        `);

    } catch (error) {
        console.error("Error:", error.message);
        const isQuota = error.message.includes("429");
        res.status(isQuota ? 429 : 500).send(`
            <div style="text-align:center; padding:40px;">
                <h2>${isQuota ? "System Cooling Down" : "Technical Error"}</h2>
                <p>${isQuota ? "The new key is warming up. Wait 60s and try again." : error.message}</p>
                <a href="/">Go Back</a>
            </div>
        `);
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));