import { Router } from "express";
import { query, newId, toAssignment } from "../db/index.js";
import { upload, saveImage } from "../images.js";
import { requireStaff } from "../middleware/auth.js";
import { ah } from "../middleware/async.js";

const router = Router();
const taskTypeOf = (t) => (["task1", "task1gt"].includes(t) ? t : "task2");

router.get("/", ah(async (_req, res) => {
  const { rows } = await query("SELECT * FROM assignments ORDER BY created_at DESC");
  res.json(rows.map(toAssignment));
}));

router.post("/", requireStaff, upload.single("promptImage"), ah(async (req, res) => {
  const { title, taskType, prompt, dueDate } = req.body;
  if (!title?.trim() || !prompt?.trim()) return res.status(400).json({ error: "Cần nhập tiêu đề và đề bài." });
  const image = req.file ? await saveImage(req.file) : null;
  const { rows } = await query(
    `INSERT INTO assignments (id, title, task_type, prompt, prompt_image, due_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [newId(), title.trim(), taskTypeOf(taskType), prompt.trim(), image, dueDate || null, req.user.id],
  );
  res.json(toAssignment(rows[0]));
}));

// Sửa bài tập: đổi tiêu đề, loại bài, đề, hạn nộp; thay hoặc bỏ ảnh đề
router.put("/:id", requireStaff, upload.single("promptImage"), ah(async (req, res) => {
  const { title, taskType, prompt, dueDate, removeImage } = req.body;
  if (!title?.trim() || !prompt?.trim()) return res.status(400).json({ error: "Cần nhập tiêu đề và đề bài." });
  const image = req.file ? await saveImage(req.file) : undefined;
  const { rows } = await query(
    `UPDATE assignments SET title = $2, task_type = $3, prompt = $4, due_date = $5,
       prompt_image = CASE WHEN $6::boolean THEN $7 ELSE prompt_image END
     WHERE id = $1 RETURNING *`,
    [req.params.id, title.trim(), taskTypeOf(taskType), prompt.trim(), dueDate || null, image !== undefined || removeImage === "1", image ?? null],
  );
  if (!rows[0]) return res.status(404).json({ error: "Không tìm thấy bài tập." });
  res.json(toAssignment(rows[0]));
}));

router.delete("/:id", requireStaff, ah(async (req, res) => {
  await query("DELETE FROM assignments WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

export default router;
