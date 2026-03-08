import { Router } from 'express';
import { uploadQuestions, getQuestions } from '../controllers/questions';
import { authenticate, requireRole } from '../middleware/auth';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
    fileFilter: (_req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith('.docx')) {
            return cb(new Error('Only .docx files are allowed'));
        }
        cb(null, true);
    }
});

// Teacher only: Question Management
router.get('/', authenticate, requireRole(['teacher', 'admin']), getQuestions);
router.post('/upload', authenticate, requireRole(['teacher', 'admin']), upload.single('file'), uploadQuestions);

export default router;
