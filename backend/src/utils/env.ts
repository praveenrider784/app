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
    REDIS_URL: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
    REQUEST_TRACE: z.enum(['true', 'false']).default('false'),
    DB_POOL_MAX: z.string().default('30'),
    DB_POOL_MIN: z.string().default('5'),
    DB_IDLE_TIMEOUT_MS: z.string().default('30000'),
    DB_CONNECTION_TIMEOUT_MS: z.string().default('5000'),
    DB_MAX_USES: z.string().default('7500')
});

export const env = envSchema.parse(process.env);
