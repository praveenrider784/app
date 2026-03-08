import { Request, Response } from 'express';
import { pool } from '../config/db';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/auth';

const LOG_FILE = path.join(process.cwd(), 'exam_debug.log');
const log = (msg: string) => fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
import { z } from 'zod';
import { parseWordDocument } from '../utils/wordParser';

// More flexible schema with coercion - enums are still strict but we normalize data before parsing
const QuestionRowSchema = z.object({
    text: z.coerce.string().min(1),
    option_a: z.coerce.string().min(1),
    option_b: z.coerce.string().min(1),
    option_c: z.coerce.string().min(1),
    option_d: z.coerce.string().min(1),
    correct_option: z.enum(['A', 'B', 'C', 'D']),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    subject: z.coerce.string().min(1),
    unit: z.coerce.string().optional().nullish(),
    topic: z.coerce.string().optional().nullish(),
    tags: z.coerce.string().optional().nullish()
});

/**
 * Aggressive normalization: lowercase and remove all non-alphanumeric characters.
 * "Correct Op" -> "correctop"
 * "Option A" -> "optiona"
 */
const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

const NORMALIZED_HEADER_MAP: Record<string, string> = {
    'subject': 'subject',
    'text': 'text',
    'optiona': 'option_a',
    'optionb': 'option_b',
    'optionc': 'option_c',
    'optiond': 'option_d',
    'correctoption': 'correct_option',
    'difficulty': 'difficulty',
    'unit': 'unit',
    'topic': 'topic',
    'tags': 'tags'
};

const findMappedKey = (key: string) => {
    const nk = normalizeKey(key);
    // 1. Exact match in map
    if (NORMALIZED_HEADER_MAP[nk]) return NORMALIZED_HEADER_MAP[nk];

    // 2. Keyword fallback (aggressive search)
    if (nk.includes('correct') || nk.includes('ans') || (nk.startsWith('opt') && nk.includes('correct'))) return 'correct_option';
    if (nk.includes('quest') || nk.includes('text')) return 'text';
    if (nk === 'a' || (nk.startsWith('opt') && nk.endsWith('a'))) return 'option_a';
    if (nk === 'b' || (nk.startsWith('opt') && nk.endsWith('b'))) return 'option_b';
    if (nk === 'c' || (nk.startsWith('opt') && nk.endsWith('c'))) return 'option_c';
    if (nk === 'd' || (nk.startsWith('opt') && nk.endsWith('d'))) return 'option_d';
    if (nk.includes('unit') || nk.includes('chap') || nk.includes('mod') || nk.includes('sect')) return 'unit';
    if (nk.includes('diff')) return 'difficulty';
    if (nk.includes('sub')) return 'subject';
    if (nk.includes('top')) return 'topic';
    if (nk.includes('tag')) return 'tags';

    return nk; // Fallback to raw normalized key
};

