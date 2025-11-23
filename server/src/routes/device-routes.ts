import { Router } from 'express';
import { PortalDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth-middleware';
import { v4 as uuidv4 } from 'uuid';

export function createDeviceRoutes(db: PortalDatabase): Router {
    const router = Router();

    // All device routes require authentication
    router.use(authMiddleware);

    // POST /api/devices - Register a new device
    router.post('/', (req: AuthRequest, res) => {
        try {
            const { name, groupId } = req.body;
            const userId = req.userId!;

            if (!name || typeof name !== 'string' || name.trim().length === 0) {
                return res.status(400).json({ error: 'Device name is required' });
            }

            if (!groupId || typeof groupId !== 'string') {
                return res.status(400).json({ error: 'Group ID is required' });
            }

            // Check if user is a member of the group
            if (!db.isUserInGroup(userId, groupId)) {
                return res.status(403).json({
                    error: 'You must be a member of the group to add devices'
                });
            }

            // Check if group exists
            const group = db.getGroup(groupId);
            if (!group) {
                return res.status(404).json({ error: 'Group not found' });
            }

            const deviceId = uuidv4();
            db.createDevice(deviceId, groupId, name.trim(), userId);

            const device = db.getDevice(deviceId);

            res.status(201).json({ device });
        } catch (error) {
            console.error('Create device error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // GET /api/users/me/devices - Get current user's devices
    router.get('/me/devices', (req: AuthRequest, res) => {
        try {
            const userId = req.userId!;
            const devices = db.getDevicesByUser(userId);

            res.json({ devices });
        } catch (error) {
            console.error('Get user devices error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // GET /api/devices/:deviceId - Get device details
    router.get('/:deviceId', (req: AuthRequest, res) => {
        try {
            const { deviceId } = req.params;
            const userId = req.userId!;

            const device = db.getDevice(deviceId);

            if (!device) {
                return res.status(404).json({ error: 'Device not found' });
            }

            // Check if user has access (is owner or member of device's group)
            if (device.userId !== userId && !db.isUserInGroup(userId, device.groupId)) {
                return res.status(403).json({ error: 'Access denied' });
            }

            res.json({ device });
        } catch (error) {
            console.error('Get device error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // DELETE /api/devices/:deviceId - Delete a device
    router.delete('/:deviceId', (req: AuthRequest, res) => {
        try {
            const { deviceId } = req.params;
            const userId = req.userId!;

            const device = db.getDevice(deviceId);

            if (!device) {
                return res.status(404).json({ error: 'Device not found' });
            }

            // Only device owner can delete it
            if (device.userId !== userId) {
                return res.status(403).json({
                    error: 'Only the device owner can delete it'
                });
            }

            db.deleteDevice(deviceId);

            res.json({ success: true });
        } catch (error) {
            console.error('Delete device error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
}
