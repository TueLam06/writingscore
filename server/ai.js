// Gọi AI để (1) đọc chữ viết tay từ ảnh và (2) chấm IELTS Writing.
// Thứ tự: Claude (nếu có ANTHROPIC_API_KEY) → Gemini (nếu có GEMINI_API_KEY).
// Claude lỗi (hết tiền, quá tải, mất mạng…) thì tự chuyển sang Gemini.
// Không có key nào → trả kết quả mẫu (chế độ DEMO).
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, ApiError as GeminiApiError } from "@google/genai";
import { analysisSystemPrompt, positioningSystemPrompt } from "./prompts/grading.js";
import { measure, computeRanges, overallBand, clampBand, countWords } from "./prompts/bands.js";
import { QUESTION_TYPES } from "./prompts/requirements.js";
import { speakingSystemPrompt } from "./prompts/speaking.js";

const PROVIDERS = [process.env.ANTHROPIC_API_KEY && "claude", process.env.GEMINI_API_KEY && "gemini"].filter(Boolean);
export const PROVIDER = PROVIDERS[0] || "demo";
export const DEMO_MODE = PROVIDER === "demo";

// claude-haiku-5-5 (rẻ nhất, mặc định) | claude-sonnet-5-5 (cân bằng) | claude-opus-5-5 (mạnh nhất)
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-haiku-5-5";
// Có thể dùng mô hình riêng cho từng bước (vd. Haiku đọc chữ, Sonnet chấm)
const CLAUDE_OCR_MODEL = process.env.CLAUDE_OCR_MODEL || CLAUDE_MODEL;
const CLAUDE_GRADE_MODEL = process.env.CLAUDE_GRADE_MODEL || CLAUDE_MODEL;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
// Mô hình dự phòng khi mô hình chính quá tải (503) hoặc hết hạn mức (429)
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";
const MODEL_OF = { claude: CLAUDE_OCR_MODEL === CLAUDE_GRADE_MODEL ? CLAUDE_MODEL : `${CLAUDE_OCR_MODEL} (đọc) + ${CLAUDE_GRADE_MODEL} (chấm)`, gemini: GEMINI_MODEL };
export const MODEL_NAME = DEMO_MODE ? "demo" : MODEL_OF[PROVIDER];
// Chuỗi mô hình sẽ thử, để hiển thị: "claude-haiku-5-5 → gemini-3.6-flash"
export const MODEL_CHAIN = PROVIDERS.map((p) => MODEL_OF[p]);

const claude = PROVIDERS.includes("claude") ? new Anthropic() : null;
const gemini =
  PROVIDERS.includes("gemini")
    ? new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        // Không chờ quá lâu: thử lại 1 lần rồi báo lỗi, thay vì treo nhiều phút
        httpOptions: { timeout: 120_000, retryOptions: { attempts: 2, initialDelay: 2, maxDelay: 5 } },
      })
    : null;

// ---------- Schema kết quả (structured outputs) ----------

