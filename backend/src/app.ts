import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './utils/env';

import authRoutes from './routes/auth';
import questionRoutes from './routes/questions';
import examRoutes from './routes/exams';
import studentExamRoutes from './routes/studentExams';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

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
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

export default app;
