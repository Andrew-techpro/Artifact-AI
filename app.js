require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require("@google/genai");

const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true })); 
app.use(express.static('public')); 
app.use('/uploads', express.static('uploads'));

const apiKey = process.env.GEMINI_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <link rel="stylesheet" href="/style.css">
            <title>Artefact AI 2026</title>
        </head>
        <body style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #0f0f0f;">
            <div style="background: #1a1a1a; padding: 40px; border-radius: 15px; border: 1px solid #333; text-align: center; width: 350px; color: white; font-family: sans-serif;">
                <h2 style="color: #007bff; margin-bottom: 5px;">Artefact AI</h2>
                <form action="/upload" method="POST" enctype="multipart/form-data" onsubmit="showLoading()">
                    <input type="file" name="image" required style="margin-bottom: 20px; width: 100%;">
                    <button type="submit" id="submitBtn" style="background: #007bff; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; width: 100%; font-weight: bold;">Analyze Artifact</button>
                </form>
                <div id="loadingMsg" style="display:none; margin-top:20px; color:#007bff;">🔍 Scanning...</div>
                <hr style="border: 0; border-top: 1px solid #333; margin: 25px 0;">
                <a href="/history" style="color: #888; text-decoration: none; font-size: 0.9rem;">View My Collection →</a>
            </div>
            <script>function showLoading(){ document.getElementById('submitBtn').disabled = true; document.getElementById('loadingMsg').style.display = 'block'; }</script>
        </body>
        </html>
    `);
});

app.post('/upload', upload.single('image'), async (req, res) => {
    if (!req.file) return res.send("No file selected.");
    try {
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: [{
                role: 'user',
                parts: [
                    { text: "Identify this artifact. First line: 3-word title. Following lines: Detailed historical analysis (3 paragraphs)." },
                    { inlineData: { data: fs.readFileSync(req.file.path).toString("base64"), mimeType: req.file.mimetype } }
                ]
            }]
        });

        const fullText = result.text;
        const lines = fullText.split('\n');
        const shortTitle = lines[0].replace(/[*#]/g, '').trim();
        const description = lines.slice(1).join('\n').trim();

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <link rel="stylesheet" href="/style.css">
                <title>Scan Results</title>
            </head>
            <body style="background: #0f0f0f; color: white; font-family: sans-serif; padding: 40px;">
                <div style="max-width: 900px; margin: 0 auto;">
                    <h1 style="text-align:center; color:#007bff;">${shortTitle}</h1>
                    <div style="display: flex; gap: 40px; background: #1a1a1a; padding: 30px; border-radius: 20px; border: 1px solid #333; align-items: start;">
                        <img src="/uploads/${req.file.filename}" style="width: 40%; border-radius: 15px; border: 1px solid #444;">
                        <div style="flex: 1;">
                            <h2 style="margin-top:0; color:#007bff;">Discovery Details</h2>
                            <p style="line-height: 1.8; color: #ccc; white-space: pre-wrap;">${description}</p>
                            
                            <div style="display: flex; gap: 15px; margin-top: 30px;">
                                <form action="/confirm-save" method="POST" style="flex:1;">
                                    <input type="hidden" name="id" value="${path.parse(req.file.filename).name}">
                                    <input type="hidden" name="title" value="${shortTitle}">
                                    <input type="hidden" name="imageFile" value="${req.file.filename}">
                                    <input type="hidden" name="analysis" value="${encodeURIComponent(fullText)}">
                                    <button type="submit" style="width:100%; background: #28a745; color: white; border: none; padding: 15px; border-radius: 10px; cursor: pointer; font-weight: bold;">SAVE TO COLLECTION</button>
                                </form>
                                <form action="/discard" method="POST" style="flex:1;">
                                    <input type="hidden" name="imageFile" value="${req.file.filename}">
                                    <button type="submit" style="width:100%; background: #dc3545; color: white; border: none; padding: 15px; border-radius: 10px; cursor: pointer; font-weight: bold;">DISCARD SCAN</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) { res.status(500).send("AI Error: " + error.message); }
});

app.post('/confirm-save', (req, res) => {
    const { id, title, imageFile, analysis } = req.body;
    if (!id) return res.status(400).send("Error: Missing Artifact ID");
    const artifactData = { id, title, imageFile, analysis: decodeURIComponent(analysis), timestamp: new Date().toLocaleString('en-GB') };
    fs.writeFileSync(path.join(__dirname, 'uploads', `${id}.json`), JSON.stringify(artifactData, null, 2));
    res.redirect('/history');
});

app.post('/discard', (req, res) => {
    const imgPath = path.join(__dirname, 'uploads', req.body.imageFile);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    res.redirect('/');
});

app.get('/delete/:id', (req, res) => {
    const jsonPath = path.join(__dirname, 'uploads', `${req.params.id}.json`);
    if (fs.existsSync(jsonPath)) {
        const data = JSON.parse(fs.readFileSync(jsonPath));
        const imgPath = path.join(__dirname, 'uploads', data.imageFile);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        fs.unlinkSync(jsonPath);
    }
    res.redirect('/history');
});

app.get('/history', (req, res) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    const files = fs.readdirSync(uploadDir).filter(f => f.endsWith('.json'));
    const historyData = files.map(file => JSON.parse(fs.readFileSync(path.join(uploadDir, file), 'utf8')));

    let cardsHtml = historyData.reverse().map(item => {
        return `
            <div class="card-container">
                <button class="del-btn" onclick="event.stopPropagation(); window.location.href='/delete/${item.id}'">✕</button>
                <div class="card" 
                     data-title="${item.title}" 
                     data-img="/uploads/${item.imageFile}" 
                     data-text="${encodeURIComponent(item.analysis)}">
                    <img src="/uploads/${item.imageFile}">
                    <div class="card-body">
                        <h3>${item.title || 'Artifact'}</h3>
                        <small>${item.timestamp}</small>
                        <p>${item.analysis.substring(0, 80)}...</p>
                    </div>
                </div>
            </div>`;
    }).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <link rel="stylesheet" href="/style.css">
            <title>Museum Collection</title>
        </head>
        <body>
            <header>
                <h1>🏺 YOUR COLLECTION</h1>
                <a href="/" style="color: #007bff; text-decoration: none; font-weight: bold;">+ ADD NEW SCAN</a>
            </header>
            <div class="grid">${cardsHtml}</div>

            <div id="modalOverlay">
                <div class="modal-box">
                    <span class="close-btn">&times;</span>
                    <img id="modalImg" src="">
                    <h2 id="modalTitle" style="color: #007bff; margin-top: 0;"></h2>
                    <div id="modalText" style="line-height: 1.8; color: #ddd; white-space: pre-wrap;"></div>
                </div>
            </div>

            <script>
                // New logic: Use Event Listeners instead of onclick attributes
                document.querySelectorAll('.card').forEach(card => {
                    card.addEventListener('click', function() {
                        const title = this.getAttribute('data-title');
                        const img = this.getAttribute('data-img');
                        const text = decodeURIComponent(this.getAttribute('data-text'));
                        
                        document.getElementById('modalImg').src = img;
                        document.getElementById('modalTitle').innerText = title;
                        document.getElementById('modalText').innerText = text;
                        document.getElementById('modalOverlay').style.display = 'flex';
                    });
                });

                document.querySelector('.close-btn').addEventListener('click', () => {
                    document.getElementById('modalOverlay').style.display = 'none';
                });

                window.addEventListener('click', (e) => {
                    if (e.target == document.getElementById('modalOverlay')) {
                        document.getElementById('modalOverlay').style.display = 'none';
                    }
                });
            </script>
        </body>
        </html>
    `);
});

app.listen(port, () => console.log('✅ http://localhost:3000'));