import { Router } from "express";
import { db, save, newId } from "../db.js";
import { upload, saveImage } from "../images.js";

const router = Router();
const taskTypeOf = (t) => (["task1", "task1gt"].includes(t) ? t : "task2");

router.get("/", (_req, res) => {
  res.json([...db.assignments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

router.post("/", upload.single("promptImage"), async (req, res) => {
  const { title, taskType, prompt, dueDate } = req.body;
  if (!title?.trim() || !prompt?.trim()) return res.status(400).json({ error: "Cần nhập tiêu đề và đề bài." });
  const assignment = {
    id: newId(),
    title: title.trim(),
    taskType: taskTypeOf(taskType),
    prompt: prompt.trim(),
    promptImage: req.file ? await saveImage(req.file) : null,
    dueDate: dueDate || null,
    createdAt: new Date().toISOString(),
  };
  db.assignments.push(assignment);
  save();
  res.json(assignment);
});

// Sửa bài tập: đổi tiêu đề, loại bài, đề, hạn nộp; thay hoặc bỏ ảnh đề
router.put("/:id", upload.single("promptImage"), async (req, res) => {
  const a = db.assignments.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: "Không tìm thấy bài tập." });
  const { title, taskType, prompt, dueDate, removeImage } = req.body;
  if (!title?.trim() || !prompt?.trim()) return res.status(400).json({ error: "Cần nhập tiêu đề và đề bài." });
  Object.assign(a, {
    title: title.trim(),
    taskType: taskTypeOf(taskType),
    prompt: prompt.trim(),
    dueDate: dueDate || null,
  });
  if (req.file) a.promptImage = await saveImage(req.file);
  else if (removeImage === "1") a.promptImage = null;
  save();
  res.json(a);
});

router.delete("/:id", (req, res) => {
  db.assignments = db.assignments.filter((a) => a.id !== req.params.id);
  db.submissions = db.submissions.filter((s) => s.assignmentId !== req.params.id);
  save();
  res.json({ ok: true });
});

export default router;
