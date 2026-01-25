import { Request, Response } from 'express';
import { pool } from '../config/db';
import * as XLSX from 'xlsx';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

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

    try {
        const workbook = XLSX.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData: any[] = XLSX.utils.sheet_to_json(sheet);

        const validatedQuestions = [];
        const errors = [];

        for (const [index, row] of rawData.entries()) {
            const normalizedRow: any = {};

            Object.keys(row).forEach(key => {
                const mappedKey = findMappedKey(key);
                normalizedRow[mappedKey] = row[key];
            });

            try {
                // 1. Lenient Correct Option (Find A-D or 1-4)
                if (normalizedRow.correct_option !== undefined && normalizedRow.correct_option !== null) {
                    let val = String(normalizedRow.correct_option).trim().toUpperCase();
                    // Map 1->A, 2->B, etc. if it's a single digit
                    if (/^[1-4]$/.test(val)) {
                        const map: Record<string, string> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
                        val = map[val];
                    }
                    const match = val.match(/[A-D]/);
                    normalizedRow.correct_option = match ? match[0] : val;
                }

                // 2. Lenient Difficulty (Map variations to easy, medium, hard)
                if (normalizedRow.difficulty) {
                    const val = String(normalizedRow.difficulty).trim().toLowerCase();
                    if (val.includes('easy')) normalizedRow.difficulty = 'easy';
                    else if (val.includes('hard')) normalizedRow.difficulty = 'hard';
                    else if (val.includes('med')) normalizedRow.difficulty = 'medium';
                    else normalizedRow.difficulty = 'medium'; // Default to medium
                } else {
                    normalizedRow.difficulty = 'medium'; // Default
                }

                // 3. Force string conversion for all expected string fields to prevent Zod type errors
                ['text', 'option_a', 'option_b', 'option_c', 'option_d', 'subject', 'unit', 'topic', 'tags'].forEach(key => {
                    const val = normalizedRow[key];
                    if (val !== undefined && val !== null) {
                        const strVal = String(val).trim();
                        normalizedRow[key] = strVal || null; // Convert empty strings to null
                    }
                });

                const parsed = QuestionRowSchema.parse(normalizedRow);

                const options = [
                    { id: 1, text: parsed.option_a },
                    { id: 2, text: parsed.option_b },
                    { id: 3, text: parsed.option_c },
                    { id: 4, text: parsed.option_d }
                ];
                const correctMap: Record<string, number> = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };

                // Handle Subject
                let subjectId;
                const subjName = String(parsed.subject || '').trim();
                if (!subjName) throw new Error("Subject is required");

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

                validatedQuestions.push({
                    school_id: schoolId,
                    subject_id: subjectId,
                    subject_name: subjName,
                    text: parsed.text,
                    options: JSON.stringify(options),
                    correct_option_id: correctMap[parsed.correct_option],
                    difficulty: parsed.difficulty,
                    unit: parsed.unit && parsed.unit.trim() !== '' ? parsed.unit.trim() : null,
                    topic: parsed.topic || null,
                    tags: parsed.tags ? parsed.tags.toString().split(',').map(t => t.trim()) : []
                });

            } catch (err: any) {
                console.error(`\n[VALIDATION FAIL] Row ${index + 2}:`);
                console.error(`  Raw keys:`, Object.keys(row).join(', '));
                console.error(`  Parsed data:`, JSON.stringify(normalizedRow, null, 2));

                let message = 'Validation failed';
                if (err instanceof z.ZodError) {
                    message = err.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
                } else {
                    message = err.message || message;
                }
                console.error(`  Error message:`, message);
                errors.push({ row: index + 2, error: message });
            }
        }

        if (validatedQuestions.length > 0) {
            for (const q of validatedQuestions) {
                await pool.query(
                    `INSERT INTO questions 
                    (school_id, subject_id, text, options, correct_option_id, difficulty, unit, topic, tags)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [q.school_id, q.subject_id, q.text, q.options, q.correct_option_id, q.difficulty, q.unit, q.topic, q.tags]
                );
            }
        }

        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        res.json({
            message: `Imported ${validatedQuestions.length} questions.`,
            subject_id: validatedQuestions[0]?.subject_id,
            subject_name: validatedQuestions[0]?.subject_name,
            unit: validatedQuestions[0]?.unit,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error: any) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
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
