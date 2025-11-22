# Portal Architecture

## System Overview

Portal is a motion-activated video conferencing system designed for spontaneous family connections. The system consists of three main components working together to enable seamless, automatic video calls.

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Portal        │         │   Portal        │         │   Portal        │
│   Device 1      │         │   Device 2      │         │   Device 3      │
│  (Raspberry Pi) │         │  (Raspberry Pi) │         │  (Raspberry Pi) │
└────────┬────────┘         └────────┬────────┘         └────────┬────────┘
         │                           │                           │
         │          WebSocket        │          WebSocket        │
         │         (Signaling)       │         (Signaling)       │
         └───────────────┬───────────┴───────────┬───────────────┘
                         │                       │
                    ┌────▼───────────────────────▼────┐
                    │   Signaling Server              │
                    │   (Node.js + Socket.io)         │
                    │   - WebSocket connections       │
                    │   - Presence management         │
                    │   - WebRTC signaling            │
                    │   - Group coordination          │
                    └─────────────┬───────────────────┘
                                  │
                            ┌─────▼─────┐
                            │  SQLite   │
                            │  Database │
                            └───────────┘

         WebRTC Peer-to-Peer Media Connections
         ◄──────────────────────────────────────►
```

## Component Breakdown

### 1. Client Application (React + TypeScript)

**Location**: `/client`

The client runs on each portal device (Raspberry Pi) and handles:

#### Camera & Motion Detection
- Accesses camera via `getUserMedia()` API
- Continuously analyzes video frames for motion using pixel difference algorithm
- Configurable sensitivity threshold
- Auto-timeout when motion stops

**Key Files**:
- `hooks/useMotionDetection.ts` - Frame analysis and motion detection logic

#### WebSocket Communication
- Maintains persistent connection to signaling server
- Sends presence updates when motion detected/stopped
- Receives conference start/end notifications
- Handles WebRTC signaling messages

**Key Files**:
- `hooks/useSignaling.ts` - WebSocket connection and message handling

#### WebRTC Peer Connections
- Creates peer-to-peer connections with other devices
- Manages multiple simultaneous connections (up to 5)
- Handles ICE candidate exchange
- Streams local video/audio to peers
- Receives and displays remote streams

**Key Files**:
- `hooks/useWebRTC.ts` - Peer connection management

#### User Interface
- Idle screen with motion detection preview
- Video grid for active conferences
- Status indicators for connection, motion, presence
- Responsive layout for different screen sizes

**Key Files**:
- `App.tsx` - Main application component
- `components/VideoGrid.tsx` - Conference layout
- `components/StatusBar.tsx` - Status display

### 2. Signaling Server (Node.js + Socket.io)

**Location**: `/server`

The server coordinates all portal devices and manages the conference lifecycle.

#### WebSocket Server
- Accepts connections from all portal devices
- Routes messages between peers
- Maintains device registry

**Key Files**:
- `signaling-server.ts` - Main WebSocket server logic

#### Presence Manager
- Tracks which devices currently detect motion
- Implements timeout-based presence (device marked not present after X seconds)
- Emits presence change events to trigger conference logic

**Key Files**:
- `presence-manager.ts` - Presence state tracking

#### Conference Coordinator
- Monitors presence updates for each group
- Automatically starts conference when 2+ devices are present
- Automatically ends conference when <2 devices remain
- Broadcasts conference state to all group members

**Key Logic**:
```
if (presentDevices >= 2) {
  startConference()
  // Notify all devices to establish peer connections
} else {
  endConference()
  // Notify all devices to close connections
}
```

#### Database Manager
- SQLite database for persistent storage
- Stores groups (families) and devices
- Auto-creates device entries on first connection

**Key Files**:
- `database.ts` - Database operations

### 3. Shared Types (TypeScript)

**Location**: `/shared`

Common TypeScript interfaces and enums used by both client and server.

#### Message Protocol
- Enum of all WebSocket message types
- Type-safe message payloads
- Ensures client/server compatibility

**Key Files**:
- `types.ts` - All shared type definitions

## Data Flow

### Scenario: Two Family Members Connect

#### 1. Initial State
```
Device A: Idle, no motion
Device B: Idle, no motion
Server: Both devices registered but not present
```

#### 2. Person A Walks By
```
Device A:
  ├─ Motion detected in video frames
  ├─ Send MOTION_DETECTED to server
  └─ UI shows "Motion: Active"

Server:
  ├─ Receive MOTION_DETECTED from Device A
  ├─ Mark Device A as present
  ├─ Check group: only 1 device present
  ├─ Broadcast PRESENCE_UPDATE to group
  └─ Wait for more devices
```

#### 3. Person B Walks By
```
Device B:
  ├─ Motion detected in video frames
  ├─ Send MOTION_DETECTED to server
  └─ UI shows "Motion: Active"

Server:
  ├─ Receive MOTION_DETECTED from Device B
  ├─ Mark Device B as present
  ├─ Check group: 2 devices present ✓
  ├─ Broadcast CONFERENCE_START to both devices
  └─ Include participant list: [Device A, Device B]
```

#### 4. WebRTC Connection Established
```
Device A (initiator - alphabetically first):
  ├─ Create RTCPeerConnection for Device B
  ├─ Add local media tracks
  ├─ Create offer
  ├─ Set local description
  └─ Send OFFER to Device B via server

Device B (receiver):
  ├─ Receive OFFER from Device A
  ├─ Create RTCPeerConnection for Device A
  ├─ Set remote description (offer)
  ├─ Add local media tracks
  ├─ Create answer
  ├─ Set local description
  └─ Send ANSWER to Device A via server

Both Devices:
  ├─ Exchange ICE candidates via server
  ├─ Establish peer-to-peer connection
  ├─ Media flows directly between devices
  └─ Server no longer involved in media
