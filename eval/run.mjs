// Chấm thử các bài mẫu đã có band của giám khảo và đo độ lệch.
// Chạy:  node --env-file=.env eval/run.mjs
// Mỗi bài đi qua đúng quy trình của app: AI đọc ảnh viết tay → AI chấm.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROVIDER, MODEL_NAME, usage, transcribeHandwriting, gradeWriting, friendlyError } from "../server/ai.js";

// Giá USD / 1 triệu token (đầu vào, đầu ra)
const PRICE = { "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5] };

const here = path.dirname(fileURLToPath(import.meta.url));
const { prompts, samples } = JSON.parse(fs.readFileSync(path.join(here, "samples.json"), "utf8"));
const only = process.argv[2]?.split(","); // vd: node eval/run.mjs 2A-A,2A-C  (chỉ chạy các bài này) | task1 | task2
// Bộ Task 1 do giáo viên chấm (có ảnh biểu đồ, band từng tiêu chí) — file riêng, không đưa lên Git
// Mỗi thư mục con của eval/teacher/ có thể chứa 1 file *-task1.json: { essays: [{ id, taskType, prompt, image, text, bands, overall }] }
const TEACHER = path.join(here, "teacher");
for (const dir of fs.existsSync(TEACHER) ? fs.readdirSync(TEACHER, { withFileTypes: true }).filter((d) => d.isDirectory()) : []) {
  for (const f of fs.readdirSync(path.join(TEACHER, dir.name)).filter((f) => f.endsWith("-task1.json"))) {
    for (const e of JSON.parse(fs.readFileSync(path.join(TEACHER, dir.name, f), "utf8")).essays) {
      prompts[e.id] = e.prompt;
      samples.push({ id: e.id, task: e.id, taskType: e.taskType, typed: `../teacher/${dir.name}/${e.text}`, image: `teacher/${dir.name}/${e.image}`, examinerBand: e.overall, examinerCriteria: [e.bands.task, e.bands.coherence, e.bands.lexical, e.bands.grammar] });
    }
  }
}
const pickSet = (x) => !only || only.includes(x.id) || only.includes(x.taskType ?? "task2");

if (PROVIDER === "demo") {
  console.error("Chưa có API key trong .env → không chấm thật được.");
  process.exit(1);
}
console.log(`AI: ${PROVIDER} (${MODEL_NAME})\n`);

const results = [];
for (const s of samples.filter(pickSet)) {
  const t0 = Date.now();
  process.stdout.write(`${s.id} … `);
  try {
    // Bài đánh máy (typed) → bỏ qua bước đọc chữ
    const ocr = s.typed
      ? { transcript: fs.readFileSync(path.join(here, "typed", s.typed), "utf8"), legibility: "typed" }
      : await transcribeHandwriting(
          s.pages.map((p) => ({ mediaType: "image/jpeg", base64: fs.readFileSync(path.join(here, "samples", p)).toString("base64") })),
        );
    const promptImage = s.image ? { mediaType: s.image.endsWith(".png") ? "image/png" : "image/jpeg", base64: fs.readFileSync(path.join(here, s.image)).toString("base64") } : null;
    const g = await gradeWriting({ taskType: s.taskType ?? "task2", prompt: prompts[s.task], promptImage, text: ocr.transcript });
    const r = {
      id: s.id,
      examiner: s.examinerBand,
      ai: g.overall_band,
      diff: +(g.overall_band - s.examinerBand).toFixed(1),
      criteria: [g.task.band, g.coherence.band, g.lexical.band, g.grammar.band],
      examinerCriteria: s.examinerCriteria,
      ranges: ["task", "coherence", "lexical", "grammar"].map((k) => g[k].range?.join("–")),
      clamped: ["task", "coherence", "lexical", "grammar"].filter((k) => g[k].ai_band != null && g[k].ai_band !== g[k].band),
      words: g.word_count,
      legibility: ocr.legibility,
      seconds: Math.round((Date.now() - t0) / 1000),
      transcript: ocr.transcript,
      grade: g,
    };
    results.push(r);
    console.log(`giám khảo ${r.examiner}${s.examinerCriteria ? ` (${s.examinerCriteria.join("/")})` : ""} | AI ${r.ai} (${r.criteria.join("/")}) | khung ${g.band_range?.join("–")} [${r.ranges.join(" ")}]${r.clamped.length ? ` (kéo vào khung: ${r.clamped.join(",")})` : ""} | lệch ${r.diff > 0 ? "+" : ""}${r.diff} | ${r.words} từ | ${r.seconds}s`);
  } catch (err) {
    console.log(`LỖI: ${friendlyError(err)}`);
    results.push({ id: s.id, examiner: s.examinerBand, error: friendlyError(err) });
  }
}

const ok = results.filter((r) => r.ai != null);
if (ok.length) {
  const mae = ok.reduce((a, r) => a + Math.abs(r.diff), 0) / ok.length;
  const bias = ok.reduce((a, r) => a + r.diff, 0) / ok.length;
  const within05 = ok.filter((r) => Math.abs(r.diff) <= 0.5).length;
  console.log(`\nSố bài chấm được: ${ok.length}/${results.length}`);
  console.log(`Lệch trung bình (tuyệt đối): ${mae.toFixed(2)} band`);
  console.log(`Xu hướng: ${bias > 0 ? "chấm CAO hơn" : bias < 0 ? "chấm THẤP hơn" : "không lệch về phía nào"} ${Math.abs(bias).toFixed(2)} band`);
  console.log(`Lệch ≤ 0.5 band: ${within05}/${ok.length} bài`);
  const withCrit = ok.filter((r) => r.examinerCriteria);
  if (withCrit.length) {
    const names = ["TA/TR", "CC", "LR", "GRA"];
    console.log(`Theo tiêu chí (${withCrit.length} bài có band từng tiêu chí): ` + names.map((n, i) => {
      const d = withCrit.map((r) => r.criteria[i] - r.examinerCriteria[i]);
      return `${n} lệch TB ${(d.reduce((a, x) => a + Math.abs(x), 0) / d.length).toFixed(2)} (xu hướng ${(d.reduce((a, x) => a + x, 0) / d.length >= 0 ? "+" : "")}${(d.reduce((a, x) => a + x, 0) / d.length).toFixed(2)})`;
    }).join(" | "));
  }
}
let totalUsd = 0;
for (const [m, u] of Object.entries(usage)) {
  const [pi, po] = PRICE[m] ?? [0, 0];
  const usd = (u.input * pi + u.output * po) / 1e6;
  totalUsd += usd;
  console.log(`${m}: ${u.input} token vào, ${u.output} ra → ${usd.toFixed(4)} USD (~${Math.round(usd * 26000)}đ)`);
}
if (totalUsd) console.log(`Tổng: ${totalUsd.toFixed(4)} USD (~${Math.round(totalUsd * 26000)}đ), trung bình ~${Math.round((totalUsd * 26000) / Math.max(ok.length, 1))}đ/bài (đọc ảnh + chấm)`);

const out = path.join(here, `results-${MODEL_NAME.replace(/[^\w.-]+/g, "_")}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`);
fs.writeFileSync(out, JSON.stringify({ provider: PROVIDER, model: MODEL_NAME, results }, null, 2));
console.log(`\nChi tiết (bản chép, nhận xét): ${path.relative(process.cwd(), out)}`);
