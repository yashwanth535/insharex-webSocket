# InShareX WebSocket Server

A real-time WebSocket signaling server for the InShareX file sharing application. This server handles WebRTC signaling, room management, and real-time chat functionality for peer-to-peer file sharing.

## 🚀 Features

- **WebRTC Signaling**: Handles ICE candidates and SDP offers/answers
- **Room Management**: Create and manage file sharing rooms
- **Real-time Chat**: Instant messaging between peers
- **Connection Management**: Automatic room cleanup on disconnect
- **CORS Support**: Cross-origin resource sharing for frontend integration
- **Health Monitoring**: API endpoints for server status
- **Scalable Architecture**: Designed for multiple concurrent connections
- **Error Handling**: Comprehensive error handling and logging

## 🛠️ Tech Stack

- **Node.js** - JavaScript runtime
- **Express** - Web framework for HTTP endpoints
- **ws** - WebSocket library for real-time communication
- **CORS** - Cross-origin resource sharing middleware
- **dotenv** - Environment variable management

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Frontend application running
- Environment variables configured

## 🛠️ Installation

1. **Navigate to websocket directory:**
   ```bash
   cd websocket
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment variables:**
   Create a `.env` file in the websocket directory:
   ```env
   WS_PORT=4000
   FRONTEND_URL=http://localhost:5173,http://localhost:3000
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Verify server is running:**
   Visit `http://localhost:4000/api/ping`

## 🏗️ Project Structure

```
websocket/
├── server.js              # Main WebSocket server
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables
└── README.md             # This file
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WS_PORT` | WebSocket server port | 4000 | No |
| `FRONTEND_URL` | Comma-separated frontend URLs for CORS | - | Yes |

### CORS Configuration

The server is configured to accept connections from specified frontend URLs:

```javascript
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
```

## 📡 API Endpoints

### Health Check
- **GET** `/api/ping` - Server status with connection information

#### Response Example
```json
{
  "status": "ok",
  "message": "WebSocket signaling server is running",
  "roomsActive": 5,
  "clientsConnected": 10
}
```

## 🔌 WebSocket Events

### Client to Server Events

#### Create Room
```javascript
{
  "type": "create-room"
}
```

**Response:**
```javascript
{
  "type": "room-created",
  "roomId": "123456"
}
```

#### Join Room
```javascript
{
  "type": "join-room",
  "roomId": "123456"
}
```

**Response:**
```javascript
{
  "type": "peer-joined"
}
```

#### WebRTC Signaling
```javascript
{
  "type": "signal",
  "roomId": "123456",
  "sdp": { /* SDP offer/answer */ },
  "candidate": { /* ICE candidate */ }
}
```

#### Chat Message
```javascript
{
  "type": "chat-message",
  "roomId": "123456",
  "message": "Hello, world!",
  "sender": "User",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Server to Client Events

#### Peer Joined
```javascript
{
  "type": "peer-joined"
}
```

#### Error
```javascript
{
  "type": "error",
  "message": "Room not found or full"
}
```

## 🏠 Room Management

### Room Structure

Each room contains:
- **Host**: The user who created the room
- **Guest**: The user who joined the room
- **Room ID**: 6-digit unique identifier

### Room Lifecycle

1. **Creation**: Host creates room, receives room ID
2. **Joining**: Guest joins using room ID
3. **Active**: Both peers connected, signaling occurs
4. **Cleanup**: Room deleted when either peer disconnects

### Room Operations

```javascript
// Create room
const roomId = Math.floor(100000 + Math.random() * 900000).toString();
rooms.set(roomId, { host: ws, guest: null });

// Join room
const room = rooms.get(data.roomId);
if (room && !room.guest) {
  room.guest = ws;
  // Notify both peers
}

// Cleanup on disconnect
ws.on('close', () => {
  for (const [roomId, room] of rooms) {
    if (room.host === ws || room.guest === ws) {
      rooms.delete(roomId);
    }
  }
});
```

## 🌐 WebRTC Signaling

### Signaling Flow

1. **Room Creation**: Host creates room and gets room ID
2. **Peer Joining**: Guest joins room using room ID
3. **Connection Setup**: Both peers establish WebRTC connection
4. **ICE Exchange**: ICE candidates exchanged via signaling server
5. **SDP Exchange**: SDP offers/answers exchanged
6. **Direct Connection**: Peers connect directly via WebRTC

### Signaling Implementation

```javascript
// Handle signaling messages
case 'signal':
  const r = rooms.get(data.roomId);
  if (r) {
    const target = ws === r.host ? r.guest : r.host;
    if (target) target.send(JSON.stringify(data));
  }
  break;
