import { Request, Response } from 'express';
import { pool } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const debugLog = (msg: string) => {
    const logPath = path.join(process.cwd(), 'exam_debug.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
};

// Start Exam
export const startExam = async (req: AuthRequest, res: Response) => {
    const { examId } = req.params;
    const studentId = req.user?.userId;
    const schoolId = req.user?.schoolId;

    try {
        debugLog(`START EXAM: Student=${studentId} Exam=${examId} School=${schoolId}`);

        if (!schoolId) {
            debugLog(`[ERROR] Student ${studentId} has no schoolId!`);
            return res.status(403).json({ error: "Your account is not associated with any school. Please contact support." });
        }

        // 1. Check if attempt exists
        const existingAttemptResult = await pool.query(
            'SELECT * FROM student_attempts WHERE exam_id = $1 AND student_id = $2 LIMIT 1',
            [examId, studentId]
        );

        const existingAttempt = existingAttemptResult.rows[0];

        if (existingAttempt) {
            debugLog(`[RESUME] Found existing attempt: ${existingAttempt.id}`);

            // Fetch exam duration for the timer
            const examInfo = await pool.query('SELECT duration_minutes FROM exams WHERE id = $1', [examId]);
            const duration = examInfo.rows[0]?.duration_minutes || 60;

            const responsesResult = await pool.query(
                `SELECT q.id, q.text, q.options, q.image_url, q.subject_id, r.selected_option_id 
                 FROM responses r 
                 JOIN questions q ON r.question_id = q.id 
                 WHERE r.attempt_id = $1`,
                [existingAttempt.id]
            );

            debugLog(`[RESUME] Loaded ${responsesResult.rows.length} existing responses`);

            return res.json({
                attempt: existingAttempt,
                duration_minutes: duration,
                questions: responsesResult.rows.map((r: any) => ({
                    ...r,
                    options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options
                })),
                existingAnswers: responsesResult.rows.reduce((acc: any, curr: any) => {
                    if (curr.selected_option_id) {
                        acc[curr.id] = curr.selected_option_id;
                    }
                    return acc;
                }, {})
            });
        }

        // 2. Fetch Exam Config
        const examResult = await pool.query(
            'SELECT * FROM exams WHERE id = $1 AND school_id = $2',
            [examId, schoolId]
        );
        const exam = examResult.rows[0];

        if (!exam) {
            debugLog(`[ERROR] Exam ${examId} not found for school ${schoolId}`);
            return res.status(404).json({ error: 'Exam not found' });
        }

        const duration = exam.duration_minutes || 60;
        if (!exam.is_active) return res.status(403).json({ error: 'Exam is not active' });

        // Strict Timing Check
        const now = new Date();
        if (exam.start_time && new Date(exam.start_time) > now) {
            return res.status(403).json({ error: `This exam has not started yet. It is scheduled for ${new Date(exam.start_time).toLocaleString()}.` });
        }
        if (exam.end_time && new Date(exam.end_time) < now) {
            return res.status(403).json({ error: 'This exam has already ended and is no longer available for new attempts.' });
        }

        // 3. Generate Question Set based on Config
        const config = typeof exam.config === 'string' ? JSON.parse(exam.config) : exam.config;
        let selectedQuestionIds: string[] = [];

        if (!config || !config.sections) {
            throw new Error("Invalid exam configuration: sections missing");
        }

        for (const section of config.sections) {
            let queryStr = 'SELECT id FROM questions WHERE school_id = $1';
            let params: any[] = [schoolId];
            let pCount = 2;

            if (section.filter.subject_id) {
                queryStr += ` AND subject_id = $${pCount++}`;
                params.push(section.filter.subject_id.toString());
            }
            if (section.filter.unit && section.filter.unit !== '') {
                queryStr += ` AND unit = $${pCount++}`;
                params.push(section.filter.unit.toString());
            }
            if (section.filter.topic && section.filter.topic !== '') {
                queryStr += ` AND topic = $${pCount++}`;
                params.push(section.filter.topic.toString());
            }
            if (section.filter.difficulty && section.filter.difficulty !== 'any') {
                queryStr += ` AND difficulty = $${pCount++}`;
                params.push(section.filter.difficulty);
            }
            if (section.filter.tags && section.filter.tags.length > 0) {
                queryStr += ` AND tags @> $${pCount++}::text[]`;
                params.push(section.filter.tags);
            }

            queryStr += ` ORDER BY RANDOM() LIMIT $${pCount++}`;
            params.push(parseInt(section.count.toString()) || 10);

            debugLog(`[QUERY] ${queryStr} | PARAMS: ${JSON.stringify(params)}`);

            const candidates = await pool.query(queryStr, params);
            debugLog(`[RESULT] Found ${candidates.rows.length} questions`);

            // Ensure we don't add duplicate IDs from overlapping sections
            candidates.rows.forEach(q => {
                if (!selectedQuestionIds.includes(q.id)) {
                    selectedQuestionIds.push(q.id);
                }
            });
        }

        debugLog(`[TOTAL] Gathered ${selectedQuestionIds.length} unique questions`);

        if (selectedQuestionIds.length === 0) {
            throw new Error("No questions found matching the exam criteria. Please contact your teacher.");
        }

        // 4. Create Attempt
        const newAttemptResult = await pool.query(
            `INSERT INTO student_attempts (exam_id, student_id, total_questions, status)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [examId, studentId, selectedQuestionIds.length, 'in_progress']
        );
        const newAttempt = newAttemptResult.rows[0];

        // 5. Seed Responses (Empty)
        for (const qId of selectedQuestionIds) {
            await pool.query(
                'INSERT INTO responses (attempt_id, question_id, selected_option_id) VALUES ($1, $2, $3)',
                [newAttempt.id, qId, null]
            );
        }

        // 6. Return Questions
        const questionsResult = await pool.query(
            'SELECT id, text, options, image_url, subject_id FROM questions WHERE id = ANY($1)',
            [selectedQuestionIds]
        );

        res.json({
            attempt: newAttempt,
            duration_minutes: duration,
            end_time: exam.end_time,
            questions: questionsResult.rows.map(q => ({
                ...q,
                options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
            }))
        });

    } catch (error: any) {
        debugLog(`[ERROR] Start Exam Failed: ${error.message}`);
        console.error('Start Exam Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Sync Answers
export const syncAnswers = async (req: AuthRequest, res: Response) => {
    const { attemptId } = req.params;
    const { answers } = req.body;

    try {
        for (const answer of answers) {
            await pool.query(
                'UPDATE responses SET selected_option_id = $1 WHERE attempt_id = $2 AND question_id = $3',
                [answer.selected_option_id, attemptId, answer.question_id]
            );
        }
        res.json({ status: 'synced' });
    } catch (error: any) {
        console.error('Sync Answers Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Submit Exam
export const submitExam = async (req: AuthRequest, res: Response) => {
    const { attemptId } = req.params;

    try {
        // 1. Mark attempt completed
        await pool.query(
            'UPDATE student_attempts SET status = $1, end_time = $2 WHERE id = $3',
            ['completed', new Date().toISOString(), attemptId]
        );

        // 2. Grader Logic
        const responsesResult = await pool.query(
            `SELECT r.id, r.selected_option_id, q.correct_option_id 
             FROM responses r 
             JOIN questions q ON r.question_id = q.id 
             WHERE r.attempt_id = $1`,
            [attemptId]
        );

        let score = 0;
        for (const r of responsesResult.rows) {
            const isCorrect = r.selected_option_id === r.correct_option_id;
            if (isCorrect) score++;

            await pool.query(
                'UPDATE responses SET is_correct = $1 WHERE id = $2',
                [isCorrect, r.id]
            );
        }

        // 3. Update Score
        await pool.query(
            'UPDATE student_attempts SET score = $1 WHERE id = $2',
            [score, attemptId]
        );

        res.json({ status: 'submitted', score });

    } catch (error: any) {
        console.error('Submit Exam Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get Available Exams for Student
export const getAvailableExams = async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.userId;
    const schoolId = req.user?.schoolId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    try {
        const result = await pool.query(
            `SELECT e.*, sa.status as attempt_status, sa.score, sa.total_questions, 
                    (SELECT COUNT(*) FROM exams WHERE school_id = $2 AND is_active = true 
                     AND (end_time IS NULL OR end_time >= NOW() OR id IN (SELECT exam_id FROM student_attempts WHERE student_id = $1))) as total_count
             FROM exams e
             LEFT JOIN (
                SELECT DISTINCT ON (exam_id) * 
                FROM student_attempts 
                WHERE student_id = $1 
                ORDER BY exam_id, (status = 'completed') DESC, id DESC
             ) sa ON e.id = sa.exam_id
             WHERE e.school_id = $2 AND e.is_active = true
             AND (e.end_time IS NULL OR e.end_time >= NOW() OR sa.id IS NOT NULL)
             ORDER BY e.created_at DESC
             LIMIT $3 OFFSET $4`,
            [studentId, schoolId, limit, offset]
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
        console.error('Get Available Exams Error:', error);
        res.status(500).json({ error: error.message });
    }
};
