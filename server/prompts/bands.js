// Tính KHUNG BAND (thấp–cao) cho từng tiêu chí từ những gì đếm được trong bài.
// AI (bước 1) chỉ liệt kê dữ kiện: lỗi, cấu trúc câu phức, từ ít phổ biến, mức trả lời đề.
// Code đếm và quy ra khung theo IELTS Writing Band Descriptors (bản 5/2023);
// AI (bước 2) chỉ được chọn band TRONG khung, dựa trên những gì code không đo được.
//
// Ngưỡng dưới đây là ƯỚC LƯỢNG ban đầu diễn giải từ descriptor, chưa được hiệu chỉnh trên
// bài có điểm giáo viên — cần kiểm tra lại khi có thêm dữ liệu.

import { typesFor, TASK2_COMMON_CAPS } from "./requirements.js";

const MIN_WORDS = { task1: 150, task1gt: 150, task2: 250 };

const GRAMMAR_TYPES = new Set(["grammar", "punctuation"]);
const LEXIS_TYPES = new Set(["spelling", "word_choice"]);

export function countWords(text) {
  return (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
}

const norm = (s) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();

// Tách câu, giữ vị trí ký tự (trên bản đã chuẩn hoá) để gán lỗi vào câu
function splitSentences(normText) {
  const out = [];
  const re = /[^.!?\n]+(?:[.!?]+|$)/g;
  let m;
  while ((m = re.exec(normText))) {
    if (countWords(m[0]) >= 3) out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

// Code tự nhận diện câu phức bằng từ nối phụ thuộc — để kiểm tra chéo số câu phức AI đếm
// (AI đếm dao động mạnh giữa các bài/lần chạy). Trả về loại mệnh đề tìm thấy trong câu.
const SUBJ = "(?:the|a|an|this|these|those|that|it|they|he|she|we|i|you|people|there|its|their|his|her|our|my|many|most|some|all|each|every|such|[a-z]+s)";
const CLAUSE_MARKERS = {
  relative: /(?:\b(?:who|whom|whose)\b|,\s*which\b|\bwhere\s+\w+|\b(?:in|by|of|to|for|from|with|on|at)\s+which\b)/,
  conditional: /\b(?:if|unless|provided that|as long as)\b/,
  adverbial: new RegExp(`\\b(?:because|although|though|whereas|while|whilst|even though|even if|so that|as soon as|whenever|once)\\b|\\b(?:when|since|until|before|after|as)\\s+${SUBJ}\\b`),
  noun_clause: /\b(?:believe|think|argue|claim|say|says|said|suggest|show|shows|mean|means|feel|agree|know|knows|ensure|realise|realize|clear|true|evident|obvious|fact|idea|view|reason|is|was|are)\s+(?:that|what|whether|how|why)\b|^\s*(?:what|whether)\b/,
  participle: /,\s*(?:\w+ing|having\s+\w+)\b|^\s*(?:having|being)\s+\w+/,
  comparative: /\bthe\s+(?:more|less|fewer|\w+er)\b[^,]*,\s*the\s+(?:more|less|fewer|\w+er)\b/,
};
function codeComplex(normText, sentences) {
  const types = new Set();
  let count = 0;
  for (const s of sentences) {
    const sent = normText.slice(s.start, s.end);
    const found = Object.keys(CLAUSE_MARKERS).filter((k) => CLAUSE_MARKERS[k].test(sent));
    if (found.length) count++;
    found.forEach((k) => types.add(k));
  }
  return { count, types: types.size };
}

// Thống kê từ kết quả phân tích của AI
export function measure(analysis, text, taskType) {
  const t = norm(text);
  const words = countWords(text);
  const copiedWords = (analysis.copied_from_prompt || [])
    .filter((s) => s.trim() && t.includes(norm(s)))
    .reduce((n, s) => n + countWords(s), 0);
  const ownWords = Math.max(words - copiedWords, 0);
  const sentences = splitSentences(t);
  const major = analysis.errors.filter((e) => e.severity === "major");

  // Câu có ít nhất 1 lỗi ngữ pháp/dấu câu nặng
  const badSentences = new Set();
  for (const e of major.filter((e) => GRAMMAR_TYPES.has(e.type))) {
    const pos = t.indexOf(norm(e.original));
    if (pos < 0) continue;
    const i = sentences.findIndex((s) => pos >= s.start && pos < s.end);
    if (i >= 0) badSentences.add(i);
  }
  const nSent = Math.max(sentences.length, 1);
  // Câu phức: lấy số lớn hơn giữa AI và code (AI hay đếm thiếu)
  const aiComplex = analysis.complex_correct.length;
  const aiTypes = new Set(analysis.complex_correct.map((c) => c.type ?? "other")).size;
  const code = codeComplex(t, sentences);
  const complexCount = Math.max(aiComplex, code.count);

  return {
    words,
    own_words: ownWords,
    min_words: MIN_WORDS[taskType] ?? 250,
    paragraphs: text.split(/\n\s*\n/).filter((p) => countWords(p) >= 5).length,
    sentences: sentences.length,
    error_free_sentences: nSent - badSentences.size,
    error_free_ratio: +((nSent - badSentences.size) / nSent).toFixed(2),
    grammar_major: major.filter((e) => GRAMMAR_TYPES.has(e.type)).length,
    lexis_major: major.filter((e) => LEXIS_TYPES.has(e.type)).length,
    lexis_major_per_100: +((major.filter((e) => LEXIS_TYPES.has(e.type)).length / Math.max(ownWords, 1)) * 100).toFixed(1),
    coherence_errors: analysis.errors.filter((e) => e.type === "coherence").length,
    complex_correct: complexCount,
    complex_correct_ai: aiComplex,
    complex_correct_code: code.count,
    complex_types: Math.max(aiTypes, code.types),
    complex_ratio: +(Math.min(complexCount, nSent) / nSent).toFixed(2),
    complex_faulty: analysis.complex_faulty.length,
    less_common_correct: analysis.less_common_correct.length,
  };
}

// Bảng tra: giá trị đầu tiên thoả điều kiện → khung [thấp, cao]
const pick = (rows, ok) => rows.find(([cond]) => ok(cond))[1];

function range(lo, hi, why) {
  return { lo, hi, why };
}

// Giới hạn trần/sàn, giữ khung hợp lệ (rộng tối thiểu 0.5)
function cap(r, maxHi, reason) {
  if (r.hi <= maxHi) return;
  r.hi = maxHi;
  if (r.lo > r.hi - 0.5) r.lo = Math.max(r.hi - 1, 1);
  r.why.push(reason);
}

export function computeRanges(analysis, stats, taskType) {
  const isTask1 = taskType === "task1" || taskType === "task1gt";
  const shortRatio = stats.own_words / stats.min_words;

  // ---- Grammatical Range & Accuracy: tỉ lệ câu không lỗi + cấu trúc phức
  const r = stats.error_free_ratio;
  const [gLo, gHi] = pick(
    [[0.85, [7.5, 9]], [0.7, [7, 8]], [0.5, [6, 7]], [0.3, [5, 6]], [0.15, [4, 5.5]], [0, [3, 4.5]]],
    (min) => r >= min,
  );
  const grammar = range(gLo, gHi, [
    `${stats.error_free_sentences}/${stats.sentences} câu không có lỗi ngữ pháp/dấu câu nặng (${Math.round(r * 100)}%)`,
  ]);
  const cxPct = Math.round(stats.complex_ratio * 100);
  if (stats.complex_correct === 0) cap(grammar, 5, "không có câu phức nào dùng đúng");
  // Dữ liệu cho thấy tỉ lệ câu phức KHÔNG phân biệt tốt band cao/thấp (bài 8.5 chính thức chỉ 29%, 2 loại),
  // nên chỉ bắt trường hợp cực đoan: gần như toàn câu đơn.
  else if (stats.complex_ratio < 0.15)
    cap(grammar, 6.5, `ít câu phức (${stats.complex_correct}/${stats.sentences} câu, ${cxPct}%, ${stats.complex_types} loại) — chủ yếu câu đơn`);
  else if (stats.complex_ratio < 0.25 && stats.complex_types < 2)
    cap(grammar, 7.5, `câu phức chưa thật đa dạng (${cxPct}% số câu, ${stats.complex_types} loại)`);
  if (stats.complex_faulty > stats.complex_correct) cap(grammar, 6, "câu phức sai nhiều hơn câu phức đúng");

  // ---- Lexical Resource: lỗi từ vựng/chính tả nặng trên 100 từ + từ ít phổ biến dùng đúng
  const lx = stats.lexis_major_per_100;
  const [lLo, lHi] = pick(
    [[0.5, [7, 9]], [1.5, [6.5, 8]], [3, [5.5, 7]], [5, [5, 6]], [8, [4, 5.5]], [Infinity, [3, 4.5]]],
    (max) => lx <= max,
  );
  const lexical = range(lLo, lHi, [`${stats.lexis_major} lỗi từ vựng/chính tả nặng (${lx}/100 từ)`]);
  if (stats.less_common_correct === 0) cap(lexical, 5.5, "không có từ ít phổ biến nào dùng đúng");
  else if (stats.less_common_correct <= 2) cap(lexical, 6.5, `chỉ ${stats.less_common_correct} từ/cụm ít phổ biến dùng đúng`);
  if (shortRatio < 0.6) cap(lexical, 5, `bài quá ngắn (${stats.own_words}/${stats.min_words} từ)`);

  // ---- Coherence & Cohesion: chia đoạn + số lỗi liên kết (phần còn lại do AI định vị)
  const minParas = isTask1 ? 2 : 3;
  const goodParas = stats.paragraphs >= (isTask1 ? 3 : 4);
  const coherence = range(...pick(
    [[0, goodParas ? [6.5, 9] : [6, 8]], [2, [5.5, 7]], [Infinity, [5, 6.5]]],
    (max) => stats.coherence_errors <= max,
  ), [`${stats.paragraphs} đoạn, ${stats.coherence_errors} lỗi liên kết`]);
  if (stats.paragraphs <= 1) cap(coherence, 5, "không chia đoạn");
  else if (stats.paragraphs < minParas) cap(coherence, 6, `chỉ có ${stats.paragraphs} đoạn`);

  // ---- Task Response / Achievement
  let task;
  if (analysis.off_topic) task = range(1, 4, ["lạc đề"]);
  else if (taskType === "task1") task = task1Range(analysis);
  else task = requirementsRange(analysis, taskType);
  if (taskType === "task1gt") {
    // Band 6: "appropriate format", "minor inconsistencies in tone"; band 5: "format may be inappropriate in places", "tone may be variable and sometimes inappropriate"
    const noOpen = analysis.letter_opening === "missing", noClose = analysis.letter_closing === "missing";
    if (noOpen || noClose) cap(task, 6, `thư thiếu ${[noOpen && "lời chào mở đầu", noClose && "phần kết thư"].filter(Boolean).join(" và ")}`);
    if (analysis.tone === "inappropriate") cap(task, 5, "giọng văn không phù hợp với người nhận");
    else if (analysis.tone === "minor_inconsistency") cap(task, 6.5, "giọng văn chưa nhất quán");
    if (analysis.format_issues?.length) cap(task, 7, `định dạng chưa phù hợp: ${analysis.format_issues.join("; ")}`);
  }
  if (analysis.note_form) cap(task, 5, "viết dạng gạch đầu dòng/ghi chú");
  if (shortRatio < 0.6) cap(task, 5, `bài quá ngắn (${stats.own_words}/${stats.min_words} từ)`);
  else if (shortRatio < 0.85) cap(task, 6.5, `bài ngắn (${stats.own_words}/${stats.min_words} từ, không tính phần chép đề)`);

  if (stats.words <= 20) for (const x of [task, coherence, lexical, grammar]) Object.assign(x, { lo: 1, hi: 1, why: ["bài từ 20 từ trở xuống"] });

  return { task, coherence, lexical, grammar };
}

// ---- Task 2 / GT thư: khung yêu cầu theo dạng đề (prompts/requirements.js)
// Bắt đầu từ 6.5–9 (đủ mọi phần), mỗi phần thiếu/sơ sài đặt trần theo bảng; thêm các quy tắc chung của Task 2.
function requirementsRange(analysis, taskType) {
  const type = typesFor(taskType)[analysis.question_type];
  const task = range(6.5, 9, []);
  if (!type) {
    task.why.push(`không xác định được dạng đề (${analysis.question_type})`);
    return task;
  }
  task.why.push(`dạng đề: ${type.label}`);
  const status = Object.fromEntries((analysis.requirements || []).map((r) => [r.key, r.status]));
  let missingCount = 0;
  for (const part of type.parts) {
    const st = status[part.key] ?? (part.optional ? "not_required" : "missing");
    if (st === "missing") missingCount++;
    if (st === "missing" || st === "partial") cap(task, part.caps[st], `${st === "missing" ? "thiếu" : "sơ sài"}: ${part.label}`);
  }
  if (!task.why.slice(1).length) task.why.push(`đủ ${type.parts.filter((p) => status[p.key] === "met").length} phần bắt buộc`);

  if (taskType === "task2") {
    if (missingCount >= 2) cap(task, TASK2_COMMON_CAPS.twoOrMoreMissing, `thiếu ${missingCount} phần bắt buộc`);
    if (analysis.position === "contradictory") cap(task, TASK2_COMMON_CAPS.contradictoryPosition, "quan điểm mâu thuẫn giữa các đoạn");
    if (analysis.conclusion === "missing") cap(task, TASK2_COMMON_CAPS.noConclusion, "không có kết luận");
    const ideas = analysis.ideas || [];
    const listed = ideas.filter((i) => i.development === "listed").length;
    if (ideas.length && listed * 2 >= ideas.length) cap(task, TASK2_COMMON_CAPS.ideasMostlyListed, `${listed}/${ideas.length} ý chính chỉ được liệt kê, chưa phát triển`);
    else if (ideas.some((i) => i.development === "overgeneralised")) cap(task, TASK2_COMMON_CAPS.ideasOverGeneralised, "có ý khái quát hoá quá mức");
  }
  return task;
}

// ---- Academic Task 1 – Task Achievement: overview, đặc điểm chính, lỗi số liệu (đối chiếu biểu đồ)
// Band 5: "no clear overview", "key features not adequately covered", "inaccurate details"
// Band 6: "relevant overview is attempted", "some details may be inaccurate"
// Band 7–8: "clear overview of main trends", "key features clearly presented/skilfully selected"
function task1Range(analysis) {
  const features = analysis.key_features || [];
  const missed = features.filter((f) => f.status === "missed").length;
  const dataErrors = analysis.errors.filter((e) => e.type === "information" && e.severity === "major").length;
  const featTxt = features.length ? `${features.length - missed}/${features.length} đặc điểm chính được nêu` : "không đối chiếu được biểu đồ";

  let task;
  if (analysis.overview === "missing") task = range(4, 5, ["không có phần tổng quan (overview)"]);
  else if (analysis.overview_accurate === "no") task = range(4.5, 5.5, ["overview mô tả sai xu hướng chính"]);
  else if (analysis.overview === "attempted") task = range(5.5, 7, ["overview còn sơ sài", featTxt]);
  else if (!missed && !dataErrors) task = range(7, 9, [analysis.overview_accurate === "yes" ? "overview rõ và đúng" : "overview rõ", featTxt, "không có lỗi số liệu nặng"]);
  else task = range(6, 7.5, ["overview rõ", featTxt]);

  // Band 5: "there may be no data to support the description"; band 6: "supported using figures/data"
  if (analysis.data_support === "none") cap(task, 5, "không có số liệu minh hoạ");
  else if (analysis.data_support === "limited") cap(task, 6.5, "ít số liệu minh hoạ");
  // Định dạng không phù hợp (kiểu thư, bình luận cá nhân, suy đoán ngoài biểu đồ) giới hạn TA (bài mẫu band 7 chính thức)
  if (analysis.format_issues?.length) cap(task, 7, `định dạng/nội dung không phù hợp: ${analysis.format_issues.join("; ")}`);
  if (features.length && missed * 2 >= features.length) cap(task, 5.5, `bỏ sót ${missed}/${features.length} đặc điểm chính`);
  if (dataErrors >= 3) cap(task, 6, `${dataErrors} lỗi số liệu nặng (sai số, năm hoặc xu hướng)`);
  else if (dataErrors || missed) cap(task, 7, dataErrors ? `${dataErrors} lỗi số liệu nặng` : `bỏ sót ${missed} đặc điểm chính`);
  return task;
}

// Band tổng = trung bình 4 tiêu chí, làm tròn kiểu IELTS (.25 → .5, .75 → lên 1)
export function overallBand(bands) {
  const avg = bands.reduce((a, b) => a + b, 0) / bands.length;
  return Math.round(avg * 2) / 2;
}

export const clampBand = (b, r) => Math.min(r.hi, Math.max(r.lo, Math.round(b * 2) / 2));