const OCR_SCHEMA = {
  type: "object",
  properties: {
    transcript: { type: "string" },
    legibility: { type: "string", enum: ["good", "fair", "poor"] },
    unclear: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          note: { type: "string" },
        },
        required: ["text", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["transcript", "legibility", "unclear"],
  additionalProperties: false,
};

const strings = { type: "array", items: { type: "string" } };
// Câu phức: trích dẫn + loại mệnh đề (để đo độ đa dạng cấu trúc)
const complexList = {
  type: "array",
  items: {
    type: "object",
    properties: {
      text: { type: "string" },
      type: { type: "string", enum: ["relative", "adverbial", "noun_clause", "conditional", "participle", "comparative", "other"] },
    },
    required: ["text", "type"],
    additionalProperties: false,
  },
};

// Bước 1 — AI chỉ thu thập dữ kiện, không cho điểm (code tính khung band từ đây)
const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    // Dạng đề + các phần bắt buộc theo khung trong prompts/requirements.js
    question_type: { type: "string", enum: [...new Set(Object.values(QUESTION_TYPES).flatMap((t) => Object.keys(t))), "report"] },
    requirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          status: { type: "string", enum: ["met", "partial", "missing", "not_required"] },
          evidence: { type: "string" },
        },
        required: ["key", "status", "evidence"],
        additionalProperties: false,
      },
    },
    // Task 2: mức phát triển của từng ý chính, và có kết luận không
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          idea: { type: "string" },
          development: { type: "string", enum: ["developed", "listed", "overgeneralised"] },
        },
        required: ["idea", "development"],
        additionalProperties: false,
      },
    },
    conclusion: { type: "string", enum: ["present", "missing", "not_applicable"] },
    position: { type: "string", enum: ["clear", "unclear", "contradictory", "missing", "not_required"] },
    overview: { type: "string", enum: ["clear", "attempted", "missing", "not_applicable"] },
    // Chỉ dùng cho Academic Task 1 (đối chiếu với biểu đồ)
    overview_accurate: { type: "string", enum: ["yes", "no", "not_applicable"] },
    key_features: {
      type: "array",
      items: {
        type: "object",
        properties: {
          feature: { type: "string" },
          status: { type: "string", enum: ["covered", "missed"] },
        },
        required: ["feature", "status"],
        additionalProperties: false,
      },
    },
    off_topic: { type: "boolean" },
    note_form: { type: "boolean" },
    copied_from_prompt: strings,
    complex_correct: complexList,
    complex_faulty: complexList,
    // Academic Task 1: số liệu minh hoạ; mọi dạng: lỗi định dạng
    data_support: { type: "string", enum: ["adequate", "limited", "none", "not_applicable"] },
    format_issues: strings,
    // General Training Task 1 (thư)
    letter_opening: { type: "string", enum: ["present", "missing", "not_applicable"] },
    letter_closing: { type: "string", enum: ["present", "missing", "not_applicable"] },
    tone: { type: "string", enum: ["consistent", "minor_inconsistency", "inappropriate", "not_applicable"] },
    less_common_correct: strings,
    errors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          correction: { type: "string" },
          type: {
            type: "string",
            enum: ["grammar", "spelling", "punctuation", "word_choice", "information", "coherence", "redundancy", "naturalness"],
          },
          severity: { type: "string", enum: ["major", "minor"] },
          explanation: { type: "string" },
        },
        required: ["original", "correction", "type", "severity", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["question_type", "requirements", "ideas", "conclusion", "position", "overview", "overview_accurate", "key_features", "off_topic", "note_form", "copied_from_prompt", "complex_correct", "complex_faulty", "less_common_correct", "data_support", "format_issues", "letter_opening", "letter_closing", "tone", "errors"],
  additionalProperties: false,
};

// Bước 2 — AI định vị band trong khung: lý do trước, band sau (không chốt band trước khi lập luận)
const criterion = {
  type: "object",
  properties: {
    position_reason: { type: "string" },
    band: { type: "number" },
    comment: { type: "string" },
  },
  required: ["position_reason", "band", "comment"],
  additionalProperties: false,
};

const POSITION_SCHEMA = {
  type: "object",
  properties: {
    task: criterion,
    coherence: criterion,
    lexical: criterion,
    grammar: criterion,
    strengths: strings,
    improvements: strings,
    improved_version: { type: "string" },
  },
  required: ["task", "coherence", "lexical", "grammar", "strengths", "improvements", "improved_version"],
  additionalProperties: false,
};

// ---------- Prompt ----------

const OCR_SYSTEM = `You transcribe handwritten English essays from photos for an IELTS homework app.
Rules:
- Transcribe EXACTLY what the student wrote, including their spelling, grammar and punctuation mistakes. Never correct or improve anything — the transcript will be graded, so any correction would hide the student's real errors.
- Keep paragraph breaks (blank line between paragraphs).
- Crossed-out / scribbled-out words are deleted by the student: OMIT them completely, even if still readable.
- Words written above or below a line with a caret (^) or arrow are insertions: put them in the sentence at the marked position.
- Ignore printed text on the paper (notebook brand, ruled headers, page numbers) and anything outside the student's writing area.
- If several images are given, they are consecutive pages in order.
- If a word is genuinely illegible, write your best guess and list it in "unclear" with a short Vietnamese note (e.g. "có thể là 'their' hoặc 'there'").
- legibility: overall readability of the handwriting/photo.`;

