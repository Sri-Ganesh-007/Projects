const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Worker } = require('worker_threads');
const path = require('path');
require('dotenv').config();
const http = require('http');
const { WebSocketServer } = require('ws');
const db = require('./database.js');
const Redis = require('ioredis');

// --- Basic Setup ---
const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const redis = new Redis();

//Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

//Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage: storage });

//WebSocket Connection Management
const clients = new Map();
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'REGISTER' && data.fileId) {
        clients.set(data.fileId, ws);
      }
    } catch (e) {
      console.error("Failed to parse message or register client:", message);
    }
  });
});

// --- API Endpoints ---

// 1. Get all previously analyzed files
app.get('/api/files', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM files ORDER BY upload_time DESC');
    const files = stmt.all();
    res.json({ success: true, data: files });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch files.' });
  }
});

// 2. Get analytics for a specific file (from cache or re-process)
app.get('/api/analytics/:fileId', async (req, res) => {
    const { fileId } = req.params;
    try {
        const cachedAnalytics = await redis.get(fileId);
        if (cachedAnalytics) {
            return res.json({ success: true, data: JSON.parse(cachedAnalytics), source: 'cache' });
        }
        
        res.status(404).json({ success: false, error: 'Analytics not found in cache.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch analytics.' });
    }
});


//3.File upload endpoint
app.post('/upload', upload.single('dataFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file was uploaded.' });
  }

  const fileId = req.file.filename;
  const worker = new Worker(path.resolve(__dirname, 'analytics-worker.js'), {
    workerData: { filePath: req.file.path },
  });

  worker.on('message', async (message) => {
    if (message.success) {
      const { analytics } = message;
      // Save metadata to SQLite
      try {
        const stmt = db.prepare('INSERT INTO files (id, original_name, row_count, column_count) VALUES (?, ?, ?, ?)');
        stmt.run(fileId, req.file.originalname, analytics.totalRows, analytics.fileHeaders.length);
      } catch (dbError) {
        console.error("Database insert error:", dbError);
      }
      
      //Cache the full analytics result in Redis for an hour
      await redis.set(fileId, JSON.stringify(analytics), 'EX', 3600);

      //Send results to the connected client
      const ws = clients.get(fileId);
      if (ws && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ success: true, analytics }));
      }
    }
    clients.delete(fileId);
  });

  res.status(202).json({
    success: true,
    message: 'File uploaded. Processing has started.',
    fileId: fileId,
  });
});

//start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});