const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const run = async () => {
    if (!process.env.DATABASE_URL) {
        console.error("No DATABASE_URL found in .env");
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        console.log("Connecting to database...");

        // 1. Create School
        const schoolRes = await pool.query(`
            INSERT INTO schools (name) VALUES ('Universal Demo School') 
            RETURNING id, name
        `);
        const schoolId = schoolRes.rows[0].id;
        console.log(`Created School: ${schoolRes.rows[0].name}`);

        // 2. Hash Password synchronously
        const hash = bcrypt.hashSync('password123', 10);

        // 3. Create Users
        const users = [
            { email: 'admin@demo.com', role: 'admin', name: 'Super Admin' },
            { email: 'teacher@demo.com', role: 'teacher', name: 'Jane Teacher' },
            { email: 'student@demo.com', role: 'student', name: 'Jimmy Student' }
        ];

        for (const u of users) {
            try {
                await pool.query(`
                        INSERT INTO users (school_id, email, password_hash, full_name, role)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (email) 
                        DO UPDATE SET 
                            password_hash = EXCLUDED.password_hash,
                            full_name = EXCLUDED.full_name,
                            role = EXCLUDED.role;
                    `, [schoolId, u.email, hash, u.name, u.role]);
                console.log(`Synced ${u.role}: ${u.email}`);
            } catch (err) {
                console.error(`Failed to sync ${u.email}:`, err.message);
            }
        }
    } catch (err) {
        console.error("Seeding error:", err);
    } finally {
        await pool.end();
    }
};

run();