// Tổng token đã dùng (Claude) — để tính chi phí khi chạy đánh giá
// { "claude-haiku-5-5": { input, output }, ... }
export const usage = {};

// ---------- Gọi AI ----------
// parts: [{ type: "text", text } | { type: "image", mediaType, base64 }]

// Thử lần lượt từng nhà cung cấp; trả { data, model } của lần thành công
async function callAI(args) {
  let lastErr;
  for (const p of PROVIDERS) {
    try {
      return p === "claude" ? await callClaude(args) : await callGemini(args);
    } catch (err) {
      lastErr = err;
      if (p !== PROVIDERS.at(-1)) console.warn(`${MODEL_OF[p]} lỗi: ${friendlyError(err)} → chuyển sang ${MODEL_OF[PROVIDERS.at(-1)]}`);
    }
  }
  throw lastErr;
}

async function callClaude({ system, parts, schema, effort, step }) {
  const model = step === "ocr" ? CLAUDE_OCR_MODEL : CLAUDE_GRADE_MODEL;
  const content = parts.map((p) =>
    p.type === "image"
      ? { type: "image", source: { type: "base64", media_type: p.mediaType, data: p.base64 } }
      : { type: "text", text: p.text },
  );
  // Haiku không hỗ trợ mô hình dự phòng phía máy chủ (fallbacks)
  const fallback = model.includes("haiku") ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
  // Dùng streaming (SDK bắt buộc khi max_tokens lớn), chỉ lấy kết quả cuối cùng
  const response = await claude.beta.messages
    .stream({
      model,
      // Đủ chỗ cho phần suy nghĩ + kết quả với bài dài (16000 từng bị cắt ở bài ~420 từ)
      max_tokens: 32000,
      ...fallback,
      system,
      messages: [{ role: "user", content }],
      output_config: { effort, format: { type: "json_schema", schema } },
    })
    .finalMessage();

  const u = (usage[model] ??= { input: 0, output: 0 });
  u.input += response.usage.input_tokens;
  u.output += response.usage.output_tokens;
  if (response.stop_reason === "refusal") {
    throw new Error("AI từ chối xử lý yêu cầu này. Hãy thử lại với ảnh/bài khác.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Kết quả bị cắt giữa chừng (bài quá dài). Hãy thử lại.");
  }
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("AI không trả về kết quả.");
  return { data: JSON.parse(text), model: response.model };
}

async function callGemini(args) {
  try {
    return await callGeminiModel(GEMINI_MODEL, args);
  } catch (err) {
    const busy = err instanceof GeminiApiError && (err.status === 503 || err.status === 429);
    if (!busy || !GEMINI_FALLBACK_MODEL || GEMINI_FALLBACK_MODEL === GEMINI_MODEL) throw err;
    console.warn(`${GEMINI_MODEL} lỗi ${err.status}, chuyển sang ${GEMINI_FALLBACK_MODEL}`);
    return callGeminiModel(GEMINI_FALLBACK_MODEL, args);
  }
}

async function callGeminiModel(model, { system, parts, schema }) {
  const response = await gemini.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: parts.map((p) =>
          p.type === "image" ? { inlineData: { mimeType: p.mediaType, data: p.base64 } } : { text: p.text },
        ),
      },
    ],
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
    },
  });

  if (response.promptFeedback?.blockReason) {
    throw new Error("Gemini từ chối xử lý yêu cầu này. Hãy thử lại với ảnh/bài khác.");
  }
  const finish = response.candidates?.[0]?.finishReason;
  if (finish === "MAX_TOKENS") throw new Error("Kết quả bị cắt giữa chừng (bài quá dài). Hãy thử lại.");
  if (finish && finish !== "STOP") throw new Error(`Gemini dừng bất thường (${finish}). Hãy thử lại.`);
  if (!response.text) throw new Error("AI không trả về kết quả.");
  return { data: JSON.parse(response.text), model };
}