```

#### 5. Active Conference
```
Device A Display:
  ├─ Local video (you)
  └─ Remote video (Device B)

Device B Display:
  ├─ Local video (you)
  └─ Remote video (Device A)

Connection:
  └─ Direct P2P connection (not through server)
```

#### 6. Motion Stops
```
Device A:
  ├─ No motion for 10 seconds
  ├─ Send MOTION_STOPPED to server
  └─ UI shows "Motion: Idle"

Server:
  ├─ Mark Device A as not present
  ├─ Check group: 1 device present
  ├─ Broadcast CONFERENCE_END
  └─ Conference terminates

Both Devices:
  ├─ Close peer connections
  ├─ Stop media streams
  └─ Return to idle screen
```

## Scaling Considerations

### Current Design: Up to 5 Participants

The mesh topology (every device connects to every other device) works well for small groups:

```
2 devices: 1 connection
3 devices: 3 connections
4 devices: 6 connections
5 devices: 10 connections
```

### Limitations

**Bandwidth**: Each device must upload its stream to N-1 other devices
- 5 participants = each device uploads 4 streams
- At 720p/1Mbps per stream = 4 Mbps upload required

**CPU**: Raspberry Pi can handle 3-4 simultaneous encodings reasonably well

### Future: SFU Architecture for 5+ Participants

For larger groups, switch to Selective Forwarding Unit:

```
┌────────┐     ┌────────┐     ┌────────┐
│Device 1│     │Device 2│     │Device 3│
└───┬────┘     └───┬────┘     └───┬────┘
    │              │              │
    │   1 stream   │   1 stream   │   1 stream
    │      UP      │      UP      │      UP
    └──────┬───────┴──────┬───────┘
           │              │
       ┌───▼──────────────▼───┐
       │   SFU Server         │
       │   (routes streams)   │
       └───┬──────────────┬───┘
           │              │
    │   N streams  │   N streams  │
    │     DOWN     │     DOWN     │
    ┌───▼────┐     ┌───▼────┐     ┌───▼────┐
    │Device 1│     │Device 2│     │Device 3│
    └────────┘     └────────┘     └────────┘
```

Benefits:
- Each device only uploads 1 stream
- Server handles distribution
- Can support 10+ participants

## Security Model

### Current Implementation

**Device Authentication**:
- Devices self-register with server
- Device ID stored in localStorage
- No authentication tokens (suitable for private networks)

**WebRTC Security**:
- DTLS encryption on peer connections (built into WebRTC)
- Media never passes through server

**Transport Security**:
- WebSocket connections (WS)
- No TLS by default

### Production Recommendations

1. **Use WSS (WebSocket Secure)**: Encrypt signaling traffic
2. **HTTPS for client**: Serve client over HTTPS
3. **Device tokens**: Require pre-shared secrets for device registration
4. **Network isolation**: Deploy on VPN or private network
5. **E2E encryption**: Additional encryption layer for sensitive use cases

## Performance Optimization

### Raspberry Pi Tuning

**GPU Memory**: Increase to 256MB for better video encoding
**Video Resolution**: 720p is good balance of quality/performance
**Frame Rate**: 24-30 fps is sufficient for video calls
**Codec**: H.264 hardware encoding on Pi 4

### Network Requirements

**Minimum per device**:
- Download: 2 Mbps (receives N-1 streams)
- Upload: 2 Mbps (sends to N-1 devices)

**Recommended for 5 participants**:
- Download: 5 Mbps
- Upload: 5 Mbps

### Browser Optimization

- Use hardware acceleration in Chromium
- Minimize background processes
- Disable unnecessary browser features

## Extension Points

The architecture is designed to be extensible:

### Add Features to Client
- Picture-in-picture mode
- Screen sharing
- Chat overlay
- Filters/effects
- Recording

### Add Features to Server
- Usage analytics
- Connection quality monitoring
- Scheduled "office hours"
- Integration with calendar
- Push notifications (via companion app)

### Add New Clients
- Mobile app (React Native)
- Desktop app (Electron)
- Smart display integration

## Technologies Used

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Client | React 18 | UI framework |
| Client | TypeScript | Type safety |
| Client | Vite | Build tool |
| Client | WebRTC | Peer connections |
| Client | getUserMedia | Camera access |
| Client | Canvas API | Motion detection |
| Server | Node.js | Runtime |
| Server | Express | HTTP server |
| Server | Socket.io | WebSocket |
| Server | better-sqlite3 | Database |
| Server | TypeScript | Type safety |
| Shared | TypeScript | Type definitions |

## File Structure

```
portal/
├── client/                  # React application
│   ├── src/
│   │   ├── hooks/          # Custom React hooks
│   │   │   ├── useSignaling.ts
│   │   │   ├── useMotionDetection.ts
│   │   │   └── useWebRTC.ts
│   │   ├── components/     # UI components
│   │   │   ├── VideoGrid.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── App.tsx         # Main app
│   │   ├── config.ts       # Configuration
│   │   └── index.tsx       # Entry point
│   └── package.json
│
├── server/                  # Signaling server
│   ├── src/
│   │   ├── index.ts        # Server entry
│   │   ├── signaling-server.ts
│   │   ├── presence-manager.ts
│   │   └── database.ts
│   └── package.json
│
├── shared/                  # Shared types
│   ├── src/
│   │   ├── types.ts        # All type definitions
│   │   └── index.ts
│   └── package.json
│
├── scripts/                 # Utility scripts
│   ├── init-group.js
│   └── list-devices.js
│
├── README.md               # Project overview
├── SETUP.md                # Production setup guide
├── QUICKSTART.md           # Quick start guide
└── ARCHITECTURE.md         # This file
```
