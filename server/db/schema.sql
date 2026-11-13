-- Chạy lại nhiều lần không sao (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    task_type VARCHAR(10) NOT NULL CHECK (task_type IN ('task1', 'task1gt', 'task2')),
    prompt TEXT NOT NULL,
    prompt_image TEXT,
    due_date DATE,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'transcribed', 'graded', 'reviewed')),
    images JSONB NOT NULL DEFAULT '[]',
    ocr JSONB,
    text TEXT NOT NULL DEFAULT '',
    grade JSONB,
    review JSONB,
    edited_after_ocr BOOLEAN NOT NULL DEFAULT false,
    submitted_at TIMESTAMPTZ,
    UNIQUE (assignment_id, student_id)
);
CREATE INDEX IF NOT EXISTS submissions_student_idx ON submissions (student_id);
CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions (status);

CREATE TABLE IF NOT EXISTS speaking_attempts (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    part TEXT NOT NULL,
    question TEXT NOT NULL,
    transcript TEXT NOT NULL,
    metrics JSONB,
    grade JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS speaking_student_idx ON speaking_attempts (student_id);
