import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { env } from './env';

// Initialize Supabase Client
const supabaseUrl = env.SUPABASE_URL || '';
const supabaseKey = env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase URL or Key is missing. Image uploads will fail.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Uploads an image buffer to the Supabase 'exam-images' bucket.
 * 
 * @param buffer The image file buffer
 * @param mimeType The mime type of the image (e.g., 'image/png', 'image/jpeg')
 * @returns The public URL of the uploaded image
 */
export const uploadExamImage = async (buffer: Buffer, mimeType: string): Promise<string> => {
    try {
        const fileExtension = mimeType.split('/')[1] || 'png';
        const fileName = `${randomUUID()}.${fileExtension}`;

        const { data, error } = await supabase.storage
            .from('exam-images')
            .upload(fileName, buffer, {
                contentType: mimeType,
                upsert: false
            });

        if (error) {
            console.error("Supabase Upload Error:", error);
            throw new Error(`Failed to upload image to Supabase: ${error.message}`);
        }

        const { data: publicUrlData } = supabase.storage
            .from('exam-images')
            .getPublicUrl(fileName);

        console.log(`[STORAGE] Generated public URL for ${fileName}: ${publicUrlData.publicUrl}`);

        return publicUrlData.publicUrl;

    } catch (err: any) {
        console.error("Error in uploadExamImage:", err);
        throw err;
    }
};