```

## 💬 Chat System

### Chat Features

- **Real-time Messaging**: Instant message delivery
- **Room-based**: Messages only sent to room participants
- **Message Relay**: Server relays messages between peers
- **Timestamp Support**: Messages include timestamps

### Chat Implementation

```javascript
case 'chat-message':
  const roomChat = rooms.get(data.roomId);
  if (roomChat) {
    // Relay message to other peer
    if (roomChat.host && roomChat.host !== ws) {
      roomChat.host.send(JSON.stringify(data));
    }
    if (roomChat.guest && roomChat.guest !== ws) {
      roomChat.guest.send(JSON.stringify(data));
    }
  }
  break;
```

## 🔒 Security Features

### Connection Security

- **CORS Protection**: Restricts connections to allowed origins
- **Input Validation**: Validates all incoming messages
- **Error Handling**: Graceful handling of malformed messages
- **Connection Limits**: Automatic cleanup of disconnected peers

### Best Practices

- Validate all incoming WebSocket messages
- Implement rate limiting for production
- Use secure WebSocket connections (WSS) in production
- Monitor connection health and performance

## 📊 Monitoring & Logging

### Logging Features

- **Connection Events**: Log all WebSocket connections/disconnections
- **Room Operations**: Track room creation, joining, and cleanup
- **Message Relay**: Log chat message relay operations
- **Error Logging**: Comprehensive error logging

### Health Monitoring

The server provides health check endpoints:

```bash
# Check server status
curl http://localhost:4000/api/ping
```

## 🚀 Deployment

### Production Considerations

1. **Use WSS**: Secure WebSocket connections in production
2. **Load Balancing**: Consider multiple server instances
3. **Monitoring**: Implement proper logging and monitoring
4. **Rate Limiting**: Add rate limiting for production use

### Environment Variables for Production

```env
WS_PORT=4000
FRONTEND_URL=https://your-frontend-domain.com
NODE_ENV=production
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
```

## 🔧 Development

### Available Scripts

- `npm start` - Start the WebSocket server
- `npm test` - Run tests (placeholder)

### Development Server

The development server runs on the configured port with:
- Hot reloading (with nodemon if configured)
- Detailed logging
- Error handling
- CORS support for development

### Testing WebSocket Connections

You can test WebSocket connections using browser console:

```javascript
// Connect to WebSocket server
const ws = new WebSocket('ws://localhost:4000');

// Create room
ws.send(JSON.stringify({ type: 'create-room' }));

// Listen for messages
ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

## 🐛 Troubleshooting

### Common Issues

1. **Connection Refused**
   - Verify server is running on correct port
   - Check firewall settings
   - Ensure port is not in use

2. **CORS Errors**
   - Verify `FRONTEND_URL` includes your frontend domain
   - Check browser console for CORS errors
   - Ensure HTTPS/WSS in production

3. **Room Not Found**
   - Verify room ID is correct
   - Check if room was cleaned up due to disconnect
   - Ensure both peers are connected

4. **Signaling Issues**
   - Check WebSocket connection status
   - Verify message format
   - Monitor server logs for errors

### Debug Mode

Enable debug logging:

```javascript
// Add to server.js for detailed logging
const DEBUG = process.env.NODE_ENV === 'development';
if (DEBUG) {
  console.log('[DEBUG] WebSocket message:', data);
}
```

## 📈 Performance

### Optimization Tips

- **Connection Pooling**: Reuse WebSocket connections
- **Message Batching**: Batch multiple messages when possible
- **Memory Management**: Clean up disconnected rooms promptly
- **Load Balancing**: Distribute load across multiple instances

### Monitoring Metrics

- Active rooms count
- Connected clients count
- Message throughput
- Error rates
- Response times

## 🤝 Integration

### Frontend Integration

The WebSocket server integrates with the frontend for:
- WebRTC signaling
- Real-time chat
- Room management
- Connection status

### Backend Integration

While primarily for WebRTC signaling, the server can integrate with the backend for:
- User authentication
- File metadata storage
- Analytics and logging

## 📝 License

This project is part of the InShareX file sharing application.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Development Guidelines

- Follow Node.js best practices
- Add proper error handling
- Include comprehensive logging
- Test WebSocket connections thoroughly
- Document new features

## 🆘 Support

For support and questions:
- Check the troubleshooting section
- Review WebSocket documentation
- Open an issue on GitHub

---

**Note**: This WebSocket server works in conjunction with the InShareX frontend and backend for a complete file sharing experience. 