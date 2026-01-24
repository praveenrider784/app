import { Router } from 'express';
import { login, register, getSchools, getStudents } from '../controllers/auth';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.get('/schools', getSchools);
router.get('/students', authenticate, getStudents);

export default router;
