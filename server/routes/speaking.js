import { Router } from "express";
import { db, save, newId } from "../db.js";
import { gradeSpeaking, friendlyError } from "../ai.js";
import { SPEAKING_QUESTIONS } from "../prompts/speaking.js";

// Luyện nói (Speaking)
const router = Router();

router.get("/questions", (_req, res) => res.json(SPEAKING_QUESTIONS));

router.get("/", (req, res) => {
  res.json(db.speaking.filter((x) => x.studentId === req.query.studentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

router.post("/grade", async (req, res) => {
  const { studentId, part, question, transcript, metrics } = req.body;
  if (!SPEAKING_QUESTIONS[part]) return res.status(400).json({ error: "Phần thi không hợp lệ." });
  const text = (transcript || "").trim();
  if (text.split(/\s+/).length < 5) return res.status(400).json({ error: "Câu trả lời quá ngắn để chấm (cần ít nhất vài câu)." });
  try {
    const grade = await gradeSpeaking({ part, question, transcript: text, metrics });
    const attempt = { id: newId(), studentId, part, question, transcript: text, metrics, grade, createdAt: new Date().toISOString() };
    db.speaking.push(attempt);
    save();
    res.json(attempt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: friendlyError(err) });
  }
});

export default router;
