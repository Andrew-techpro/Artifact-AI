require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { GoogleGenAI } = require("@google/genai");
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const genAI = new GoogleGenAI(process.env.GEMINI_KEY);

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_KEY,
    api_secret: process.env.CLOUD_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'artifacts',
        allowed_formats: ['jpg', 'png', 'jpeg']
    }
});
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

let temporaryHistory = []; 

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ro">
        <head>
            <meta charset="UTF-8">
            <link rel="stylesheet" href="/style.css">
            <title>Scanare Artefacte</title>
        </head>
        <body>
            <header>
                <h1>AI ARTEFACT SCANNER</h1>
                <p>Încarcă o poză pentru a identifica obiectul</p>
            </header>
            <main style="text-align:center;">
                <form action="/upload" method="POST" enctype="multipart/form-data">
                    <input type="file" name="image" accept="image/*" required>
                    <button type="submit">SCANEAZĂ ACUM</button>
                </form>
                <br>
                <a href="/history" style="color:#007bff; text-decoration:none;">VEZI COLECȚIA</a>
            </main>
        </body>
        </html>
    `);
});

app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.send("Eroare: Nu ai încărcat nicio imagine.");

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const response = await fetch(req.file.path);
        const buffer = await response.arrayBuffer();
        
        const result = await model.generateContent([
            "Identifică acest artefact. Prima linie: titlu scurt (3 cuvinte). Restul: descriere detaliată în română.",
            { inlineData: { data: Buffer.from(buffer).toString('base64'), mimeType: req.file.mimetype } }
        ]);

        const text = result.response.text();
        const lines = text.split('\n');
        const title = lines[0].replace(/[*#]/g, '').trim();
        const analysis = lines.slice(1).join('\n').trim();

        const newEntry = {
            id: Date.now(),
            title: title,
            image: req.file.path,
            analysis: analysis,
            date: new Date().toLocaleDateString('ro-RO')
        };
        temporaryHistory.push(newEntry);

        res.send(`
            <!DOCTYPE html>
            <html lang="ro">
            <head>
                <meta charset="UTF-8">
                <link rel="stylesheet" href="/style.css">
                <title>Rezultat Scanare</title>
            </head>
            <body>
                <header>
                    <h1>REZULTAT IDENTIFICARE</h1>
                </header>
                <main style="max-width:600px; margin:auto; text-align:center;">
                    <img src="${req.file.path}" style="width:100%; border-radius:15px;">
                    <h2 style="color:#007bff;">${title}</h2>
                    <p style="text-align:left; line-height:1.6;">${analysis}</p>
                    <hr>
                    <a href="/history" style="display:inline-block; margin-top:20px; color:#007bff;">MERGI LA ARHIVĂ</a>
                    <br><br>
                    <a href="/" style="color:#666;">ÎNAPOI LA PAGINA PRINCIPALĂ</a>
                </main>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send("Eroare Server: " + error.message);
    }
});

app.get('/history', (req, res) => {
    let cardsHtml = temporaryHistory.slice().reverse().map(item => `
        <div class="card-container" data-title="${item.title.toLowerCase()}">
            <div class="card" data-title="${item.title}" data-img="${item.image}" data-text="${encodeURIComponent(item.analysis)}">
                <img src="${item.image}">
                <div class="card-body">
                    <h3>${item.title}</h3>
                    <small>${item.date}</small>
                    <p>${item.analysis.substring(0, 80)}...</p>
                </div>
            </div>
        </div>
    `).join('');

    res.send(`
        <!DOCTYPE html>
        <html lang="ro">
        <head>
            <meta charset="UTF-8">
            <link rel="stylesheet" href="/style.css">
            <title>Arhiva Muzeului</title>
        </head>
        <body>
            <header>
                <h1>🏺 COLECȚIA TA DE ARTEFACTE</h1>
                <input type="text" id="searchInput" placeholder="Caută după titlu..." style="padding:10px; width:250px; border-radius:20px; border:1px solid #333; background:#1a1a1a; color:white;">
                <br><br>
                <a href="/" style="color:#007bff; text-decoration:none; font-weight:bold;">⬅ ÎNAPOI LA PAGINA PRINCIPALĂ</a>
            </header>
            <div class="grid">${cardsHtml || '<p>Niciun artefact salvat.</p>'}</div>
            <div id="modalOverlay">
                <div class="modal-box">
                    <span class="close-btn" onclick="document.getElementById('modalOverlay').style.display='none'">&times;</span>
                    <img id="modalImg" src="" style="width:100%; border-radius:10px;">
                    <h2 id="modalTitle" style="color:#007bff;"></h2>
                    <div id="modalText" style="color:#ddd; line-height:1.6;"></div>
                </div>
            </div>
            <script>
                document.getElementById('searchInput').addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    document.querySelectorAll('.card-container').forEach(c => {
                        c.style.display = c.getAttribute('data-title').includes(term) ? 'block' : 'none';
                    });
                });
                document.querySelectorAll('.card').forEach(card => {
                    card.onclick = () => {
                        document.getElementById('modalImg').src = card.getAttribute('data-img');
                        document.getElementById('modalTitle').innerText = card.getAttribute('data-title');
                        document.getElementById('modalText').innerText = decodeURIComponent(card.getAttribute('data-text'));
                        document.getElementById('modalOverlay').style.display = 'flex';
                    };
                });
            </script>
        </body>
        </html>
    `);
});

app.listen(port, () => console.log('Server pornit pe portul ' + port));