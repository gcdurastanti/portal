import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/session-manager';

export interface AuthRequest extends Request {
    userId?: string;
    userEmail?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = verifyToken(token);

    if (!payload) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
}

export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = verifyToken(token);

        if (payload) {
            req.userId = payload.userId;
            req.userEmail = payload.email;
        }
    }

    next();
}
