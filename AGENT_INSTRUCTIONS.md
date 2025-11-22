# Agent Instructions for Portal Repository

This document serves as a guide for the AI agent to understand and work within the Portal repository.

## 1. Project Overview
Portal is a motion-activated video conferencing system designed for spontaneous family connections. It uses WebRTC for peer-to-peer media streaming and WebSockets for signaling. The system is designed to run on Raspberry Pi devices but can be developed locally.

## 2. Architecture
The project is a monorepo with three main workspaces:
- **client**: React application (Vite) running on the device. Handles motion detection, UI, and WebRTC.
- **server**: Node.js signaling server (Express + Socket.io). Manages presence and signaling.
- **shared**: Shared TypeScript types and utilities.

### Key Flows
- **Motion Detection**: Client detects motion -> sends `MOTION_DETECTED` to server.
- **Presence**: Server tracks active devices. If >= 2 devices are present, it triggers a conference.
- **Signaling**: Server routes WebRTC offers/answers/candidates between peers.
- **Media**: Peer-to-peer connection (mesh topology) for video/audio.

## 3. Technology Stack
- **Language**: TypeScript (Client, Server, Shared)
- **Client**: React 18, Vite, Socket.io-client, TensorFlow.js (implied for motion detection or future use, though `useMotionDetection.ts` uses pixel diffs), WebRTC.
- **Server**: Node.js, Express, Socket.io, better-sqlite3 (for device/group persistence).
- **Package Manager**: npm (with workspaces).

## 4. Development Workflow

### Installation
```bash
npm install
```

### Build
Shared package must be built before running others:
```bash
npm run build --workspace=shared
```

### Run Locally
Start both client and server in development mode:
```bash
npm run dev
```
- Server: http://localhost:3001
- Client: http://localhost:3000

### Environment Variables
- **Server**: Needs `.env` (copy from `.env.example`).
- **Client**: Needs `.env` (copy from `.env.example`). Key vars: `VITE_GROUP_ID`, `VITE_DEVICE_NAME`.

### Scripts
- `node scripts/init-group.js <id> <name>`: Initialize a new family group in the DB.

## 5. Code Structure & Conventions

### Client (`/client/src`)
- **Hooks**: Logic is heavily encapsulated in custom hooks (`useMotionDetection`, `useSignaling`, `useWebRTC`).
- **Components**: Functional components with TypeScript.
- **Styles**: CSS modules or plain CSS (imports `App.css`, `index.css`).
- **State**: Local state + Socket.io events.

### Server (`/server/src`)
- **Entry**: `index.ts` sets up Express and Socket.io.
- **Logic**: Split into `signaling-server.ts` (socket logic), `presence-manager.ts` (state), `database.ts` (persistence).
- **Data**: SQLite database.

### Shared (`/shared/src`)
- **Types**: `types.ts` defines the contract between client and server (Message types, payloads). **Always check this when modifying communication protocols.**

## 6. Agent Guidelines
- **Type Safety**: Always use types from `@portal/shared` when dealing with socket messages.
- **Monorepo**: Be aware of the workspace structure. Run commands from root with `--workspace` flag or `npm run dev` which runs concurrently.
- **Testing**: No explicit test framework found in `package.json` scripts (only `preview` and `build`). Rely on manual verification via browser and logs unless instructed to add tests.
- **Motion Detection**: Logic is in `client/src/hooks/useMotionDetection.ts`. It uses canvas pixel analysis.

## 7. Common Tasks
- **Adding a new feature**:
    1. Define types in `shared`.
    2. Implement server-side handling in `server`.
    3. Implement client-side logic in `client`.
- **Debugging**: Check browser console for client errors and terminal output for server logs.
