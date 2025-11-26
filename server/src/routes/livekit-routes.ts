import { Router } from 'express';
import { LiveKitService } from '../services/livekit-service';

export function createLiveKitRoutes(): Router {
    const router = Router();
    const liveKitService = new LiveKitService();

    router.post('/token', async (req, res) => {
        try {
            const { roomName, participantName, identity } = req.body;

            if (!roomName || !participantName || !identity) {
                return res.status(400).json({ error: 'Missing required fields: roomName, participantName, identity' });
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
