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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No image uploaded.");

        // We use 1.5-flash (your original model) 
        // but we add this { apiVersion: 'v1' } to stop the 404
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
            "Identify this artifact. Provide a short Title and an interesting Description in English.", 
            imagePart
        ]);
        
        const response = await result.response;
        const text = response.text();

        // Simple result page
        res.send(`
            <html>
                <head><link rel="stylesheet" href="/style.css"></head>
                <body>
                    <div class="container">
                        <h1>Analysis Result</h1>
                        <div class="card">
                            <img src="data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}">
                            <p>${text}</p>
                        </div>
                        <a href="/">Scan Again</a>
                    </div>
                </body>
            </html>
        `);

    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));