import { Router } from "express";
import { query, newId, toSubmission, toAssignment } from "../db/index.js";
import { upload, saveImage, loadImage } from "../images.js";
import { transcribeHandwriting, gradeWriting, friendlyError } from "../ai.js";
import { isStaff, requireRole, requireStaff } from "../middleware/auth.js";
import { ah } from "../middleware/async.js";

const router = Router();
const json = (v) => (v == null ? null : JSON.stringify(v));

// Bài nộp của chính học viên đang đăng nhập; không phải thì trả lỗi và null
async function ownSub(req, res) {
  const { rows } = await query("SELECT * FROM submissions WHERE id = $1 AND student_id = $2", [req.params.id, req.user.id]);
  if (!rows[0]) {
    res.status(404).json({ error: "Không tìm thấy bài nộp." });
    return null;
  }
  return toSubmission(rows[0]);
}

router.get("/", ah(async (req, res) => {
  const studentId = isStaff(req.user) ? req.query.studentId || null : req.user.id;
  const { rows } = await query(
    `SELECT * FROM submissions
     WHERE ($1::text IS NULL OR assignment_id = $1) AND ($2::text IS NULL OR student_id = $2)`,
    [req.query.assignmentId || null, studentId],
  );
  res.json(rows.map(toSubmission));
}));

// Lấy hoặc tạo bài nộp nháp của học viên đang đăng nhập cho 1 bài tập
router.post("/", requireRole("student"), ah(async (req, res) => {
  const { assignmentId } = req.body;
  const exists = await query("SELECT 1 FROM assignments WHERE id = $1", [assignmentId]);
  if (!exists.rowCount) return res.status(404).json({ error: "Không tìm thấy bài tập." });
  await query(
    `INSERT INTO submissions (id, assignment_id, student_id) VALUES ($1, $2, $3)
     ON CONFLICT (assignment_id, student_id) DO NOTHING`,
    [newId(), assignmentId, req.user.id],
  );
  const { rows } = await query("SELECT * FROM submissions WHERE assignment_id = $1 AND student_id = $2", [assignmentId, req.user.id]);
  res.json(toSubmission(rows[0]));
}));

router.post("/:id/transcribe", requireRole("student"), upload.array("pages", 6), ah(async (req, res) => {
  const sub = await ownSub(req, res);
  if (!sub) return;
  if (sub.review) return res.status(400).json({ error: "Bài đã được giáo viên duyệt, không thể nộp lại." });
  if (!req.files?.length) return res.status(400).json({ error: "Chưa có ảnh nào (chỉ nhận JPG, PNG, WEBP)." });
  try {
    const names = await Promise.all(req.files.map(saveImage));
    const ocr = await transcribeHandwriting(names.map(loadImage));
    const { rows } = await query(
      `UPDATE submissions SET images = $2, ocr = $3, text = $4, status = 'transcribed', grade = NULL
       WHERE id = $1 RETURNING *`,
      [sub.id, json(names), json(ocr), ocr.transcript],
    );
    res.json(toSubmission(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: friendlyError(err) });
  }
}));

router.post("/:id/grade", requireRole("student"), ah(async (req, res) => {
  const sub = await ownSub(req, res);
  if (!sub) return;
  if (sub.review) return res.status(400).json({ error: "Bài đã được giáo viên duyệt, không thể nộp lại." });
  const text = (req.body.text || "").trim();
  if (text.length < 20) return res.status(400).json({ error: "Bài viết quá ngắn để chấm." });
  const assignment = toAssignment((await query("SELECT * FROM assignments WHERE id = $1", [sub.assignmentId])).rows[0]);
  try {
    const grade = await gradeWriting({
      taskType: assignment.taskType,
      prompt: assignment.prompt,
      promptImage: assignment.promptImage ? loadImage(assignment.promptImage) : null,
      text,
    });
    const { rows } = await query(
      `UPDATE submissions SET text = $2, grade = $3, status = 'graded', submitted_at = now(), edited_after_ocr = $4
       WHERE id = $1 RETURNING *`,
      [sub.id, text, json(grade), !!sub.ocr && sub.ocr.transcript.trim() !== text],
    );
    res.json(toSubmission(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: friendlyError(err) });
  }
}));

router.post("/:id/review", requireStaff, ah(async (req, res) => {
  const band = Number(req.body.band);
  if (!(band >= 0 && band <= 9 && band * 2 === Math.round(band * 2))) {
    return res.status(400).json({ error: "Band phải từ 0 đến 9, bước 0.5." });
  }
  const review = { band, comment: (req.body.comment || "").trim(), reviewedAt: new Date().toISOString(), reviewedBy: req.user.id };
  const { rows } = await query(
    "UPDATE submissions SET review = $2, status = 'reviewed' WHERE id = $1 AND grade IS NOT NULL RETURNING *",
    [req.params.id, json(review)],
  );
  if (!rows[0]) return res.status(400).json({ error: "Bài chưa được chấm." });
  res.json(toSubmission(rows[0]));
}));

export default router;
