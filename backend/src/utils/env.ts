import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default('5000'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().url().describe("PostgreSQL Connection String"),
    SUPABASE_URL: z.string().url(),
    SUPABASE_KEY: z.string().min(1),
    JWT_SECRET: z.string().min(10),
    REDIS_URL: z.string().optional()
});

export const env = envSchema.parse(process.env);
