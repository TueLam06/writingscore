import { Router } from "express";
import { query, newId, toSpeaking } from "../db/index.js";
import { gradeSpeaking, friendlyError } from "../ai.js";
import { SPEAKING_QUESTIONS } from "../prompts/speaking.js";
import { ah } from "../middleware/async.js";

// Luyện nói (Speaking)
const router = Router();

router.get("/questions", (_req, res) => res.json(SPEAKING_QUESTIONS));

router.get("/", ah(async (req, res) => {
  const { rows } = await query("SELECT * FROM speaking_attempts WHERE student_id = $1 ORDER BY created_at DESC", [req.user.id]);
  res.json(rows.map(toSpeaking));
}));

router.post("/grade", ah(async (req, res) => {
  const { part, question, transcript, metrics } = req.body;
  if (!SPEAKING_QUESTIONS[part]) return res.status(400).json({ error: "Phần thi không hợp lệ." });
  const text = (transcript || "").trim();
  if (text.split(/\s+/).length < 5) return res.status(400).json({ error: "Câu trả lời quá ngắn để chấm (cần ít nhất vài câu)." });
  try {
    const grade = await gradeSpeaking({ part, question, transcript: text, metrics });
    const { rows } = await query(
      `INSERT INTO speaking_attempts (id, student_id, part, question, transcript, metrics, grade)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [newId(), req.user.id, part, question, text, JSON.stringify(metrics ?? null), JSON.stringify(grade)],
    );
    res.json(toSpeaking(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: friendlyError(err) });
  }
}));

export default router;
