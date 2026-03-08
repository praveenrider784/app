import { Request, Response } from 'express';
import { pool } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { env } from '../utils/env';

const shouldDebugLog = env.REQUEST_TRACE === 'true' || env.NODE_ENV === 'development';
const debugLog = (msg: string) => {
    if (!shouldDebugLog) return;
    const logPath = path.join(process.cwd(), 'exam_debug.log');
    const timestamp = new Date().toISOString();
    fs.promises.appendFile(logPath, `[${timestamp}] ${msg}\n`).catch(() => { });
};

const shuffleInPlace = <T>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

/**
 * Start or resume an exam attempt.
 * Ensures strict filtering and question serving.
 */
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

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Advisory lock to prevent race conditions on attempt creation
            // We use a hash of studentId and examId to create a unique lock key
            const lockKeyStr = `${studentId}-${examId}`;
            let hash = 0;
            for (let i = 0; i < lockKeyStr.length; i++) {
                hash = ((hash << 5) - hash) + lockKeyStr.charCodeAt(i);
                hash |= 0; // Convert to 32bit integer
            }
            await client.query('SELECT pg_advisory_xact_lock($1)', [hash]);

            // Check for existing attempt
            const existingAttemptResult = await client.query(
                `SELECT * FROM student_attempts 
                 WHERE exam_id = $1 AND student_id = $2 
                 ORDER BY (status = 'completed') DESC, start_time DESC 
                 LIMIT 1`,
                [examId, studentId]
            );

            const existingAttempt = existingAttemptResult.rows[0];

            if (existingAttempt) {
                debugLog(`[RESUME] Found existing attempt: ${existingAttempt.id} status=${existingAttempt.status}`);

                const examInfo = await client.query(
                    'SELECT duration_minutes, start_time, end_time FROM exams WHERE id = $1',
                    [examId]
                );
                const duration = examInfo.rows[0]?.duration_minutes || 60;
                const examStartTime = examInfo.rows[0]?.start_time || null;
                const examEndTime = examInfo.rows[0]?.end_time || null;

                const responsesResult = await client.query(
                    `SELECT q.id, q.text, q.options, q.image_url, q.subject_id, r.selected_option_id 
                     FROM responses r 
                     JOIN questions q ON r.question_id = q.id 
                     WHERE r.attempt_id = $1
                     ORDER BY r.id ASC`,
                    [existingAttempt.id]
                );

                await client.query('COMMIT');

                return res.json({
                    attempt: existingAttempt,
                    duration_minutes: duration,
                    start_time: examStartTime,
                    end_time: examEndTime,
                    questions: responsesResult.rows.map((r: any) => ({
                        ...r,
                        options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options
                    })),
                    existingAnswers: responsesResult.rows.reduce((acc: any, curr: any) => {
                        if (curr.selected_option_id) acc[curr.id] = curr.selected_option_id;
                        return acc;
                    }, {})
                });
            }

            // Create New Attempt
            const examResult = await client.query(
                'SELECT * FROM exams WHERE id = $1 AND school_id = $2',
                [examId, schoolId]
            );
            const exam = examResult.rows[0];

            if (!exam) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Exam not found' });
            }

            if (!exam.is_active) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Exam is not active' });
            }

            const now = new Date();
            if (exam.start_time && new Date(exam.start_time) > now) {
                await client.query('ROLLBACK');
                const startStr = new Date(exam.start_time).toLocaleString();
                return res.status(403).json({ error: `Not started. Scheduled for ${startStr}` });
            }
            if (exam.end_time && new Date(exam.end_time) < now) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Exam has ended and is no longer available.' });
            }

            // Question Selection Logic
            const config = typeof exam.config === 'string' ? JSON.parse(exam.config) : exam.config;
            let selectedQuestionIds: string[] = [];

            if (config.specific_question_ids && Array.isArray(config.specific_question_ids) && config.specific_question_ids.length > 0) {
                const requestedIds = Array.from(new Set(config.specific_question_ids));
                const subsetCount = Number(config.random_subset_count);
                const shouldRandomSubset = Number.isFinite(subsetCount) && subsetCount > 0 && subsetCount < requestedIds.length;

                if (shouldRandomSubset) {
                    const qFetch = await client.query(
                        `SELECT id
                         FROM questions
                         WHERE school_id = $1 AND id = ANY($2::uuid[])
                         ORDER BY RANDOM()
                         LIMIT $3`,
                        [schoolId, requestedIds, subsetCount]
                    );
                    selectedQuestionIds = qFetch.rows.map((q: any) => q.id);
                } else {
                    const qFetch = await client.query(
                        'SELECT id FROM questions WHERE school_id = $1 AND id = ANY($2::uuid[])',
                        [schoolId, requestedIds]
                    );
                    selectedQuestionIds = qFetch.rows.map((q: any) => q.id);
                    shuffleInPlace(selectedQuestionIds);
                }
            } else if (config.sections) {
                for (const section of config.sections) {
                    let queryStr = 'SELECT id FROM questions WHERE school_id = $1';
                    let params: any[] = [schoolId];
                    let pCount = 2;

                    if (section.filter.subject_id) { queryStr += ` AND subject_id = $${pCount++}`; params.push(section.filter.subject_id); }
                    if (section.filter.unit && section.filter.unit !== '') { queryStr += ` AND unit = $${pCount++}`; params.push(section.filter.unit); }
                    if (section.filter.difficulty && section.filter.difficulty !== 'any') { queryStr += ` AND difficulty = $${pCount++}`; params.push(section.filter.difficulty); }

                    queryStr += ` ORDER BY RANDOM() LIMIT $${pCount}`;
                    params.push(parseInt(section.count) || 10);

                    const candidates = await client.query(queryStr, params);
                    candidates.rows.forEach(q => {
                        if (!selectedQuestionIds.includes(q.id)) selectedQuestionIds.push(q.id);
                    });
                }
            }

            if (selectedQuestionIds.length === 0) {
                throw new Error("No questions found matching criteria.");
            }

            const newAttemptResult = await client.query(
                `INSERT INTO student_attempts (exam_id, student_id, total_questions, status)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [examId, studentId, selectedQuestionIds.length, 'in_progress']
            );
            const newAttempt = newAttemptResult.rows[0];

            await client.query(
                `INSERT INTO responses (attempt_id, question_id)
                 SELECT $1::uuid, qid
                 FROM UNNEST($2::uuid[]) AS qid`,
                [newAttempt.id, selectedQuestionIds]
            );

            await client.query('COMMIT');

            const questionsResult = await pool.query(
                `SELECT q.id, q.text, q.options, q.image_url, q.subject_id
                 FROM responses r
                 JOIN questions q ON r.question_id = q.id
                 WHERE r.attempt_id = $1
                 ORDER BY r.id ASC`,
                [newAttempt.id]
            );

            res.json({
                attempt: newAttempt,
                duration_minutes: exam.duration_minutes || 60,
                start_time: exam.start_time || null,
                end_time: exam.end_time || null,
                questions: questionsResult.rows.map(q => ({
                    ...q,
                    options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
                }))
            });

        } catch (e: any) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error: any) {
        debugLog(`[ERROR] startExam: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get available exams filtered by scope (active/history).
 */
export const getAvailableExams = async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.userId;
    const schoolId = req.user?.schoolId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 6; // Default to 6 for student dashboard
    const offset = (page - 1) * limit;
    const scope = (req.query.scope as string) || 'active';

    try {
        debugLog(`GET_AVAILABLE_EXAMS: User=${studentId} Scope=${scope}`);

        const expiredCondition = `(
            (e.end_time IS NOT NULL AND e.end_time < NOW()) OR 
            (e.end_time IS NULL AND e.start_time IS NOT NULL AND e.duration_minutes IS NOT NULL AND (e.start_time + (e.duration_minutes || ' minutes')::interval) < NOW())
        )`;

        let scopeCondition = '';
        if (scope === 'active') {
            scopeCondition = `AND e.is_active = true AND NOT (${expiredCondition}) AND (sa.status IS NULL OR sa.status <> 'completed')`;
        } else if (scope === 'history') {
            // History includes finished exams and closed exams, even if this student did not attempt.
            scopeCondition = `AND (sa.status = 'completed' OR (${expiredCondition}) OR e.is_active = false)`;
        }

        const baseJoin = `
            FROM exams e
            LEFT JOIN (
                SELECT DISTINCT ON (exam_id) * 
                FROM student_attempts 
                WHERE student_id = $1 
                ORDER BY exam_id, COALESCE(end_time, start_time) DESC, id DESC
            ) sa ON e.id = sa.exam_id
            WHERE e.school_id = $2
            ${scopeCondition}
        `;

        const result = await pool.query(
            `SELECT e.*, sa.status as attempt_status, sa.score, sa.total_questions,
                    (${expiredCondition}) as is_expired,
                    CASE WHEN e.start_time IS NOT NULL AND e.start_time > NOW() THEN true ELSE false END as is_upcoming
             ${baseJoin}
             ORDER BY COALESCE(sa.end_time, e.end_time, e.created_at) DESC, e.id DESC
             LIMIT $3 OFFSET $4`,
            [studentId, schoolId, limit, offset]
        );

        const countRes = await pool.query(`SELECT COUNT(*) ${baseJoin}`, [studentId, schoolId]);
        const total = parseInt(countRes.rows[0].count);

        debugLog(`GET_AVAILABLE_EXAMS_RESULT: User=${studentId} Scope=${scope} count=${result.rows.length} total=${total}`);

        res.json({
            exams: result.rows,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
            meta: { scope, server_now: new Date().toISOString() }
        });
    } catch (error: any) {
        debugLog(`[ERROR] getAvailableExams: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Submit exam responses and calculate score.
 */
export const submitExam = async (req: AuthRequest, res: Response) => {
    const { attemptId } = req.params;
    const studentId = req.user?.userId;

    try {
        debugLog(`SUBMIT EXAM: Attempt=${attemptId} Student=${studentId}`);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const ownerCheck = await client.query(
                'SELECT id FROM student_attempts WHERE id = $1 AND student_id = $2 FOR UPDATE',
                [attemptId, studentId]
            );
            if (ownerCheck.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'You are not allowed to submit this attempt.' });
            }

            // 1. Mark attempt completed
            await client.query(
                'UPDATE student_attempts SET status = $1, end_time = NOW() WHERE id = $2 AND student_id = $3',
                ['completed', attemptId, studentId]
            );

            // 2. Grade in one SQL pass and compute score
            const scoreResult = await client.query(
                `WITH graded AS (
                    SELECT r.id, (r.selected_option_id = q.correct_option_id) AS is_correct
                    FROM responses r
                    JOIN questions q ON r.question_id = q.id
                    JOIN student_attempts sa ON sa.id = r.attempt_id
                    WHERE r.attempt_id = $1 AND sa.student_id = $2
                 ),
                 updated AS (
                    UPDATE responses r
                    SET is_correct = g.is_correct
                    FROM graded g
                    WHERE r.id = g.id
                    RETURNING g.is_correct
                 )
                 SELECT COUNT(*) FILTER (WHERE is_correct) AS score FROM updated`,
                [attemptId, studentId]
            );

            const score = Number(scoreResult.rows[0]?.score || 0);

            // 3. Update Score
            await client.query(
                'UPDATE student_attempts SET score = $1 WHERE id = $2 AND student_id = $3',
                [score, attemptId, studentId]
            );

            await client.query('COMMIT');

            res.json({ status: 'submitted', score });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

    } catch (error: any) {
        debugLog(`[ERROR] submitExam: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Sync answers.
 */
export const syncAnswers = async (req: AuthRequest, res: Response) => {
    const { attemptId } = req.params;
    const { answers } = req.body;
    const studentId = req.user?.userId;

    try {
        if (!Array.isArray(answers)) {
            return res.status(400).json({ error: "Answers must be an array" });
        }

        const ownerCheck = await pool.query(
            'SELECT id FROM student_attempts WHERE id = $1 AND student_id = $2',
            [attemptId, studentId]
        );
        if (ownerCheck.rowCount === 0) {
            return res.status(403).json({ error: 'You are not allowed to sync this attempt.' });
        }

        const validAnswers = answers.filter((answer: any) =>
            answer &&
            typeof answer.question_id === 'string' &&
            Number.isInteger(answer.selected_option_id)
        );

        if (validAnswers.length === 0) {
            return res.json({ status: 'synced' });
        }

        const questionIds = validAnswers.map((a: any) => a.question_id);
        const selectedOptionIds = validAnswers.map((a: any) => a.selected_option_id);

        await pool.query(
            `WITH payload AS (
                SELECT
                    UNNEST($1::uuid[]) AS question_id,
                    UNNEST($2::int[]) AS selected_option_id
             )
             UPDATE responses r
             SET selected_option_id = p.selected_option_id
             FROM payload p, student_attempts sa
             WHERE r.attempt_id = $3
               AND r.question_id = p.question_id
               AND sa.id = r.attempt_id
               AND sa.student_id = $4`,
            [questionIds, selectedOptionIds, attemptId, studentId]
        );

        res.json({ status: 'synced' });
    } catch (error: any) {
        debugLog(`[ERROR] syncAnswers: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};