export function friendlyError(err) {
  if (err instanceof GeminiApiError) {
    if (err.status === 400 && /api key/i.test(err.message)) return "Gemini API key không hợp lệ. Kiểm tra lại file .env.";
    if (err.status === 403) return "Gemini API key không có quyền (kiểm tra key trong Google AI Studio).";
    if (err.status === 404) return `Không tìm thấy mô hình "${GEMINI_MODEL}". Đổi GEMINI_MODEL trong file .env.`;
    if (err.status === 429) return "Đã hết hạn mức miễn phí của Gemini (theo phút hoặc theo ngày). Đợi một lát rồi thử lại.";
    if (err.status === 503) return "Gemini đang quá tải (nhiều người dùng). Đợi vài phút rồi thử lại.";
    if (err.status >= 500) return `Máy chủ Gemini đang lỗi (${err.status}). Thử lại sau.`;
    return `Lỗi từ Gemini (${err.status}): ${err.message}`;
  }
  if (err instanceof Anthropic.APIError && /credit balance/i.test(err.message)) return "Tài khoản Claude đã hết tiền.";
  if (err instanceof Anthropic.AuthenticationError) return "API key không hợp lệ. Kiểm tra lại file .env.";
  if (err instanceof Anthropic.PermissionDeniedError) return "API key không có quyền dùng mô hình này.";
  if (err instanceof Anthropic.RateLimitError) return "Gọi AI quá nhanh hoặc hết hạn mức. Đợi một lát rồi thử lại.";
  if (err instanceof Anthropic.BadRequestError) return `Yêu cầu không hợp lệ: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "Không kết nối được tới máy chủ AI. Kiểm tra mạng.";
  if (err instanceof Anthropic.APIError) return `Lỗi từ máy chủ AI (${err.status}). Thử lại sau.`;
  return err.message || String(err);
}

// images: [{ mediaType, base64 }]
export async function transcribeHandwriting(images) {
  if (DEMO_MODE) return mockOcr();
  const parts = [
    ...images.map((img) => ({ type: "image", ...img })),
    { type: "text", text: `Transcribe the handwritten essay in ${images.length > 1 ? `these ${images.length} pages` : "this image"}.` },
  ];
  const { data, model } = await callAI({ system: OCR_SYSTEM, parts, schema: OCR_SCHEMA, effort: "medium", step: "ocr" });
  return { ...data, model };
}

// promptImage: { mediaType, base64 } | null (biểu đồ của đề Task 1)
export async function gradeWriting({ taskType, prompt, promptImage, text }) {
  const wordCount = countWords(text);
  if (DEMO_MODE) return { ...mockGrade(taskType), word_count: wordCount };
  const parts = [];
  if (promptImage) {
    parts.push({ type: "text", text: "Task visual (chart/diagram/map) given to the student:" });
    parts.push({ type: "image", ...promptImage });
  }
  const essay = `<task_prompt>\n${prompt}\n</task_prompt>\n\n<student_response word_count="${wordCount}">\n${text}\n</student_response>`;

  // Bước 1: AI thu thập dữ kiện (lỗi, câu phức, từ ít phổ biến, mức trả lời đề)
  const { data: analysis, model } = await callAI({
    system: analysisSystemPrompt(taskType),
    parts: [...parts, { type: "text", text: essay }],
    schema: ANALYSIS_SCHEMA,
    effort: "medium",
    step: "grade",
  });
  // Bỏ các "lỗi" mà AI trích dẫn nhưng không có trong bài (tránh nhận xét bịa)
  const norm = (s) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  const errors = analysis.errors.filter((e) => e.original.trim() && norm(text).includes(norm(e.original)));
  if (errors.length < analysis.errors.length) console.warn(`Bỏ ${analysis.errors.length - errors.length} lỗi AI trích không có trong bài`);
  analysis.errors = errors;

  // Code đếm và tính khung band cho từng tiêu chí
  const stats = measure(analysis, text, taskType);
  const ranges = computeRanges(analysis, stats, taskType);
  const NAMES = { task: taskType === "task2" ? "Task Response" : "Task Achievement", coherence: "Coherence & Cohesion", lexical: "Lexical Resource", grammar: "Grammatical Range & Accuracy" };
  const brief = (list) => (list.length ? list.map((x) => (typeof x === "string" ? `"${x}"` : `"${x.text}" (${x.type})`)).join("; ") : "(none)");
  const facts = `<server_analysis>
Allowed band ranges (choose a band INSIDE each range):
${CRITERIA.map((k) => `- ${k} (${NAMES[k]}): ${ranges[k].lo}–${ranges[k].hi} — ${ranges[k].why.join("; ")}`).join("\n")}

${taskType === "task1"
  ? `Overview: ${analysis.overview} (main trends described accurately: ${analysis.overview_accurate}). Key features of the visual: ${analysis.key_features.map((f) => `${f.feature} [${f.status}]`).join("; ") || "(none)"}.`
  : `Question type: ${analysis.question_type}. Required parts: ${analysis.requirements.map((r) => `${r.key} [${r.status}]`).join("; ") || "(none)"}. Position: ${analysis.position}.${analysis.ideas.length ? ` Main ideas: ${analysis.ideas.map((i) => `${i.idea} [${i.development}]`).join("; ")}.` : ""}${analysis.conclusion !== "not_applicable" ? ` Conclusion: ${analysis.conclusion}.` : ""}`}${taskType === "task1" ? ` Data support: ${analysis.data_support}.` : ""}${taskType === "task1gt" ? ` Letter opening: ${analysis.letter_opening}. Letter closing: ${analysis.letter_closing}. Tone: ${analysis.tone}.` : ""}
Format issues: ${brief(analysis.format_issues)}
Complex structures used correctly: ${brief(analysis.complex_correct)}
Complex structures with errors: ${brief(analysis.complex_faulty)}
Less common vocabulary used correctly: ${brief(analysis.less_common_correct)}
Errors found (${errors.filter((e) => e.severity === "major").length} major, ${errors.filter((e) => e.severity === "minor").length} minor): ${errors.map((e) => `"${e.original}" → "${e.correction}" (${e.type}, ${e.severity})`).join("; ") || "(none)"}
</server_analysis>`;

  // Bước 2: AI định vị band trong khung, viết nhận xét và bài viết lại
  const { data: result } = await callAI({
    system: positioningSystemPrompt(taskType),
    parts: [...parts, { type: "text", text: `${essay}\n\n${facts}` }],
    schema: POSITION_SCHEMA,
    effort: "medium",
    step: "grade",
  });
  for (const k of CRITERIA) {
    const r = ranges[k];
    const band = clampBand(result[k].band, r);
    if (band !== result[k].band) console.warn(`${k}: AI cho ${result[k].band}, ngoài khung ${r.lo}–${r.hi} → ${band}`);
    result[k] = { ...result[k], ai_band: result[k].band, band, range: [r.lo, r.hi], range_reason: r.why };
  }
  return {
    ...result,
    errors,
    overall_band: overallBand(CRITERIA.map((k) => result[k].band)),
    band_range: [overallBand(CRITERIA.map((k) => ranges[k].lo)), overallBand(CRITERIA.map((k) => ranges[k].hi))],
    analysis: { ...analysis, errors: undefined },
    stats,
    word_count: wordCount,
    model,
  };
}

const CRITERIA = ["task", "coherence", "lexical", "grammar"];

export { countWords };

// ---------- Speaking ----------

const speakingCriterion = {
  type: "object",
  properties: { reason: { type: "string" }, band: { type: "number" }, comment: { type: "string" } },
  required: ["reason", "band", "comment"],
  additionalProperties: false,
};

const SPEAKING_SCHEMA = {
  type: "object",
  properties: {
    fluency: speakingCriterion,
    lexical: speakingCriterion,
    grammar: speakingCriterion,
    pronunciation: speakingCriterion,
    strengths: strings,
    improvements: strings,
    errors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          correction: { type: "string" },
          type: { type: "string", enum: ["grammar", "word_choice", "collocation", "naturalness"] },
          explanation: { type: "string" },
        },
        required: ["original", "correction", "type", "explanation"],
        additionalProperties: false,
      },
    },
    possible_mispronunciations: {
      type: "array",
      items: {
        type: "object",
        properties: { heard: { type: "string" }, probably: { type: "string" } },
        required: ["heard", "probably"],
        additionalProperties: false,
      },
    },
    improved_answer: { type: "string" },
  },
  required: ["fluency", "lexical", "grammar", "pronunciation", "strengths", "improvements", "errors", "possible_mispronunciations", "improved_answer"],
  additionalProperties: false,
};

const SPEAKING_CRITERIA = ["fluency", "lexical", "grammar", "pronunciation"];
const halfBand = (b) => Math.min(9, Math.max(0, Math.round(Number(b) * 2) / 2));

// metrics: { seconds, words, wpm, longPauses, avgConfidence, lowConfidence: [string] } — đo ở trình duyệt
export async function gradeSpeaking({ part, question, transcript, metrics }) {
  if (DEMO_MODE) return mockSpeaking();
  const m = metrics || {};
  const input = `<question part="${part}">\n${question}\n</question>

<transcript>\n${transcript}\n</transcript>

<measurements>
Speaking time: ${Math.round(m.seconds || 0)} s
Words recognised: ${countWords(transcript)}
Speech rate: ${Math.round(m.wpm || 0)} words per minute
Long pauses (>2 s): ${m.longPauses ?? "unknown"}
Average recognition confidence: ${m.avgConfidence != null ? Number(m.avgConfidence).toFixed(2) : "unknown"}
Low-confidence segments: ${m.lowConfidence?.length ? m.lowConfidence.map((s) => `"${s}"`).join("; ") : "(none)"}
</measurements>`;

  const { data, model } = await callAI({
    system: speakingSystemPrompt(part),
    parts: [{ type: "text", text: input }],
    schema: SPEAKING_SCHEMA,
    effort: "medium",
    step: "grade",
  });
  for (const k of SPEAKING_CRITERIA) data[k].band = halfBand(data[k].band);
  // Bỏ lỗi AI trích không có trong bản chép
  const norm = (s) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^\w' ]+/g, " ").replace(/\s+/g, " ").trim();
  data.errors = data.errors.filter((e) => e.original.trim() && norm(transcript).includes(norm(e.original)));
  return { ...data, overall_band: overallBand(SPEAKING_CRITERIA.map((k) => data[k].band)), model };
}

function mockSpeaking() {
  const c = (band, comment) => ({ reason: "(DEMO)", band, comment: `(DEMO) ${comment}` });
  return {
    overall_band: 5.5,
    fluency: c(5.5, "Nói được liên tục nhưng còn ngập ngừng, lặp 'and then' nhiều lần."),
    lexical: c(5.5, "Từ vựng đủ cho chủ đề quen thuộc, ít cụm từ tự nhiên."),
    grammar: c(5, "Chủ yếu câu đơn; sai thì quá khứ ('I go there last year')."),
    pronunciation: c(6, "Ước lượng từ độ tin cậy nhận dạng — AI không nghe trực tiếp âm thanh."),
    strengths: ["(DEMO) Trả lời đúng trọng tâm câu hỏi."],
    improvements: ["(DEMO) Thêm lý do + ví dụ cụ thể để câu trả lời dài hơn."],
    errors: [{ original: "I go there last year", correction: "I went there last year", type: "grammar", explanation: "(DEMO) Hành động trong quá khứ → went." }],
    possible_mispronunciations: [],
    improved_answer: "(DEMO) I went there last year with a couple of close friends, and honestly it was one of the most relaxing trips I've ever had.",
  };
}

// ---------- Kết quả mẫu cho chế độ DEMO ----------

function mockOcr() {
  return {
    transcript:
      "Nowadays, many people believe that technology have made our lifes more easier. In my opinion, I agree with this statement because of two main reasons.\n\nFirstly, technology help people to communicate with each others quickly. For example, we can call our family who live in other country by using smartphone. This make the relationship become more closer.\n\nSecondly, technology save a lot of time in daily life. People can buy food, pay bill or study online without going outside.\n\nIn conclusion, technology bring many benefit for our life and I think it will continue to develop in the future.",
    legibility: "fair",
    unclear: [
      { text: "lifes", note: "(DEMO) Chữ hơi mờ — có thể là 'lifes' hoặc 'lives'. Kiểm tra lại ảnh gốc." },
    ],
  };
}

function mockGrade(taskType) {
  return {
    overall_band: 5.5,
    band_range: [5, 6.5],
    task: { band: 5.5, range: [5, 6.5], range_reason: ["(DEMO) trả lời đủ 2/2 phần của đề", "bài ngắn"], comment: `(DEMO) Bài có trả lời câu hỏi ${taskType === "task1" ? "" : "và nêu rõ quan điểm "}nhưng ý phát triển còn mỏng, ví dụ chung chung. Bài dưới số từ tối thiểu nên bị trừ điểm.` },
    coherence: { band: 6, range: [5.5, 7], range_reason: ["(DEMO) 4 đoạn, 1 lỗi liên kết"], comment: "(DEMO) Bố cục rõ ràng (mở bài - 2 thân bài - kết bài), dùng từ nối cơ bản (Firstly, Secondly, In conclusion) nhưng còn máy móc." },
    lexical: { band: 5.5, range: [5, 6], range_reason: ["(DEMO) 3 lỗi từ vựng/chính tả nặng (3.1/100 từ)"], comment: "(DEMO) Từ vựng đơn giản, lặp lại 'technology' nhiều lần. Có lỗi dùng từ như 'more easier', 'each others'." },
    grammar: { band: 5, range: [5, 6], range_reason: ["(DEMO) 3/9 câu không có lỗi ngữ pháp nặng (33%)"], comment: "(DEMO) Lỗi chia động từ số ít/số nhiều lặp lại nhiều (technology have, technology help). Ít câu phức." },
    strengths: ["(DEMO) Quan điểm rõ ràng ngay từ mở bài.", "(DEMO) Bố cục đoạn văn hợp lý, dễ theo dõi."],
    improvements: [
      "(DEMO) Ôn lại hòa hợp chủ ngữ - động từ: 'technology' là danh từ số ít → has / helps / saves / brings.",
      "(DEMO) Không dùng 'more' trước tính từ đã ở dạng so sánh hơn ('more easier' → 'easier').",
      "(DEMO) Mỗi thân bài nên có giải thích + ví dụ cụ thể hơn để đủ 250 từ.",
    ],
    errors: [
      { original: "technology have made", correction: "technology has made", type: "grammar", severity: "major", explanation: "(DEMO) 'Technology' là danh từ không đếm được → động từ số ít." },
      { original: "our lifes more easier", correction: "our lives easier", type: "grammar", severity: "major", explanation: "(DEMO) Số nhiều của 'life' là 'lives'; 'easier' đã là so sánh hơn." },
      { original: "In my opinion, I agree", correction: "I agree", type: "redundancy", severity: "minor", explanation: "(DEMO) Lặp ý: 'In my opinion' và 'I agree' cùng nghĩa." },
      { original: "with each others", correction: "with each other", type: "grammar", severity: "major", explanation: "(DEMO) Cụm cố định là 'each other'." },
      { original: "This make the relationship become more closer", correction: "This makes relationships closer", type: "grammar", severity: "major", explanation: "(DEMO) Chia động từ số ít và bỏ 'more'." },
    ],
    improved_version:
      "(DEMO) Many people argue that technology has made our lives considerably easier, and I wholeheartedly agree with this view for two main reasons.\n\nFirstly, technology enables people to communicate instantly regardless of distance. For instance, video-calling applications allow migrant workers to see and talk to their families every day, which helps maintain close relationships despite physical separation.\n\nSecondly, technology saves a great deal of time in everyday life. Routine tasks such as ordering food, paying bills or attending classes can now be completed online within minutes, freeing up time for work, rest and personal development.\n\nIn conclusion, technology brings substantial benefits to modern life, and it is likely to continue improving how we live in the years to come.",
  };
}
