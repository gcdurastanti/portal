# Portal Setup Guide

This guide will help you set up Portal on your Raspberry Pi devices.

## Prerequisites

- Raspberry Pi 3B+ or newer (recommended: Pi 4 with 4GB RAM)
- Camera Module or USB webcam
- Node.js 18 or newer
- Network connection (all devices should be able to reach the server)

## Installation Steps

### 1. Clone and Install

```bash
cd /home/pi
git clone <your-repo-url> portal
cd portal
npm install
```

### 2. Build the Shared Package

```bash
npm run build --workspace=shared
```

### 3. Set Up the Server (Choose One Device)

One device in your network should run the signaling server. This can be one of the Raspberry Pis or a separate server.

#### Configure Server

```bash
cd server
cp .env.example .env
```

Edit `.env`:
```bash
PORT=3001
DATABASE_PATH=./portal.db
PRESENCE_TIMEOUT=30000
```

#### Build and Start Server

```bash
npm run build --workspace=server
npm run start:server
```

For production, use a process manager like PM2:
```bash
npm install -g pm2
pm2 start npm --name "portal-server" -- run start:server
pm2 save
pm2 startup
```

### 4. Create a Group

On the server machine, create a group for your family:

```bash
node scripts/init-group.js my-family "My Family"
```

This will output a GROUP_ID to use in your client configuration.

### 5. Configure Each Client Device

On each Raspberry Pi that will be a portal:

```bash
cd client
cp .env.example .env
```

Edit `.env` and customize for each device:

```bash
VITE_SIGNALING_SERVER=ws://<server-ip>:3001
VITE_MOTION_THRESHOLD=30
VITE_MOTION_TIMEOUT=10000
VITE_DEVICE_ID=living-room-portal
VITE_GROUP_ID=my-family
VITE_DEVICE_NAME=Living Room
```

**Important**: Each device needs a unique `VITE_DEVICE_ID` and `VITE_DEVICE_NAME`.

### 6. Build and Run Client

#### Development Mode
```bash
npm run dev --workspace=client
```

#### Production Mode
Build the client:
```bash
npm run build --workspace=client
```

Serve with a static server:
```bash
npm install -g serve
serve -s client/dist -l 3000
```

Or use PM2:
```bash
pm2 start "serve -s client/dist -l 3000" --name "portal-client"
pm2 save
```

### 7. Set Up Kiosk Mode (Raspberry Pi)

For a dedicated portal device, set up Chromium in kiosk mode:

#### Install Chromium
```bash
sudo apt-get update
sudo apt-get install -y chromium-browser unclutter
```

#### Auto-start Script

Create `/home/pi/start-portal.sh`:
```bash
#!/bin/bash

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Hide cursor
unclutter -idle 0.1 &

# Start Chromium in kiosk mode
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --enable-features=WebRTC-H264WithOpenH264FFmpeg \
  --use-fake-ui-for-media-stream \
  --disable-session-crashed-bubble \
  --disable-component-update \
  http://localhost:3000
```

Make it executable:
```bash
chmod +x /home/pi/start-portal.sh
```

#### Autostart on Boot

Edit `~/.config/lxsession/LXDE-pi/autostart`:
```bash
@/home/pi/start-portal.sh
```

Or create a systemd service for more control.

## Network Configuration

### Option 1: Server on Local Network
All devices connect to a single server on your local network. Simple but requires port forwarding if devices are in different locations.

### Option 2: Cloud Server
Deploy the server to a cloud provider (AWS, DigitalOcean, etc.) and have all devices connect to it. Better for geographically distributed portals.

### Port Requirements
- Server needs port 3001 open
- WebRTC uses random ports for media (handle via STUN/TURN)

### TURN Server (Optional but Recommended)

For devices behind strict firewalls/NAT, set up a TURN server:

```bash
# Install coturn
sudo apt-get install coturn

# Configure in server/.env
TURN_SERVER_URL=turn:your-turn-server.com:3478
TURN_SERVER_USERNAME=username
TURN_SERVER_CREDENTIAL=password
```

## Testing

### Check Server Status
```bash
curl http://<server-ip>:3001/health
```

### View Registered Devices
```bash
node scripts/list-devices.js
```

### Test Motion Detection
Walk in front of the camera and check the browser console for motion detection logs.

## Troubleshooting

### Camera Not Working
```bash
# Check camera permissions
ls -l /dev/video*

# Add user to video group
sudo usermod -a -G video pi

# Test camera with fswebcam
fswebcam test.jpg
```

### WebRTC Connection Issues
- Check firewall rules
- Verify STUN servers are reachable
- Consider setting up a TURN server
- Check browser console for errors

### Motion Detection Too Sensitive/Not Sensitive Enough
Adjust `VITE_MOTION_THRESHOLD` in client `.env`:
- Higher value = less sensitive (try 40-50)
- Lower value = more sensitive (try 20-25)

### Audio Not Working
Make sure the client has both video AND audio permissions:
```javascript
// This is already configured in the code
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
```

## Performance Tips

### Raspberry Pi Optimization
```bash
# Increase GPU memory
sudo raspi-config
# Advanced Options -> Memory Split -> Set to 256

# Disable unnecessary services
sudo systemctl disable bluetooth
sudo systemctl disable cups
```

### Video Quality vs Performance
Edit `client/src/App.tsx` video constraints:
```javascript
video: {
  width: { ideal: 640 },   // Lower for better performance
  height: { ideal: 480 },
  frameRate: { ideal: 24 } // Lower frame rate
}
```

## Monitoring

Use PM2 to monitor processes:
```bash
pm2 monit
pm2 logs portal-server
pm2 logs portal-client
```

## Maintenance

### View Database
```bash
sqlite3 server/portal.db
.tables
SELECT * FROM groups;
SELECT * FROM devices;
.quit
```

### Clear Old Devices
Devices register automatically when they connect. To clean up old devices, manually edit the database or create a cleanup script.

## Security Considerations

1. **Use HTTPS in Production**: Set up a reverse proxy (nginx) with SSL
2. **Secure WebSocket**: Use WSS instead of WS
3. **Device Authentication**: Consider adding device tokens/secrets
4. **Network Security**: Use VPN for geographically distributed devices
5. **Camera Privacy**: Add a physical camera cover or LED indicator

## Next Steps

- Set up multiple portal devices
- Create custom themes/styling
- Add notification sounds when someone connects
- Implement scheduled "always-on" windows
- Add picture-in-picture mode
- Create mobile companion app
