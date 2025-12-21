import { Router } from 'express';
import { LiveKitService } from '../services/livekit-service';
import { PortalDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth-middleware';

export function createLiveKitRoutes(db: PortalDatabase): Router {
    const router = Router();
    const liveKitService = new LiveKitService();

    router.post('/token', authMiddleware, async (req: AuthRequest, res) => {
        try {
            const { roomName, participantName, identity } = req.body;
            const userId = req.userId!;

            if (!roomName || !participantName || !identity) {
                return res.status(400).json({ error: 'Missing required fields: roomName, participantName, identity' });
            }

            // Verify that the user is a member of the group (roomName is groupId)
            if (!db.isUserInGroup(userId, roomName)) {
                return res.status(403).json({ error: 'Access denied: You are not a member of this group' });
            }

            const token = await liveKitService.generateToken(roomName, participantName, identity);
            res.json({ token });
        } catch (error) {
            console.error('Error generating LiveKit token:', error);
            res.status(500).json({ error: 'Failed to generate token' });
        }
    });

    return router;
}
