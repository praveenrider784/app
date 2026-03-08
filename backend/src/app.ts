import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './utils/env';

import authRoutes from './routes/auth';
import questionRoutes from './routes/questions';
import examRoutes from './routes/exams';
import studentExamRoutes from './routes/studentExams';

const app = express();
const debugLogPath = path.join(process.cwd(), 'exam_debug.log');
const shouldTraceRequests = env.REQUEST_TRACE === 'true' || env.NODE_ENV === 'development';
const allowedOrigins = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [];

// Request Tracing
if (shouldTraceRequests) {
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            fs.promises.appendFile(
                debugLogPath,
                `[${new Date().toISOString()}] RESPONSE: ${req.method} ${req.url} | Status: ${res.statusCode} | Duration: ${duration}ms\n`
            ).catch(() => { });
        });
        fs.promises.appendFile(
            debugLogPath,
            `[${new Date().toISOString()}] REQUEST: ${req.method} ${req.url} | Auth: ${req.headers.authorization ? 'Yes' : 'No'}\n`
        ).catch(() => { });
        next();
    });
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "https://*.supabase.co"],
        },
    },
}));
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
if (env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
}

// Routes
app.use('/auth', authRoutes);
app.use('/questions', questionRoutes);
app.use('/exams', examRoutes);
app.use('/student/exams', studentExamRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', environment: env.NODE_ENV });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: env.NODE_ENV === 'development' ? err.message : 'Unexpected server error'
    });
});

export default app;
