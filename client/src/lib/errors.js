// Lỗi trong bài viết: loại lỗi, mức độ, và vị trí trong bài

export const ERR_TYPE = {
  grammar: "Ngữ pháp", spelling: "Chính tả", punctuation: "Dấu câu", word_choice: "Dùng từ sai", vocabulary: "Từ vựng",
  information: "Sai thông tin", coherence: "Liên kết", redundancy: "Thừa chữ", naturalness: "Chưa tự nhiên",
};
const MINOR_TYPES = ["redundancy", "naturalness"];

// Bài chấm cũ chưa có "severity" → suy ra từ loại lỗi
export const severityOf = (e) => e.severity || (MINOR_TYPES.includes(e.type) ? "minor" : "major");

// Chia bài viết thành các đoạn: chữ thường và chỗ có lỗi.
// Trả về { parts: [{ text } | { text, err }], found: Set(chỉ số lỗi định vị được) }
export function annotate(text, errors) {
  const ranges = [];
  errors.forEach((e, i) => {
    const words = e.original.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['’‘]/g, "['’‘]"));
    if (!words[0]) return;
    const re = new RegExp(words.join("\\s+"), "gi");
    let m;
    while ((m = re.exec(text))) {
      const [s, t] = [m.index, m.index + m[0].length];
      if (!ranges.some((r) => s < r.end && t > r.start)) { ranges.push({ start: s, end: t, i }); break; }
    }
  });
  ranges.sort((a, b) => a.start - b.start);
  const parts = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) parts.push({ text: text.slice(pos, r.start) });
    parts.push({ text: text.slice(r.start, r.end), err: r.i });
    pos = r.end;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos) });
  return { parts, found: new Set(ranges.map((r) => r.i)) };
}
