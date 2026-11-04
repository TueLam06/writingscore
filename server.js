import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import heicConvert from "heic-convert";
import { createCanvas, loadImage as decodeImage } from "@napi-rs/canvas";
import { DEMO_MODE, PROVIDER, MODEL_CHAIN, transcribeHandwriting, gradeWriting, gradeSpeaking, friendlyError } from "./ai.js";
import { SPEAKING_QUESTIONS } from "./prompts/speaking.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(here, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- "Cơ sở dữ liệu" JSON đơn giản ----------

const SEED = {
  users: [
    { id: "t1", name: "GV1", role: "teacher" },
    { id: "s1", name: "HS1", role: "student" },
    { id: "s2", name: "HS2", role: "student" },
    { id: "s3", name: "HS3", role: "student" },
  ],
  assignments: [
    {
      id: "a1",
      title: "Task 2 – Technology",
      taskType: "task2",
      prompt:
        "Some people believe that technology has made our lives easier, while others think it has made life more complicated. Discuss both views and give your own opinion.\n\nWrite at least 250 words.",
      promptImage: null,
      dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    },
  ],
  submissions: [],
};

const db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf8")) : structuredClone(SEED);
db.speaking ??= [];
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
save();

const newId = () => crypto.randomUUID().slice(0, 8);
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
const isHeic = (file) => /hei[cf]/i.test(file.mimetype) || /\.hei[cf]$/i.test(file.originalname);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 6 },
  // Windows thường không nhận ra kiểu của file .heic (mimetype rỗng) → kiểm tra cả đuôi file
  fileFilter: (_req, file, cb) => cb(null, IMAGE_TYPES.includes(file.mimetype) || isHeic(file)),
});

// Chuẩn hoá mọi ảnh (kể cả HEIC từ iPhone) thành JPEG, cạnh dài tối đa 2000px
async function saveImage(file) {
  let buf = file.buffer;
  if (isHeic(file)) buf = Buffer.from(await heicConvert({ buffer: buf, format: "JPEG", quality: 0.9 }));
  const img = await decodeImage(buf);
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
  const canvas = createCanvas(Math.round(img.width * scale), Math.round(img.height * scale));
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  const name = `${newId()}.jpg`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), await canvas.encode("jpeg", 88));
  return name;
}

function loadImage(name) {
  const ext = path.extname(name).slice(1);
  const mediaType = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" }[ext];
  return { mediaType, base64: fs.readFileSync(path.join(UPLOAD_DIR, name)).toString("base64") };
}

// ---------- App ----------

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(here, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use("/eval", express.static(path.join(here, "eval"))); // trang so sánh OCR, kết quả đánh giá

app.get("/api/meta", (_req, res) => res.json({ demo: DEMO_MODE, provider: PROVIDER, models: MODEL_CHAIN, users: db.users }));

app.get("/api/assignments", (_req, res) => {
  res.json([...db.assignments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

app.post("/api/assignments", upload.single("promptImage"), async (req, res) => {
  const { title, taskType, prompt, dueDate } = req.body;
  if (!title?.trim() || !prompt?.trim()) return res.status(400).json({ error: "Cần nhập tiêu đề và đề bài." });
  const assignment = {
    id: newId(),
    title: title.trim(),
    taskType: ["task1", "task1gt"].includes(taskType) ? taskType : "task2",
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
app.put("/api/assignments/:id", upload.single("promptImage"), async (req, res) => {
  const a = db.assignments.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: "Không tìm thấy bài tập." });
  const { title, taskType, prompt, dueDate, removeImage } = req.body;
  if (!title?.trim() || !prompt?.trim()) return res.status(400).json({ error: "Cần nhập tiêu đề và đề bài." });
  Object.assign(a, {
    title: title.trim(),
    taskType: ["task1", "task1gt"].includes(taskType) ? taskType : "task2",
    prompt: prompt.trim(),
    dueDate: dueDate || null,
  });
  if (req.file) a.promptImage = await saveImage(req.file);
  else if (removeImage === "1") a.promptImage = null;
  save();
  res.json(a);
});

app.delete("/api/assignments/:id", (req, res) => {
  db.assignments = db.assignments.filter((a) => a.id !== req.params.id);
  db.submissions = db.submissions.filter((s) => s.assignmentId !== req.params.id);
  save();
  res.json({ ok: true });
});

app.get("/api/submissions", (req, res) => {
  const { assignmentId, studentId } = req.query;
  res.json(
    db.submissions.filter(
      (s) => (!assignmentId || s.assignmentId === assignmentId) && (!studentId || s.studentId === studentId),
    ),
  );
});

// Lấy hoặc tạo bài nộp nháp của 1 học viên cho 1 bài tập
app.post("/api/submissions", (req, res) => {
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

const findSub = (id) => db.submissions.find((s) => s.id === id);

app.post("/api/submissions/:id/transcribe", upload.array("pages", 6), async (req, res) => {
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

app.post("/api/submissions/:id/grade", async (req, res) => {
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

app.post("/api/submissions/:id/review", (req, res) => {
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

// ---------- Luyện nói (Speaking) ----------

app.get("/api/speaking/questions", (_req, res) => res.json(SPEAKING_QUESTIONS));

app.get("/api/speaking", (req, res) => {
  res.json(db.speaking.filter((x) => x.studentId === req.query.studentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

app.post("/api/speaking/grade", async (req, res) => {
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

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "Ảnh quá lớn (tối đa 8MB)." : err.message });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`\n  Web đang chạy: http://localhost:${PORT}`);
  console.log(
    DEMO_MODE
      ? "  Chế độ DEMO (chưa có GEMINI_API_KEY / ANTHROPIC_API_KEY) — kết quả AI là dữ liệu mẫu.\n"
      : `  AI: ${MODEL_CHAIN.join(" → dự phòng ")}\n`,
  );
});
