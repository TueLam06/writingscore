// Chép dữ liệu từ data/db.json sang Postgres. Chạy lại nhiều lần không bị trùng (ON CONFLICT DO NOTHING).
// Dùng: npm run db:migrate-json
import fs from "node:fs";
import pg from "pg";
import bcrypt from "bcryptjs";
import { DB_FILE } from "../server/paths.js";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL chưa được set trong file .env");
if (!fs.existsSync(DB_FILE)) throw new Error(`Không tìm thấy ${DB_FILE}`);

const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
const client = new pg.Client({ connectionString: url });
await client.connect();

const json = (v) => (v == null ? null : JSON.stringify(v));
const count = { users: 0, assignments: 0, submissions: 0, speaking: 0 };

try {
  await client.query(fs.readFileSync(new URL("../server/db/schema.sql", import.meta.url), "utf8"));
  await client.query("BEGIN");

  for (const u of data.users) {
    let hash = u.passwordHash;
    if (!hash) {
      if (!process.env.SEED_PASSWORD) throw new Error(`Người dùng ${u.name} chưa có mật khẩu: cần SEED_PASSWORD trong .env`);
      hash = bcrypt.hashSync(process.env.SEED_PASSWORD, 10);
    }
    const email = u.email || `${u.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}@writingscore.local`;
    const r = await client.query(
      `INSERT INTO users (id, name, email, role, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, now())) ON CONFLICT DO NOTHING`,
      [u.id, u.name, email, u.role, hash, u.createdAt],
    );
    count.users += r.rowCount;
  }

  for (const a of data.assignments) {
    const r = await client.query(
      `INSERT INTO assignments (id, title, task_type, prompt, prompt_image, due_date, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, now())) ON CONFLICT DO NOTHING`,
      [a.id, a.title, a.taskType, a.prompt, a.promptImage, a.dueDate || null, a.createdBy || null, a.createdAt],
    );
    count.assignments += r.rowCount;
  }

  for (const s of data.submissions) {
    const r = await client.query(
      `INSERT INTO submissions (id, assignment_id, student_id, status, images, ocr, text, grade, review, edited_after_ocr, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING`,
      [s.id, s.assignmentId, s.studentId, s.status, json(s.images || []), json(s.ocr), s.text || "", json(s.grade), json(s.review), !!s.editedAfterOcr, s.submittedAt || null],
    );
    count.submissions += r.rowCount;
  }

  for (const x of data.speaking || []) {
    const r = await client.query(
      `INSERT INTO speaking_attempts (id, student_id, part, question, transcript, metrics, grade, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
      [x.id, x.studentId, x.part, x.question, x.transcript, json(x.metrics), json(x.grade), x.createdAt],
    );
    count.speaking += r.rowCount;
  }

  await client.query("COMMIT");
  console.log("Đã chép sang Postgres (số dòng mới):", count);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  throw err;
} finally {
  await client.end();
}
