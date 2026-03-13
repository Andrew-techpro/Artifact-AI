require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// LOG 1: Verificăm obiectul principal la pornire
console.log("--- DEBUG: INITIALIZING GOOGLE AI ---");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
console.log("genAI Object:", JSON.stringify(genAI, null, 2)); 

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/analyze', upload.single('image'), async (req, res) => {
    console.log("--- DEBUG: NEW SCAN REQUEST RECEIVED ---");
    try {
        if (!req.file) {
            console.log("DEBUG: No file found in request");
            return res.status(400).send("No file uploaded");
        }

        // LOG 2: Vedem ce model încearcă să încarce
        console.log("DEBUG: Fetching model 'gemini-1.5-flash'...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Model Config:", JSON.stringify(model, null, 2));

        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        console.log("DEBUG: Sending request to Google API...");
        
        const result = await model.generateContent([
            "Identify this artifact. Provide a short Title and Description.", 
            imagePart
        ]);

        console.log("DEBUG: Waiting for AI response...");
        const response = await result.response;
        const text = response.text();
        
        console.log("DEBUG: Success! Received text length:", text.length);

        res.send(`
            <html>
                <head><link rel="stylesheet" href="/style.css"></head>
                <body>
                    <div class="container">
                        <div class="card">
                            <img src="data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}">
                            <p style="text-align: left; padding: 15px;">${text}</p>
                        </div>
                        <button onclick="location.href='/'" style="margin-top: 20px;">BACK</button>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        // LOG 3: Aici prindem eroarea 404 și vedem URL-ul exact
        console.error("--- DEBUG: API ERROR CAUGHT ---");
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);
        console.error("Stack Trace:", error.stack);

        res.status(500).send(`
            <div style="background: #1e1e1e; color: white; padding: 20px; border-radius: 10px; font-family: sans-serif; max-width: 400px; margin: auto;">
                <h2 style="color: #ef4444;">Eroare de Conexiune</h2>
                <p>Mesaj: <strong>${error.message}</strong></p>
                <p style="font-size: 0.8rem; color: #888;">Verifică log-urile din Render pentru detalii.</p>
                <a href="/" style="color: #3b82f6;">Înapoi</a>
            </div>
        `);
    }
});

app.listen(port, () => console.log(`Server is running on port ${port}`));