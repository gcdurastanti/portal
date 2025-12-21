import { Router } from 'express';
import { GooglePhotosService } from '../services/google-photos-service';
import { PortalDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth-middleware';

export function createGooglePhotosRoutes(db: PortalDatabase): Router {
    const router = Router();
    const googlePhotosService = new GooglePhotosService(db);

    // Initiate Auth Flow
    router.get('/auth', authMiddleware, (req, res) => {
        const url = googlePhotosService.generateAuthUrl();
        res.json({ url });
    });

    // Handle Callback (Client sends code here)
    router.post('/auth/callback', authMiddleware, async (req: AuthRequest, res) => {
        try {
            const { code } = req.body;
            await googlePhotosService.authenticate(code, req.userId!);
            res.json({ success: true });
        } catch (error) {
            console.error('Google Auth Error:', error);
            res.status(500).json({ error: 'Authentication failed' });
        }
    });

    // List Albums
    router.get('/albums', authMiddleware, async (req: AuthRequest, res) => {
        try {
            const data = await googlePhotosService.listAlbums(req.userId!);
            res.json(data);
        } catch (error) {
            console.error('List Albums Error:', error);
            res.status(500).json({ error: 'Failed to list albums' });
        }
    });

    // Set Selected Album
    router.post('/config', authMiddleware, async (req: AuthRequest, res) => {
        try {
            const { albumId } = req.body;
            await googlePhotosService.setSelectedAlbum(req.userId!, albumId);
            res.json({ success: true });
        } catch (error) {
            console.error('Set Config Error:', error);
            res.status(500).json({ error: 'Failed to update config' });
        }
    });

    // Get Photos (from selected album or all)
    router.get('/photos', authMiddleware, async (req: AuthRequest, res) => {
        try {
            const config = db.getGooglePhotosConfig(req.userId!);
            const albumId = config?.selectedAlbumId;

            const data = await googlePhotosService.getMediaItems(req.userId!, albumId || undefined);
            res.json(data);
        } catch (error) {
            console.error('Get Photos Error:', error);
            res.status(500).json({ error: 'Failed to get photos' });
        }
    });

    // Get Config Status
    router.get('/status', authMiddleware, (req: AuthRequest, res) => {
        const config = db.getGooglePhotosConfig(req.userId!);
        res.json({
            isAuthenticated: !!config,
            selectedAlbumId: config?.selectedAlbumId
        });
    });

    return router;
}
