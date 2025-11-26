import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { PortalDatabase } from './database';
import { SignalingServer } from './signaling-server';
import { createAuthRoutes } from './routes/auth-routes';
import { createGroupRoutes } from './routes/group-routes';
import { createDeviceRoutes } from './routes/device-routes';
import { createLiveKitRoutes } from './routes/livekit-routes';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const DATABASE_PATH = process.env.DATABASE_PATH || './portal.db';
const PRESENCE_TIMEOUT = parseInt(process.env.PRESENCE_TIMEOUT || ' 70000', 10);

// Create Express app and HTTP server
const app = express();
const httpServer = createServer(app);

// Middleware
app.use(express.json());

// Initialize database
const db = new PortalDatabase(DATABASE_PATH);
console.log(`Database initialized at ${DATABASE_PATH}`);

// API Routes
app.use('/api/auth', createAuthRoutes(db));
app.use('/api/groups', createGroupRoutes(db));
app.use('/api/devices', createDeviceRoutes(db));
app.use('/api/users', createDeviceRoutes(db)); // For /api/users/me/devices
app.use('/api/livekit', createLiveKitRoutes());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize signaling server
const signalingServer = new SignalingServer(httpServer, db, PRESENCE_TIMEOUT);
console.log('Signaling server initialized');

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Portal server running on port ${PORT}`);
  console.log(`📡 Signaling server ready`);
  console.log(`🔒 Authentication API ready at /api/auth`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  signalingServer.cleanup();
  db.close();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  signalingServer.cleanup();
  db.close();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
