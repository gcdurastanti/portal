# Quick Start Guide

Get Portal running in 5 minutes for local testing.

## 1. Install Dependencies

```bash
npm install
```

## 2. Build Shared Package

```bash
npm run build --workspace=shared
```

## 3. Set Up Environment Files

### Server
```bash
cd server
cp .env.example .env
cd ..
```

### Client
```bash
cd client
cp .env.example .env
cd ..
```

The defaults will work for local testing. For production, see [SETUP.md](SETUP.md).

## 4. Initialize a Group

```bash
node scripts/init-group.js test-family "Test Family"
```

## 5. Update Client Config

Edit `client/.env` and set:
```bash
VITE_GROUP_ID=test-family
VITE_DEVICE_NAME=Test Device
```

## 6. Start Development Mode

```bash
npm run dev
```

This starts:
- Server on http://localhost:3001
- Client on http://localhost:3000

## 7. Test It Out

1. Open http://localhost:3000 in your browser
2. Allow camera and microphone access
3. Walk in front of your camera - you should see motion detection activate
4. Open another browser window (or use your phone on the same network)
5. Configure the second device with a different VITE_DEVICE_ID in localStorage or use incognito mode
6. Walk in front of both cameras - they should connect automatically!

## Testing with Multiple Devices

### Option 1: Multiple Browser Windows
Open the same URL in different browser windows. Each will generate a unique device ID.

### Option 2: Multiple Computers
1. Find your computer's IP address: `ifconfig` or `ipconfig`
2. On other devices, update `client/.env`:
   ```bash
   VITE_SIGNALING_SERVER=ws://<your-ip>:3001
   ```
3. Access http://<your-ip>:3000 from other devices

## What to Expect

- **Motion Detection**: Blue indicator activates when motion detected
- **Presence**: Counter shows how many devices are active
- **Auto-Connect**: When 2+ devices detect motion, video conference starts automatically
- **Auto-Disconnect**: When motion stops for 10 seconds, connection ends

## Troubleshooting

**Camera permission denied**: Click the lock icon in browser address bar and allow camera/microphone

**Devices not connecting**: Check browser console for errors. Make sure both devices are in the same group.

**Motion not detecting**: Try adjusting `VITE_MOTION_THRESHOLD` in `client/.env` (lower = more sensitive)

**Connection stuck**: Refresh the page to reset the connection

## Next Steps

See [SETUP.md](SETUP.md) for:
- Production deployment on Raspberry Pi
- Kiosk mode setup
- Cloud server deployment
- Performance optimization
- Security hardening
