require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 1. Logăm inițializarea API-ului
console.log("--- INITIALIZING GEMINI ---");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
console.log("genAI Object Structure:", JSON.stringify(genAI, null, 2));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/analyze', upload.single('image'), async (req, res) => {
    console.log("--- NEW ANALYSIS REQUEST ---");
    try {
        if (!req.file) {
            console.log("Error: No file in request");
            return res.status(400).send("No file uploaded");
        }

        // 2. Logăm modelul selectat
        console.log("Selecting model: gemini-1.5-flash");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        console.log("Sending data to Google API...");
        
        const result = await model.generateContent([
            "Return a short Title and a Description for this artifact.", 
            imagePart
        ]);

        console.log("Waiting for response...");
        const response = await result.response;
        const text = response.text();
        
        console.log("Success! Response received:", text.substring(0, 50) + "...");

        res.send(`
            <html>
                <head><link rel="stylesheet" href="/style.css"></head>
                <body>
                    <div class="container">
                        <div class="card">
                            <img src="data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}">
                            <p style="padding: 15px; text-align: left;">${text}</p>
                        </div>
                        <button onclick="location.href='/'" style="margin-top: 20px;">BACK</button>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        // 3. Logăm eroarea completă în consolă (pe Render)
        console.error("--- API ERROR DETECTED ---");
        console.error("Message:", error.message);
        console.error("Full Error Stack:", error.stack);
        
        res.status(500).send(`
            <div style="background: #1e1e1e; color: white; padding: 20px; border-radius: 10px; font-family: sans-serif;">
                <h2 style="color: #ef4444;">Eroare de Conexiune</h2>
                <p>Serverul a răspuns: <strong>${error.message}</strong></p>
                <p>Verifică log-urile din Render Dashboard pentru detalii.</p>
                <a href="/" style="color: #3b82f6;">Încearcă din nou</a>
            </div>
        `);
    }
});

app.listen(port, () => console.log(`Server is running on port ${port}`));