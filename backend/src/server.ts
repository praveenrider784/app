import app from './app';
import { env } from './utils/env';
import { pool } from './config/db';

const PORT = env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${env.NODE_ENV} mode`);
});

const shutdown = async (signal: string) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
        try {
            await pool.end();
            console.log('Database pool closed.');
            process.exit(0);
        } catch (error) {
            console.error('Error while closing database pool:', error);
            process.exit(1);
        }
    });
};

process.on('SIGINT', () => {
    void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});
