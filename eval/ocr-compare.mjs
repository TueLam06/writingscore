// So sánh 2 công cụ đọc chữ viết tay: Gemini và Google Cloud Vision.
// Chạy:  node --env-file=.env eval/ocr-compare.mjs
// Kết quả: eval/ocr-compare.html (chỗ hai bên đọc khác nhau được tô vàng).
//
// Google Cloud Vision không nhận API key: cần file khoá tài khoản dịch vụ (service account),
// khai báo trong .env:  GOOGLE_APPLICATION_CREDENTIALS=D:/writingscored/google-vision-key.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vision from "@google-cloud/vision";
import { transcribeHandwriting, friendlyError, PROVIDER } from "../ai.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const pagesDir = path.join(here, "ocr-pages");
const pages = fs.readdirSync(pagesDir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
const hasVision = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
const visionClient = hasVision ? new vision.ImageAnnotatorClient() : null;

async function readGemini(buf) {
  if (PROVIDER === "demo") throw new Error("Chưa có API key trong .env");
  const ocr = await transcribeHandwriting([{ mediaType: "image/jpeg", base64: buf.toString("base64") }]);
  return { text: ocr.transcript, lowConfidence: ocr.unclear.map((u) => u.text), model: ocr.model };
}

async function readVision(buf) {
  const [res] = await visionClient.documentTextDetection({
    image: { content: buf },
    imageContext: { languageHints: ["en"] },
  });
  if (res.error?.message) throw new Error(res.error.message);
  const words = [];
  for (const p of res.fullTextAnnotation?.pages ?? [])
    for (const b of p.blocks ?? [])
      for (const para of b.paragraphs ?? [])
        for (const w of para.words ?? [])
          words.push({ text: (w.symbols ?? []).map((s) => s.text).join(""), conf: w.confidence ?? 1 });
  return {
    text: res.fullTextAnnotation?.text ?? "",
    lowConfidence: words.filter((w) => w.conf < 0.7).map((w) => w.text),
  };
}

// ---------- So sánh theo từ (LCS) ----------

const tokenize = (s) => s.match(/[A-Za-z0-9’']+|[^\sA-Za-z0-9’']/g) || [];
const norm = (t) => t.replace(/’/g, "'");

function diff(a, b) {
  const A = tokenize(a), B = tokenize(b);
  const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = norm(A[i]) === norm(B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const outA = [], outB = [];
  let i = 0, j = 0, same = 0;
  while (i < n || j < m) {
    if (i < n && j < m && norm(A[i]) === norm(B[j])) { outA.push([A[i++], 0]); outB.push([B[j++], 0]); same++; }
    else if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) outB.push([B[j++], 1]);
    else outA.push([A[i++], 1]);
  }
  return { a: outA, b: outB, agree: n + m ? (2 * same) / (n + m) : 1 };
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const render = (toks, low = []) =>
  toks
    .map(([t, d], k) => {
      const sp = k && /^[A-Za-z0-9(]/.test(t) ? " " : "";
      const cls = [d ? "diff" : "", low.includes(t) ? "low" : ""].filter(Boolean).join(" ");
      return sp + (cls ? `<mark class="${cls}">${esc(t)}</mark>` : esc(t));
    })
    .join("");

// ---------- Chạy ----------

const sections = [];
for (const file of pages) {
  const buf = fs.readFileSync(path.join(pagesDir, file));
  process.stdout.write(`${file}: `);
  const [g, v] = await Promise.allSettled([readGemini(buf), hasVision ? readVision(buf) : Promise.reject(new Error("Chưa cấu hình Google Cloud Vision"))]);
  const gem = g.status === "fulfilled" ? g.value : { error: friendlyError(g.reason) };
  const vis = v.status === "fulfilled" ? v.value : { error: v.reason.message };
  let body;
  if (gem.text && vis.text) {
    const d = diff(gem.text, vis.text);
    console.log(`Gemini ${tokenize(gem.text).length} từ | Vision ${tokenize(vis.text).length} từ | giống nhau ${(d.agree * 100).toFixed(0)}%`);
    body = `<p class="stat">Hai bên giống nhau <b>${(d.agree * 100).toFixed(0)}%</b> · chỗ tô vàng là chỗ đọc khác nhau</p>
      <div class="cols"><div><h3>${esc(gem.model)}</h3><div class="txt">${render(d.a, gem.lowConfidence)}</div></div>
      <div><h3>Google Cloud Vision</h3><div class="txt">${render(d.b, vis.lowConfidence)}</div></div></div>`;
  } else {
    console.log(`Gemini: ${gem.error ?? "OK"} | Vision: ${vis.error ?? "OK"}`);
    const box = (name, r) => `<div><h3>${name}</h3>${r.error ? `<p class="err">${esc(r.error)}</p>` : `<div class="txt">${render(tokenize(r.text).map((t) => [t, 0]), r.lowConfidence)}</div>`}</div>`;
    body = `<div class="cols">${box(gem.model || "AI", gem)}${box("Google Cloud Vision", vis)}</div>`;
  }
  sections.push(`<section><h2>${esc(file)}</h2><div class="page"><img src="ocr-pages/${encodeURIComponent(file)}" onclick="this.classList.toggle('big')"></div>${body}</section>`);
}

const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>So sánh đọc chữ viết tay</title><style>
body{font:15px/1.6 system-ui,sans-serif;margin:0;padding:16px;background:#f6f7f9;color:#1d2330}
h1{font-size:20px}h2{font-size:16px;margin:0 0 8px}h3{font-size:14px;margin:0 0 6px;color:#677085}
section{background:#fff;border:1px solid #e3e6ec;border-radius:10px;padding:14px;margin-bottom:16px;display:grid;grid-template-columns:260px 1fr;gap:14px}
section>h2{grid-column:1/-1}.page img{width:100%;border-radius:6px;cursor:zoom-in}.page img.big{position:fixed;inset:2vh auto auto 2vw;width:auto;height:96vh;z-index:9;box-shadow:0 0 0 100vmax rgba(0,0,0,.7);cursor:zoom-out}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.txt{white-space:pre-wrap;background:#fafbfc;border:1px solid #e3e6ec;border-radius:8px;padding:10px}
mark.diff{background:#ffe066;border-radius:3px;padding:0 1px}mark.low{text-decoration:underline wavy #c0392b}mark.low:not(.diff){background:none}
.stat{margin:0 0 8px}.err{color:#c0392b}.legend{color:#677085;font-size:13px}
@media(max-width:800px){section{grid-template-columns:1fr}.cols{grid-template-columns:1fr}}
</style></head><body><h1>So sánh đọc chữ viết tay: Gemini và Google Cloud Vision</h1>
<p class="legend"><mark class="diff">Tô vàng</mark> = hai công cụ đọc khác nhau · <mark class="low">gạch sóng đỏ</mark> = công cụ tự báo không chắc · bấm vào ảnh để phóng to</p>
${sections.join("\n")}</body></html>`;
fs.writeFileSync(path.join(here, "ocr-compare.html"), html);
console.log("\nĐã tạo eval/ocr-compare.html");
