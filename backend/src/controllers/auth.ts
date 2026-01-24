import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { env } from '../utils/env';
import { z } from 'zod';

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
});

const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    fullName: z.string().min(2),
    role: z.enum(['teacher', 'student']),
    schoolName: z.string().optional(),
    schoolId: z.string().uuid().optional()
});

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = LoginSchema.parse(req.body);
        console.log(`\n[AUTH] Login attempt: ${email}`);

        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        const user = result.rows[0];

        if (!user) {
            console.log(`[AUTH] User not found: ${email}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log(`[AUTH] User: ${user.email}, Role: ${user.role}`);
        console.log(`[AUTH] Password Length: ${password.length}`);

        const isValid = bcrypt.compareSync(password, user.password_hash);
        console.log(`[AUTH] Password Valid: ${isValid}`);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role, schoolId: user.school_id },
            env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, user: { id: user.id, name: user.full_name, role: user.role } });
    } catch (error: any) {
        console.error('[AUTH] Login Error:', error);
        res.status(400).json({ error: error.message });
    }
};

export const register = async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        const { email, password, fullName, role, schoolName, schoolId } = RegisterSchema.parse(req.body);

        await client.query('BEGIN');

        let finalSchoolId = schoolId;

        if (role === 'teacher') {
            if (!schoolName) throw new Error("School name is required for teachers");
            const schoolRes = await client.query(
                'INSERT INTO schools (name) VALUES ($1) RETURNING id',
                [schoolName]
            );
            finalSchoolId = schoolRes.rows[0].id;
        } else {
            if (!finalSchoolId) throw new Error("School selection is required for students");
        }

        const passwordHash = bcrypt.hashSync(password, 10);

        const userRes = await client.query(
            `INSERT INTO users (school_id, email, password_hash, full_name, role)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [finalSchoolId, email, passwordHash, fullName, role]
        );
        const user = userRes.rows[0];

        await client.query('COMMIT');

        const token = jwt.sign(
            { userId: user.id, role: user.role, schoolId: user.school_id },
            env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, user: { id: user.id, name: user.full_name, role: user.role } });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('[AUTH] Register Error:', error);
        res.status(400).json({ error: error.message || 'Registration failed' });
    } finally {
        client.release();
    }
};

export const getSchools = async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT id, name FROM schools ORDER BY name ASC');
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
export const getStudents = async (req: Request, res: Response) => {
    try {
        const schoolId = (req as any).user?.schoolId;
        const result = await pool.query(
            'SELECT id, email, full_name, created_at FROM users WHERE school_id = $1 AND role = $2 ORDER BY full_name ASC',
            [schoolId, 'student']
        );
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
