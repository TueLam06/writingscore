import express from "express";
import { DEMO_MODE, PROVIDER, MODEL_CHAIN } from "./ai.js";
import { CLIENT_DIST, EVAL_DIR, UPLOAD_DIR } from "./paths.js";
import { initDb } from "./db/index.js";
import { verifyToken } from "./middleware/auth.js";
import auth from "./routes/auth.js";
import users from "./routes/users.js";
import assignments from "./routes/assignments.js";
import submissions from "./routes/submissions.js";
import speaking from "./routes/speaking.js";

const app = express();
app.set("trust proxy", "loopback");
app.use(express.json({ limit: "1mb" }));

// Giao diện React đã build (gồm cả trang speaking.html), ảnh đã tải lên, kết quả đo
// TODO: /uploads chưa kiểm tra đăng nhập (thẻ <img> không gửi được header Bearer)
app.use(express.static(CLIENT_DIST));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use("/eval", express.static(EVAL_DIR));

app.get("/api/meta", (_req, res) => res.json({ demo: DEMO_MODE, provider: PROVIDER, models: MODEL_CHAIN }));
app.use("/api/auth", auth);
app.use("/api/users", verifyToken, users);
app.use("/api/assignments", verifyToken, assignments);
app.use("/api/submissions", verifyToken, submissions);
app.use("/api/speaking", verifyToken, speaking);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "Ảnh quá lớn (tối đa 15MB)." });
  if (err.name === "MulterError") return res.status(400).json({ error: err.message });
  res.status(500).json({ error: "Lỗi server, vui lòng thử lại sau" });
});

const PORT = Number(process.env.PORT) || 3000;
await initDb();
app.listen(PORT, () => {
  console.log(`\n  Web đang chạy: http://localhost:${PORT}`);
  console.log(
    DEMO_MODE
      ? "  Chế độ DEMO (chưa có GEMINI_API_KEY / ANTHROPIC_API_KEY) — kết quả AI là dữ liệu mẫu.\n"
      : `  AI: ${MODEL_CHAIN.join(" → dự phòng ")}\n`,
  );
});
