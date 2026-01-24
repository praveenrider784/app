import { Router } from 'express';
import { uploadQuestions, getQuestions } from '../controllers/questions';
import { authenticate, requireRole } from '../middleware/auth';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Teacher only: Question Management
router.get('/', authenticate, requireRole(['teacher', 'admin']), getQuestions);
router.post('/upload', authenticate, requireRole(['teacher', 'admin']), upload.single('file'), uploadQuestions);

export default router;
