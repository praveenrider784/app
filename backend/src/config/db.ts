import { Pool } from 'pg';
import { env } from '../utils/env';

export const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: Number(env.DB_POOL_MAX) || 30,
    min: Number(env.DB_POOL_MIN) || 5,
    idleTimeoutMillis: Number(env.DB_IDLE_TIMEOUT_MS) || 30000,
    connectionTimeoutMillis: Number(env.DB_CONNECTION_TIMEOUT_MS) || 5000,
    maxUses: Number(env.DB_MAX_USES) || 7500
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