export const uploadQuestions = async (req: AuthRequest, res: Response) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const schoolId = req.user?.schoolId;
    log(`[CONTROLLER] Received upload request. SchoolId: ${schoolId}, File: ${file?.originalname}, Path: ${file?.path}, Size: ${file?.size}`);

    try {
        if (!file?.originalname.endsWith('.docx')) {
            log(`[CONTROLLER] Rejected: Not a .docx file`);
            if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return res.status(400).json({ error: 'Invalid file format. Please upload a .docx Word document.' });
        }

        log(`[CONTROLLER] Calling parseWordDocument for ${file.path}`);
        const rawData = await parseWordDocument(file.path);
        log(`[CONTROLLER] parseWordDocument returned ${rawData.length} rows`);

        const validatedQuestions = [];
        const errors = [];

        for (const [index, row] of rawData.entries()) {
            try {
                // 1. Lenient Correct Option (Find A-D or 1-4)
                let correct_option = 'A'; // Default fallback
                if (row.correct_option) {
                    let val = String(row.correct_option).trim().toUpperCase();
                    // Map 1->A, 2->B, etc. if it's a single digit
                    if (/^[1-4]$/.test(val)) {
                        const map: Record<string, string> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
                        val = map[val];
                    }
                    const match = val.match(/[A-D]/);
                    correct_option = match ? match[0] : val;
                }

                // 2. Lenient Difficulty
                let difficulty = 'medium';
                if (row.difficulty) {
                    const val = String(row.difficulty).trim().toLowerCase();
                    if (val.includes('easy')) difficulty = 'easy';
                    else if (val.includes('hard')) difficulty = 'hard';
                }

                // Ensure we have either text or image for the question and subject
                if (!row.subject) throw new Error("Subject is required");
                if (!row.text && !row.image_url) throw new Error("Question text or image is required");

                const options = [
                    { id: 1, text: row.option_a || null, image_url: row.option_a_image_url || null },
                    { id: 2, text: row.option_b || null, image_url: row.option_b_image_url || null },
                    { id: 3, text: row.option_c || null, image_url: row.option_c_image_url || null },
                    { id: 4, text: row.option_d || null, image_url: row.option_d_image_url || null }
                ];

                const correctMap: Record<string, number> = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };

                // Handle Subject
                let subjectId;
                const subjName = row.subject.trim();

                const subjectResult = await pool.query(
                    'SELECT id FROM subjects WHERE name = $1',
                    [subjName]
                );

                if (subjectResult.rows.length > 0) {
                    subjectId = subjectResult.rows[0].id;
                } else {
                    const newSubject = await pool.query(
                        'INSERT INTO subjects (name) VALUES ($1) RETURNING id',
                        [subjName]
                    );
                    subjectId = newSubject.rows[0].id;
                }

                const questionToSave = {
                    school_id: schoolId,
                    subject_id: subjectId,
                    subject_name: subjName,
                    text: row.text,
                    image_url: row.image_url,
                    options: JSON.stringify(options),
                    correct_option_id: correctMap[correct_option] || 1,
                    difficulty: difficulty,
                    unit: row.unit || null,
                    topic: row.topic || null,
                    tags: row.tags ? row.tags.split(',').map(t => t.trim()) : []
                };

                console.log(`[CONTROLLER] Mapping question ${index + 1}:`, {
                    text: questionToSave.text,
                    image_url: questionToSave.image_url,
                    has_options_images: options.some(o => !!o.image_url)
                });

                validatedQuestions.push(questionToSave);

            } catch (err: any) {
                log(`[CONTROLLER] VALIDATION FAIL Row ${index + 1}: ${err.message}`);
                console.error(`\n[VALIDATION FAIL] Row ${index + 1}:`);
                console.error(`  Error message:`, err.message);
                errors.push({ row: index + 1, error: err.message });
            }
        }

        const insertedIds: string[] = [];
        if (validatedQuestions.length > 0) {
            log(`[CONTROLLER] Inserting questions into database...`);
            for (const q of validatedQuestions) {
                const insertedQ = await pool.query(
                    `INSERT INTO questions 
                    (school_id, subject_id, text, image_url, options, correct_option_id, difficulty, unit, topic, tags)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id`,
                    [q.school_id, q.subject_id, q.text, q.image_url, q.options, q.correct_option_id, q.difficulty, q.unit, q.topic, q.tags]
                );
                insertedIds.push(insertedQ.rows[0].id);
            }
            log(`[CONTROLLER] Database insertion complete`);
        }

        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        const uniqueUnits = Array.from(new Set(validatedQuestions.map(q => q.unit).filter(Boolean)));

        res.json({
            message: `Imported ${validatedQuestions.length} questions.`,
            subject_id: validatedQuestions[0]?.subject_id,
            subject_name: validatedQuestions[0]?.subject_name,
            units: uniqueUnits,
            question_ids: insertedIds,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error: any) {
        log(`[CONTROLLER] FATAL ERROR: ${error.message}`);
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        console.error("Import Error:", error);
        res.status(500).json({ error: 'Import failed', details: error.message });
    }
};
export const getQuestions = async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        const result = await pool.query(
            `SELECT q.*, s.name as subject_name 
             FROM questions q
             LEFT JOIN subjects s ON q.subject_id = s.id
             WHERE q.school_id = $1
             ORDER BY q.created_at DESC`,
            [schoolId]
        );
        res.json(result.rows);
    } catch (error: any) {
        console.error('Get Questions Error:', error);
        res.status(500).json({ error: error.message });
    }
};
