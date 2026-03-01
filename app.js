require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Configurare Google Gemini folosind cheia nouă
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.json());

app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!process.env.GEMINI_KEY) {
            return res.status(500).json({ error: "API key is missing on server" });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = req.body.prompt || "Analizează această imagine în limba română.";

        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        res.json({ text: response.text() });
    } catch (error) {
        console.error("Eroare:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server activ pe portul ${port}`);
});