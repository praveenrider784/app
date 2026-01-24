import { Router } from 'express';
import { createExam, getExams, getDashboardStats, getExamFormData, getExamAttempts, deleteExam } from '../controllers/exams';
import { authenticate, requireRole, checkSubscription } from '../middleware/auth';

const router = Router();

// All exam routes require authentication and teacher/admin role
router.post('/', authenticate, requireRole(['teacher', 'admin']), createExam);
router.get('/', authenticate, requireRole(['teacher', 'admin']), getExams);
router.get('/stats', authenticate, requireRole(['teacher', 'admin']), getDashboardStats);
router.get('/form-data', authenticate, requireRole(['teacher', 'admin']), getExamFormData);
router.get('/:examId/attempts', authenticate, requireRole(['teacher', 'admin']), getExamAttempts);
router.delete('/:examId', authenticate, requireRole(['teacher', 'admin']), deleteExam);

export default router;
