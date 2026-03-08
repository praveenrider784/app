import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../utils/env';
import { pool } from '../config/db';
import fs from 'fs';
import path from 'path';

const shouldTrace = env.REQUEST_TRACE === 'true' || env.NODE_ENV === 'development';

const debugLog = (msg: string) => {
    if (!shouldTrace) return;
    const logPath = path.join(process.cwd(), 'exam_debug.log');
    fs.promises.appendFile(logPath, `[${new Date().toISOString()}] [AUTH_MIDDLEWARE] ${msg}\n`).catch(() => { });
};

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        role: string;
        schoolId: string;
    };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        debugLog(`No token provided for ${req.method} ${req.url}`);
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        debugLog(`Malformed auth header for ${req.method} ${req.url}: ${authHeader}`);
        return res.status(401).json({ error: 'Malformed token' });
    }

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        req.user = decoded;
        debugLog(`Authenticated user: ${decoded.userId}, role: ${decoded.role} for ${req.method} ${req.url}`);
        next();
    } catch (error: any) {
        debugLog(`JWT Verification Failed for ${req.method} ${req.url}: ${error.message}`);
        return res.status(401).json({ error: 'Invalid token' });
    }
};

export const requireRole = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            debugLog(`Access Denied (No User): Required roles ${roles.join(', ')} for ${req.method} ${req.url}`);
            return res.status(403).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            debugLog(`Access Denied (Role Mismatch): User ${req.user.userId} has role ${req.user.role}, requires ${roles.join(', ')} for ${req.method} ${req.url}`);
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        debugLog(`Access Granted: User ${req.user.userId} with role ${req.user.role} authorized for ${req.method} ${req.url}`);
        next();
    };
};

export const checkSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const schoolId = req.user?.schoolId;

    try {
        const result = await pool.query(
            'SELECT subscription_status FROM schools WHERE id = $1',
            [schoolId]
        );

        const status = result.rows[0]?.subscription_status;

        if (status !== 'active') {
            return res.status(402).json({
                error: 'Payment Required',
                message: 'Your school subscription is inactive. Please complete payment to continue.'
            });
        }

        next();
    } catch (error) {
        console.error('Subscription Check Error:', error);
        res.status(500).json({ error: 'Failed to verify subscription status' });
    }
};
