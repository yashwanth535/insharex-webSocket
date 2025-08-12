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
const groups = new Map(); // New: For P2M groups


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
    groupsActive: groups.size, // New: Add groups count
    clientsConnected: wss.clients.size,
  });
});

// New: Group management endpoints
app.get('/api/groups', (req, res) => {
  const groupsList = Array.from(groups.keys()).map(groupId => ({
    groupId,
    memberCount: groups.get(groupId).members.size,
    isOpen: groups.get(groupId).isOpen
  }));
  res.json({ groups: groupsList });
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
        const roomId = generateUniqueRoomId();
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

      // New: Group management cases
      case 'create-group':
        const groupId = generateUniqueGroupId();
        const maxMembers = data.maxMembers || 20;
        groups.set(groupId, {
          host: ws,
          members: new Set([ws]),
          maxMembers,
          isOpen: true,
          createdAt: Date.now()
        });
        ws.send(JSON.stringify({ type: 'group-created', groupId, maxMembers }));
        console.log(`[WS] Group ${groupId} created with max ${maxMembers} members.`);
        break;

      case 'join-group':
        const group = groups.get(data.groupId);
        if (group && group.isOpen && group.members.size < group.maxMembers) {
          group.members.add(ws);
          // Notify all members about new join
          group.members.forEach(member => {
            if (member !== ws) {
              member.send(JSON.stringify({ 
                type: 'member-joined', 
                groupId: data.groupId,
                memberCount: group.members.size 
              }));
            }
          });
          ws.send(JSON.stringify({ 
            type: 'group-joined', 
            groupId: data.groupId,
            memberCount: group.members.size,
            maxMembers: group.maxMembers
          }));
          console.log(`[WS] User joined group ${data.groupId}. Members: ${group.members.size}/${group.maxMembers}`);
        } else {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: group ? 'Group is full or closed' : 'Group not found' 
          }));
        }
        break;

      case 'close-group':
        const groupToClose = groups.get(data.groupId);
        if (groupToClose && groupToClose.host === ws) {
          groupToClose.isOpen = false;
          // Notify all members that group is closed
          groupToClose.members.forEach(member => {
            member.send(JSON.stringify({ 
              type: 'group-closed', 
              groupId: data.groupId 
            }));
          });
          console.log(`[WS] Group ${data.groupId} closed by host.`);
        }
        break;

      case 'share-torrent':
        const groupToShare = groups.get(data.groupId);
        if (groupToShare && groupToShare.host === ws) {
          // Send magnet link to all group members
          groupToShare.members.forEach(member => {
            if (member !== ws) {
              member.send(JSON.stringify({
                type: 'torrent-shared',
                groupId: data.groupId,
                magnetLink: data.magnetLink,
                fileName: data.fileName,
                fileSize: data.fileSize,
                infoHash: data.infoHash
              }));
            }
          });
          console.log(`[WS] Torrent shared in group ${data.groupId}: ${data.fileName} (${data.infoHash})`);
        }
        break;

      case 'group-chat':
        const groupChat = groups.get(data.groupId);
        if (groupChat && groupChat.members.has(ws)) {
          // Relay chat message to all group members
          groupChat.members.forEach(member => {
            if (member !== ws) {
              member.send(JSON.stringify(data));
            }
          });
          console.log('[WS] Group chat message relayed:', data);
        }
        break;

      default:
        console.warn('[WS] Unknown message type:', data.type);
    }
  });

  ws.on('close', () => {
    // Handle P2P room cleanup
    for (const [roomId, room] of rooms) {
      if (room.host === ws || room.guest === ws) {
        rooms.delete(roomId);
        console.log(`[WS] Room ${roomId} closed due to disconnect.`);
      }
    }

    // New: Handle group member cleanup
    for (const [groupId, group] of groups) {
      if (group.members.has(ws)) {
        group.members.delete(ws);
        console.log(`[WS] Member left group ${groupId}. Remaining: ${group.members.size}`);
        
        // If host left, close the group
        if (group.host === ws) {
          group.members.forEach(member => {
            member.send(JSON.stringify({ 
              type: 'group-closed', 
              groupId,
              reason: 'Host disconnected' 
            }));
          });
          groups.delete(groupId);
          console.log(`[WS] Group ${groupId} closed due to host disconnect.`);
        }
        // If no members left, delete the group
        else if (group.members.size === 0) {
          groups.delete(groupId);
          console.log(`[WS] Group ${groupId} deleted due to no members.`);
        }
      }
    }
  });
});

function generateUniqueRoomId() {
  let roomId;
  do {
    roomId = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(roomId));
  return roomId;
}

// New: Generate unique group ID
function generateUniqueGroupId() {
  let groupId;
  do {
    groupId = Math.floor(100000 + Math.random() * 900000).toString();
  } while (groups.has(groupId));
  return groupId;
}


// -------------------- SERVER START --------------------
server.listen(PORT, () => {
  console.log(`✅ WebSocket signaling server running on http://localhost:${PORT}`);
});
