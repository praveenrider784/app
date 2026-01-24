import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../utils/env';
import { pool } from '../config/db';

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
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

export const requireRole = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
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
