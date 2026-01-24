import { createClient } from '@supabase/supabase-js';
import { env } from '../utils/env';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
    auth: {
        persistSession: false // Server-side usage
    }
});
