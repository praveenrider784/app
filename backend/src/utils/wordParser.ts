import mammoth from 'mammoth';
import { uploadExamImage } from './supabaseStorage';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'exam_debug.log');
const log = (msg: string) => fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);

export interface ParsedQuestionRow {
    subject: string | null;
    unit: string | null;
    topic: string | null;
    difficulty: string | null;
    tags: string | null;
    text: string | null;
    image_url: string | null;
    option_a: string | null;
    option_a_image_url: string | null;
    option_b: string | null;
    option_b_image_url: string | null;
    option_c: string | null;
    option_c_image_url: string | null;
    option_d: string | null;
    option_d_image_url: string | null;
    correct_option: string | null;
}

export const parseWordDocument = async (filePath: string): Promise<ParsedQuestionRow[]> => {
    // 1. Read the document using mammoth, injecting image HTML markers
    // We will convert it to an intermediate HTML representation so we can parse out the table structure
    const options = {
        convertImage: (mammoth.images as any).inline(function (element: any) {
            return element.read("base64").then(function (imageBuffer: string) {
                return {
                    src: `data:${element.contentType};base64,${imageBuffer}`
                };
            });
        })
    };

    const result = await mammoth.convertToHtml({ path: filePath }, options);
    const html = result.value;
    fs.writeFileSync(path.join(process.cwd(), 'mammoth_dump.html'), html);
    log(`[PARSER] mammoth HTML dumped to mammoth_dump.html, length: ${html.length}`);

    // 2. Parse the generated HTML Table
    const rows: ParsedQuestionRow[] = [];

    // Basic HTML table parsing
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const tdRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    const imgRegex = /<img[^>]+src="([^"]+)"/i;
    const textRegex = /<[^>]+>|&nbsp;/g; // Remove all tags to get pure text

    let isFirstRow = true;
    let tableHeaders: string[] = [];

    let trMatch;
    while ((trMatch = trRegex.exec(html)) !== null) {
        const trHtml = trMatch[1];

        const cells: { text: string, imgBase64: string | null }[] = [];
        let tdMatch;
        while ((tdMatch = tdRegex.exec(trHtml)) !== null) {
            const tdHtml = tdMatch[1];

            // Extract image if exists
            let imgBase64 = null;
            const imgMatch = imgRegex.exec(tdHtml);
            if (imgMatch) {
                imgBase64 = imgMatch[1]; // data:image/png;base64,...
            }

            // Extract text and clean it
            const rawText = tdHtml.replace(textRegex, ' ').trim();
            // Replace multiple spaces with single - Fixed regex here: \s+ instead of \\s+
            const cleanText = rawText.replace(/\s+/g, ' ');

            cells.push({ text: cleanText, imgBase64 });
        }

        if (cells.length === 0) continue;

        if (isFirstRow) {
            // Map headers
            tableHeaders = cells.map(c => c.text.toLowerCase().replace(/[^a-z0-9]/g, ''));
            log(`[PARSER] Detected headers: ${tableHeaders.join(', ')}`);
            isFirstRow = false;
            continue;
        }

        // It's a data row
        log(`[PARSER] Processing row with ${cells.length} cells`);
        const rowData: any = {};
        for (let i = 0; i < cells.length; i++) {
            if (i < tableHeaders.length) {
                const header = tableHeaders[i];
                rowData[header] = cells[i];
            }
        }

        // Helper to find column by keyword
        const getCol = (keywords: string[]) => {
            for (const key of Object.keys(rowData)) {
                if (keywords.some(kw => key.includes(kw))) {
                    return rowData[key];
                }
            }
            return { text: '', imgBase64: null };
        };

        const subjectCell = getCol(['subject']);
        const unitCell = getCol(['unit', 'chapter', 'module']);
        const topicCell = getCol(['topic']);
        const diffCell = getCol(['diff']);
        const tagCell = getCol(['tag']);

        const qTextCell = getCol(['text', 'question', 'quest']);

        const getOptCol = (char: string) => {
            for (const key of Object.keys(rowData)) {
                if (key === `option${char}` || key === char || key === `opt${char}`) {
                    return rowData[key];
                }
            }
            return { text: '', imgBase64: null };
        };

        const optACell = getOptCol('a');
        const optBCell = getOptCol('b');
        const optCCell = getOptCol('c');
        const optDCell = getOptCol('d');

        const correctCell = getCol(['correct', 'ans']);

        // Upload images if they exist
        const helperUpload = async (cell: { text: string, imgBase64: string | null }, label: string) => {
            if (!cell.imgBase64) {
                log(`[PARSER] No image for ${label}`);
                return null;
            }
            try {
                log(`[PARSER] Found image for ${label}, base64 length: ${cell.imgBase64.length}`);
                const parts = cell.imgBase64.split(',');
                if (parts.length !== 2) {
                    log(`[PARSER] Invalid base64 parts for ${label}`);
                    return null;
                }

                const mimeMatch = parts[0].match(/:(.*?);/);
                const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

                const buffer = Buffer.from(parts[1], 'base64');
                const url = await uploadExamImage(buffer, mimeType);
                log(`[PARSER] Upload success for ${label}: ${url}`);
                return url;
            } catch (err: any) {
                log(`[PARSER] Failed to upload image for ${label}: ${err.message}`);
                return null;
            }
        };

        if (qTextCell.text || qTextCell.imgBase64) {
            const rowObj: ParsedQuestionRow = {
                subject: subjectCell.text || null,
                unit: unitCell.text || null,
                topic: topicCell.text || null,
                difficulty: diffCell.text || 'medium',
                tags: tagCell.text || null,

                text: qTextCell.text || null,
                image_url: await helperUpload(qTextCell, 'Question'),

                option_a: optACell.text || null,
                option_a_image_url: await helperUpload(optACell, 'Opt A'),

                option_b: optBCell.text || null,
                option_b_image_url: await helperUpload(optBCell, 'Opt B'),

                option_c: optCCell.text || null,
                option_c_image_url: await helperUpload(optCCell, 'Opt C'),

                option_d: optDCell.text || null,
                option_d_image_url: await helperUpload(optDCell, 'Opt D'),

                correct_option: correctCell.text || null
            };

            rows.push(rowObj);
        }
    }

    return rows;
};
