import { Router } from "express";
import { db, save, newId } from "../db.js";
import { upload, saveImage, loadImage } from "../images.js";
import { transcribeHandwriting, gradeWriting, friendlyError } from "../ai.js";

const router = Router();
const findSub = (id) => db.submissions.find((s) => s.id === id);

router.get("/", (req, res) => {
  const { assignmentId, studentId } = req.query;
  res.json(
    db.submissions.filter(
      (s) => (!assignmentId || s.assignmentId === assignmentId) && (!studentId || s.studentId === studentId),
    ),
  );
});

// Lấy hoặc tạo bài nộp nháp của 1 học viên cho 1 bài tập
router.post("/", (req, res) => {
  const { assignmentId, studentId } = req.body;
  if (!db.assignments.some((a) => a.id === assignmentId)) return res.status(404).json({ error: "Không tìm thấy bài tập." });
  let sub = db.submissions.find((s) => s.assignmentId === assignmentId && s.studentId === studentId);
  if (!sub) {
    sub = { id: newId(), assignmentId, studentId, status: "draft", images: [], ocr: null, text: "", grade: null, review: null };
    db.submissions.push(sub);
    save();
  }
  res.json(sub);
});

router.post("/:id/transcribe", upload.array("pages", 6), async (req, res) => {
  const sub = findSub(req.params.id);
  if (!sub) return res.status(404).json({ error: "Không tìm thấy bài nộp." });
  if (sub.review) return res.status(400).json({ error: "Bài đã được giáo viên duyệt, không thể nộp lại." });
  if (!req.files?.length) return res.status(400).json({ error: "Chưa có ảnh nào (chỉ nhận JPG, PNG, WEBP)." });
  try {
    const names = await Promise.all(req.files.map(saveImage));
    const ocr = await transcribeHandwriting(names.map(loadImage));
    Object.assign(sub, { images: names, ocr, text: ocr.transcript, status: "transcribed", grade: null });
    save();
    res.json(sub);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: friendlyError(err) });
  }
});

router.post("/:id/grade", async (req, res) => {
  const sub = findSub(req.params.id);
  if (!sub) return res.status(404).json({ error: "Không tìm thấy bài nộp." });
  if (sub.review) return res.status(400).json({ error: "Bài đã được giáo viên duyệt, không thể nộp lại." });
  const text = (req.body.text || "").trim();
  if (text.length < 20) return res.status(400).json({ error: "Bài viết quá ngắn để chấm." });
  const assignment = db.assignments.find((a) => a.id === sub.assignmentId);
  try {
    const grade = await gradeWriting({
      taskType: assignment.taskType,
      prompt: assignment.prompt,
      promptImage: assignment.promptImage ? loadImage(assignment.promptImage) : null,
      text,
    });
    Object.assign(sub, {
      text,
      grade,
      status: "graded",
      submittedAt: new Date().toISOString(),
      editedAfterOcr: !!sub.ocr && sub.ocr.transcript.trim() !== text,
    });
    save();
    res.json(sub);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: friendlyError(err) });
  }
});

router.post("/:id/review", (req, res) => {
  const sub = findSub(req.params.id);
  if (!sub?.grade) return res.status(400).json({ error: "Bài chưa được chấm." });
  const band = Number(req.body.band);
  if (!(band >= 0 && band <= 9 && band * 2 === Math.round(band * 2))) {
    return res.status(400).json({ error: "Band phải từ 0 đến 9, bước 0.5." });
  }
  sub.review = { band, comment: (req.body.comment || "").trim(), reviewedAt: new Date().toISOString() };
  sub.status = "reviewed";
  save();
  res.json(sub);
});

export default router;
