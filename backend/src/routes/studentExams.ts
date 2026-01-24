import { Router } from 'express';
import { startExam, syncAnswers, submitExam, getAvailableExams } from '../controllers/studentExams';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getAvailableExams);
router.post('/:examId/start', authenticate, startExam);
router.post('/:attemptId/sync', authenticate, syncAnswers);
router.post('/:attemptId/submit', authenticate, submitExam);

export default router;
