import { Router } from 'express';
import { AuthService } from '../auth/auth-service';
import { PortalDatabase } from '../database';
import { authMiddleware } from '../middleware/auth-middleware';
import type { AuthRequest } from '../middleware/auth-middleware';

export function createAuthRoutes(db: PortalDatabase): Router {
    const router = Router();
    const authService = new AuthService(db);

    // POST /api/auth/register
    router.post('/register', async (req, res) => {
        try {
            const result = await authService.register(req.body);

            if (!result.success) {
                return res.status(400).json({ error: result.error });
            }

            res.status(201).json(result);
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // POST /api/auth/login
    router.post('/login', async (req, res) => {
        try {
            const result = await authService.login(req.body);

            if (!result.success) {
                return res.status(401).json({ error: result.error });
            }

            // Include user's groups in login response
            const groups = authService.getUserGroups(result.user!.id);

            res.json({
                ...result,
                groups
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // POST /api/auth/logout
    router.post('/logout', authMiddleware, (req, res) => {
        // With JWT, logout is handled client-side by removing the token
        // This endpoint exists for future session management if needed
        res.json({ success: true });
    });

    // GET /api/auth/me
    router.get('/me', authMiddleware, (req: AuthRequest, res) => {
        try {
            const user = authService.getUserById(req.userId!);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const groups = authService.getUserGroups(user.id);

            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl
                },
                groups
            });
        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
}
