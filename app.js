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

// Pagina principală
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// RUTA ANALYZE - Fix pentru buton
app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!process.env.GEMINI_KEY) {
            return res.status(500).json({ error: "Lipsește cheia API în Render!" });
        }
        if (!req.file) {
            return res.status(400).json({ error: "Nu ai încărcat nicio imagine!" });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        const result = await model.generateContent(["Analyze this artifact and tell me what it is.", imagePart]);
        const response = await result.response;
        
        // Trimitem rezultatul înapoi
        res.send(`<h1>Rezultat Analiză:</h1><p>${response.text()}</p><a href="/">Înapoi</a>`);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// RUTA HISTORY - Fix pentru "Cannot GET /history"
app.get('/history', (req, res) => {
    res.send('<h1>Colecția ta este goală momentan.</h1><a href="/">Înapoi</a>');
});

app.listen(port, () => {
    console.log(`Serverul Artifact AI rulează pe portul ${port}`);
});