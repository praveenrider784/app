import dotenv from 'dotenv';
dotenv.config();
import { pool } from '../config/db';
import bcrypt from 'bcryptjs';

const seed = async () => {
    try {
        console.log("Seeding database...");

        // 1. Create School
        const schoolResult = await pool.query(
            "INSERT INTO schools (name) VALUES ('Default School') RETURNING id"
        );
        const schoolId = schoolResult.rows[0].id;

        // 2. Hash Password synchronously
        const hash = bcrypt.hashSync('password123', 10);

        // 3. Create Teacher
        await pool.query(
            `INSERT INTO users (school_id, email, password_hash, full_name, role)
             VALUES ($1, $2, $3, $4, $5)`,
            [schoolId, 'teacher@demo.com', hash, 'Teacher One', 'teacher']
        );
        console.log("Teacher created: teacher@demo.com / password123");

        // 4. Create Student
        await pool.query(
            `INSERT INTO users (school_id, email, password_hash, full_name, role)
             VALUES ($1, $2, $3, $4, $5)`,
            [schoolId, 'student@demo.com', hash, 'Student One', 'student']
        );
        console.log("Student created: student@demo.com / password123");

        console.log("Seeding completed successfully");
    } catch (error) {
        console.error("Seeding error:", error);
    } finally {
        await pool.end();
    }
};

seed();
