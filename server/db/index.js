import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL chưa được set trong file .env");

// Cột DATE trả về chuỗi "YYYY-MM-DD", không đổi sang Date (tránh lệch múi giờ)
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
export const query = (text, params) => pool.query(text, params);

export const SALT_ROUNDS = 10;
export const newId = () => crypto.randomUUID().slice(0, 8);

// ---------- Đổi dòng SQL (snake_case) sang object trả cho client (camelCase như bản JSON cũ) ----------

export const publicUser = (r) => r && { id: r.id, name: r.name, email: r.email, role: r.role, createdAt: r.created_at };

export const toAssignment = (r) => r && {
  id: r.id,
  title: r.title,
  taskType: r.task_type,
  prompt: r.prompt,
  promptImage: r.prompt_image,
  dueDate: r.due_date,
  createdBy: r.created_by,
  createdAt: r.created_at,
};

export const toSubmission = (r) => r && {
  id: r.id,
  assignmentId: r.assignment_id,
  studentId: r.student_id,
  status: r.status,
  images: r.images,
  ocr: r.ocr,
  text: r.text,
  grade: r.grade,
  review: r.review,
  editedAfterOcr: r.edited_after_ocr,
  submittedAt: r.submitted_at,
};

export const toSpeaking = (r) => r && {
  id: r.id,
  studentId: r.student_id,
  part: r.part,
  question: r.question,
  transcript: r.transcript,
  metrics: r.metrics,
  grade: r.grade,
  createdAt: r.created_at,
};

// ---------- Khởi tạo: tạo bảng nếu chưa có, tạo admin từ .env ----------

export async function initDb() {
  await query(fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));

  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  const { rowCount } = await query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
  if (rowCount) return;
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const hash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
  await query(
    `INSERT INTO users (id, name, email, role, password_hash) VALUES ($1, 'Admin', $2, 'admin', $3)
     ON CONFLICT (email) DO UPDATE SET role = 'admin'`,
    [newId(), email, hash],
  );
  console.log(`Đã tạo tài khoản admin: ${email}`);
}
