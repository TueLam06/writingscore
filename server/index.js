import express from "express";
import { DEMO_MODE, PROVIDER, MODEL_CHAIN } from "./ai.js";
import { db } from "./db.js";
import { CLIENT_DIST, EVAL_DIR, UPLOAD_DIR } from "./paths.js";
import assignments from "./routes/assignments.js";
import submissions from "./routes/submissions.js";
import speaking from "./routes/speaking.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

// Giao diện React đã build (gồm cả trang speaking.html), ảnh đã tải lên, kết quả đo
app.use(express.static(CLIENT_DIST));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use("/eval", express.static(EVAL_DIR));

app.get("/api/meta", (_req, res) => res.json({ demo: DEMO_MODE, provider: PROVIDER, models: MODEL_CHAIN, users: db.users }));
app.use("/api/assignments", assignments);
app.use("/api/submissions", submissions);
app.use("/api/speaking", speaking);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "Ảnh quá lớn (tối đa 15MB)." : err.message });
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
