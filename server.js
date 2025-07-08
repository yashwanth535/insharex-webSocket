const WebSocket = require('ws');

const PORT = process.env.WS_PORT || 4000;
const rooms = new Map();

const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'create-room') {
            const roomId = Math.floor(100000 + Math.random() * 900000).toString();
            rooms.set(roomId, { host: ws, guest: null });
            ws.send(JSON.stringify({ type: 'room-created', roomId }));
        }

        if (data.type === 'join-room') {
            const room = rooms.get(data.roomId);
            if (room && !room.guest) {
                room.guest = ws;
                room.host.send(JSON.stringify({ type: 'peer-joined' }));
                room.guest.send(JSON.stringify({ type: 'peer-joined' }));
            } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Room not found or full' }));
            }
        }

        // Relay signaling messages (SDP, ICE) between peers
        if (data.type === 'signal') {
            const room = rooms.get(data.roomId);
            if (room) {
                const target = ws === room.host ? room.guest : room.host;
                if (target) target.send(JSON.stringify(data));
            }
        }

        // Relay chat messages between peers
        if (data.type === 'chat-message') {
            const room = rooms.get(data.roomId);
            if (room) {
                if (room.host && room.host !== ws) {
                    room.host.send(JSON.stringify(data));
                    console.log('[WS] Relayed chat-message to host:', data);
                }
                if (room.guest && room.guest !== ws) {
                    room.guest.send(JSON.stringify(data));
                    console.log('[WS] Relayed chat-message to guest:', data);
                }
            } else {
                console.warn('[WS] chat-message: Room not found for', data.roomId);
            }
        }
    });

    ws.on('close', () => {
        for (const [roomId, room] of rooms) {
            if (room.host === ws || room.guest === ws) {
                rooms.delete(roomId);
            }
        }
    });
});

console.log(`WebSocket signaling server initialized on ws://localhost:${PORT}`); 