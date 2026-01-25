import { Request, Response } from 'express';
import { pool } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const CreateExamSchema = z.object({
    title: z.string().min(3),
    duration_minutes: z.number().min(1),
    start_time: z.string().optional().nullish(),
    end_time: z.string().optional().nullish(),
    config: z.object({
        sections: z.array(z.object({
            filter: z.object({
                subject_id: z.coerce.string().optional().nullish(),
                unit: z.string().optional(),
                topic: z.string().optional(),
                difficulty: z.enum(['easy', 'medium', 'hard', 'any']).optional(),
                tags: z.array(z.string()).optional()
            }),
            count: z.number().min(1)
        }))
    })
});

export const createExam = async (req: AuthRequest, res: Response) => {
    try {
        const validated = CreateExamSchema.parse(req.body);
        const teacherId = req.user?.userId;
        const schoolId = req.user?.schoolId;

        const result = await pool.query(
            `INSERT INTO exams 
            (title, school_id, teacher_id, duration_minutes, start_time, end_time, config, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                validated.title,
                schoolId,
                teacherId,
                validated.duration_minutes,
                validated.start_time || null,
                validated.end_time || null,
                JSON.stringify(validated.config),
                true
            ]
        );

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error('Create Exam Error:', error);
        res.status(400).json({ error: error.message || error });
    }
};

export const getExams = async (req: AuthRequest, res: Response) => {
    try {
        const teacherId = req.user?.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const result = await pool.query(
            `SELECT e.*, 
                    (SELECT COUNT(*) FROM student_attempts sa WHERE sa.exam_id = e.id AND sa.status = 'completed') as attempt_count,
                    COUNT(*) OVER() as total_count 
             FROM exams e
             WHERE e.teacher_id = $1 
             ORDER BY e.created_at DESC
             LIMIT $2 OFFSET $3`,
            [teacherId, limit, offset]
        );

        const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

        res.json({
            exams: result.rows.map(r => {
                const { total_count, ...exam } = r;
                return exam;
            }),
            pagination: {
                total: totalCount,
                page,
                limit,
                pages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error: any) {
        console.error('Get Exams Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;

        const studentsCount = await pool.query(
            'SELECT COUNT(*) FROM users WHERE school_id = $1 AND role = $2',
            [schoolId, 'student']
        );

        const questionsCount = await pool.query(
            'SELECT COUNT(*) FROM questions WHERE school_id = $1',
            [schoolId]
        );

        const examsCount = await pool.query(
            'SELECT COUNT(*) FROM exams WHERE school_id = $1 AND is_active = true AND (end_time IS NULL OR end_time > NOW())',
            [schoolId]
        );

        res.json({
            students: parseInt(studentsCount.rows[0].count),
            questions: parseInt(questionsCount.rows[0].count),
            exams: parseInt(examsCount.rows[0].count)
        });
    } catch (error: any) {
        console.error('Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getExamFormData = async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;

        const subjectsResult = await pool.query(
            `SELECT DISTINCT s.id, s.name 
             FROM subjects s 
             JOIN questions q ON s.id = q.subject_id 
             WHERE q.school_id = $1`,
            [schoolId]
        );

        const subjectsWithUnits = await Promise.all(subjectsResult.rows.map(async (subj: any) => {
            const unitsResult = await pool.query(
                `SELECT DISTINCT unit FROM questions 
                 WHERE school_id = $1 AND subject_id = $2 AND unit IS NOT NULL AND unit != ''`,
                [schoolId, subj.id]
            );
            return {
                ...subj,
                units: unitsResult.rows.map((r: any) => r.unit)
            };
        }));

        res.json({
            subjects: subjectsWithUnits
        });
    } catch (error: any) {
        console.error('Form Data Error:', error);
        res.status(500).json({ error: error.message });
    }
};
export const getExamAttempts = async (req: AuthRequest, res: Response) => {
    const { examId } = req.params;
    const schoolId = req.user?.schoolId;

    try {
        const result = await pool.query(
            `SELECT DISTINCT ON (sa.student_id) sa.*, u.full_name, u.email 
             FROM student_attempts sa
             JOIN users u ON sa.student_id = u.id
             JOIN exams e ON sa.exam_id = e.id
             WHERE e.id = $1 AND e.school_id = $2 AND sa.status = 'completed'
             ORDER BY sa.student_id, sa.score DESC, u.full_name ASC`,
            [examId, schoolId]
        );
        res.json(result.rows);
    } catch (error: any) {
        console.error('Get Exam Attempts Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const deleteExam = async (req: AuthRequest, res: Response) => {
    const { examId } = req.params;
    const schoolId = req.user?.schoolId;

    try {
        // First delete dependent data (responses and attempts) manually since cascaded delete might not be on all DBs
        // Alternatively, if we trust foreign keys with ON DELETE CASCADE, we just delete the exam.
        // Let's be explicit to ensure it works.

        await pool.query('BEGIN');

        // Delete responses associated with attempts of this exam
        await pool.query(`
            DELETE FROM responses WHERE attempt_id IN (
                SELECT id FROM student_attempts WHERE exam_id = $1
            )
        `, [examId]);

        // Delete attempts
        await pool.query('DELETE FROM student_attempts WHERE exam_id = $1', [examId]);

        // Delete exam
        const result = await pool.query(
            'DELETE FROM exams WHERE id = $1 AND school_id = $2 RETURNING id',
            [examId, schoolId]
        );

        await pool.query('COMMIT');

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Exam not found or you do not have permission' });
        }

        res.json({ message: 'Exam deleted successfully' });
    } catch (error: any) {
        await pool.query('ROLLBACK');
        console.error('Delete Exam Error:', error);
        res.status(500).json({ error: error.message });
    }
};
