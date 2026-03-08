-- ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE question_type AS ENUM ('mcq', 'numerical', 'true_false');

-- TABLES

CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subscription_status TEXT DEFAULT 'active', -- basic SaaS readiness
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL,
    class_id UUID, -- Null for admins/teachers
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id),
    name TEXT NOT NULL, -- e.g., "Grade 10-A"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL -- e.g., "Mathematics"
);

CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id), -- Questions belong to a school (or null for global system questions in future)
    subject_id UUID REFERENCES subjects(id),
    text TEXT NOT NULL,
    image_url TEXT, -- For diagrams
    options JSONB NOT NULL, -- [{"id": 1, "text": "A"}, ...]
    correct_option_id INT NOT NULL, 
    difficulty difficulty_level DEFAULT 'medium',
    unit TEXT, -- "Algebra", can be null
    topic TEXT, -- "Quadratics", can be null
    tags TEXT[], -- ["revision", "olympiad"]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id),
    teacher_id UUID REFERENCES users(id),
    title TEXT NOT NULL,
    duration_minutes INT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT false,
    config JSONB NOT NULL, -- Stores the logic: {"unit": "Algebra", "count": 20, "difficulty_distribution": {...}}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id),
    class_id UUID REFERENCES classes(id),
    UNIQUE(exam_id, class_id)
);

CREATE TABLE IF NOT EXISTS student_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id),
    student_id UUID REFERENCES users(id),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE, -- When they submitted
    score INT,
    total_questions INT,
    status TEXT DEFAULT 'in_progress', -- 'completed', 'timeout'
    suspicious_activity_count INT DEFAULT 0 -- Tab switches
);

CREATE TABLE IF NOT EXISTS responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID REFERENCES student_attempts(id),
    question_id UUID REFERENCES questions(id),
    selected_option_id INT,
    is_correct BOOLEAN
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_questions_tags ON questions USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_questions_unit ON questions(unit);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_questions_school_subject_diff_unit ON questions(school_id, subject_id, difficulty, unit);
CREATE INDEX IF NOT EXISTS idx_questions_school_id ON questions(school_id);
CREATE INDEX IF NOT EXISTS idx_exams_school_created ON exams(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exams_teacher_created ON exams(teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_attempts_student_exam_time ON student_attempts(student_id, exam_id, start_time DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_student_attempts_exam_student_time ON student_attempts(exam_id, student_id, start_time DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_student_attempts_exam_status ON student_attempts(exam_id, status);
CREATE INDEX IF NOT EXISTS idx_responses_attempt_id ON responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_responses_attempt_question ON responses(attempt_id, question_id);
