require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

// App Config
const PORT = process.env.WS_PORT || 4000;
const FRONTEND_URLS = process.env.FRONTEND_URL?.split(',');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const rooms = new Map();


// -------------------- MIDDLEWARE --------------------
app.set("trust proxy", 1);

// Logging HTTP requests
app.use((req, res, next) => {
  const now = new Date().toISOString();
  console.log(`[HTTP] ${now} - ${req.method} ${req.originalUrl}`);
  next();
});

// CORS setup
console.log("CORS Origins:", FRONTEND_URLS);
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || FRONTEND_URLS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsOptions));
// Body parsers
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));


// -------------------- REST API --------------------
app.get('/api/ping', (req, res) => {
  res.json({
    status: 'ok',
    message: 'WebSocket signaling server is running',
    roomsActive: rooms.size,
    clientsConnected: wss.clients.size,
  });
});


// -------------------- WEBSOCKET EVENTS --------------------
wss.on('connection', (ws) => {
  console.log('[WS] New WebSocket connection established.');

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      console.error('[WS] Invalid JSON message:', message);
      return;
    }

    switch (data.type) {
      case 'create-room':
        const roomId = Math.floor(100000 + Math.random() * 900000).toString();
        rooms.set(roomId, { host: ws, guest: null });
        ws.send(JSON.stringify({ type: 'room-created', roomId }));
        console.log(`[WS] Room ${roomId} created.`);
        break;

      case 'join-room':
        const room = rooms.get(data.roomId);
        if (room && !room.guest) {
          room.guest = ws;
          room.host.send(JSON.stringify({ type: 'peer-joined' }));
          room.guest.send(JSON.stringify({ type: 'peer-joined' }));
          console.log(`[WS] User joined room ${data.roomId}`);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Room not found or full' }));
        }
        break;

      case 'signal':
        const r = rooms.get(data.roomId);
        if (r) {
          const target = ws === r.host ? r.guest : r.host;
          if (target) target.send(JSON.stringify(data));
        }
        break;

      case 'chat-message':
        const roomChat = rooms.get(data.roomId);
        if (roomChat) {
          if (roomChat.host && roomChat.host !== ws) {
            roomChat.host.send(JSON.stringify(data));
          }
          if (roomChat.guest && roomChat.guest !== ws) {
            roomChat.guest.send(JSON.stringify(data));
          }
          console.log('[WS] Relayed chat-message:', data);
        } else {
          console.warn('[WS] chat-message: Room not found for', data.roomId);
        }
        break;

      default:
        console.warn('[WS] Unknown message type:', data.type);
    }
  });

  ws.on('close', () => {
    for (const [roomId, room] of rooms) {
      if (room.host === ws || room.guest === ws) {
        rooms.delete(roomId);
        console.log(`[WS] Room ${roomId} closed due to disconnect.`);
      }
    }
  });
});


// -------------------- SERVER START --------------------
server.listen(PORT, () => {
  console.log(`✅ WebSocket signaling server running on http://localhost:${PORT}`);
});
