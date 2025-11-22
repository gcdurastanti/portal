# Portal - Motion-Activated Family Video Portal

A spontaneous video connection system that brings families together. When someone walks by their portal device, they automatically connect with other family members who are near their portal devices.

## Architecture

### Core Concept
- Motion detection triggers "presence" state
- When 2+ family members are present, automatic WebRTC conference starts
- Supports up to 5 participants per group
- Designed for Raspberry Pi devices in always-on mode

### Tech Stack
- **Frontend**: React with TypeScript
- **Backend**: Node.js signaling server with WebSocket (Socket.io)
- **Motion Detection**: Browser-based computer vision
- **Video/Audio**: WebRTC peer-to-peer connections
- **Database**: SQLite for groups and device management

### Components

#### 1. Client (`/client`)
- React application running on Raspberry Pi
- Camera access via getUserMedia API
- Motion detection using frame differencing
- WebRTC peer connection management
- Video conferencing UI

#### 2. Server (`/server`)
- WebSocket signaling server
- Manages presence states (who's active)
- Coordinates WebRTC handshakes
- Group/family management
- Device registration and authentication

#### 3. Shared (`/shared`)
- TypeScript types shared between client and server
- Common utilities

## Getting Started

### Prerequisites
- Node.js 18+
- For Raspberry Pi: Camera module or USB webcam

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

This starts both the server (port 3001) and client (port 3000) in development mode.

### Production Deployment (Raspberry Pi)

#### Server Setup
```bash
npm run build
npm run start:server
```

#### Client Setup (Kiosk Mode)
1. Build the client: `npm run build --workspace=client`
2. Serve with nginx or configure Chromium in kiosk mode
3. Point to: `http://localhost:3000`

## How It Works

1. **Motion Detection**: Client continuously analyzes camera frames for motion
2. **Presence Broadcast**: When motion detected, client notifies server via WebSocket
3. **Automatic Matching**: Server checks if other group members are present
4. **WebRTC Connection**: If match found, server coordinates peer connections
5. **Live Conference**: Participants see/hear each other until motion stops

## Configuration

Create `.env` files in both client and server directories:

### Server `.env`
```
PORT=3001
DATABASE_PATH=./portal.db
TURN_SERVER_URL=
TURN_SERVER_USERNAME=
TURN_SERVER_CREDENTIAL=
```

### Client `.env`
```
REACT_APP_SIGNALING_SERVER=ws://localhost:3001
REACT_APP_MOTION_THRESHOLD=30
REACT_APP_MOTION_TIMEOUT=10000
```

## Future Enhancements
- End-to-end encryption
- Mobile app support
- Cloud deployment option
- Picture-in-picture mode
- Screen sharing
- Persistent chat alongside video
