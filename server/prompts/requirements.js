// KHUNG YÊU CẦU THEO DẠNG ĐỀ — nguồn duy nhất cho cả câu lệnh AI (bước 1) và code tính khung band.
// Mỗi phần bắt buộc có mức trần TR/TA khi "missing" (không có) hoặc "partial" (sơ sài/không rõ).
// Mức trần diễn giải từ IELTS Writing Band Descriptors (5/2023):
//   Band 6: "main parts of the prompt are addressed (though some may be more fully covered than others)"
//   Band 5: "main parts of the prompt are incompletely addressed"
//   Band 4: "the prompt is tackled in a minimal way… position is difficult to identify"
//   GT Task 1 band 5: "all bullet points presented but one or more not adequately covered"; band 4: "not all bullet points are presented"
// IELTS không công bố "mất bao nhiêu điểm" cho từng phần — đây là quy ước của app để chấm nhất quán.
// Giáo viên có thể chỉnh các con số trong `caps` mà không phải sửa chỗ khác.

export const QUESTION_TYPES = {
  task2: {
    opinion: {
      label: "Agree/Disagree (To what extent…?)",
      detect: 'asks for the writer\'s opinion on ONE statement: "To what extent do you agree or disagree?", "Do you agree or disagree?", "Is this a good idea?"',
      parts: [
        { key: "position", label: "Quan điểm rõ (đồng ý / không đồng ý / đồng ý một phần), nhất quán từ mở bài đến kết luận", desc: "a clear position (agree / disagree / partly agree) stated in the introduction or body and kept consistent to the conclusion", caps: { missing: 5, partial: 6 } },
        { key: "support", label: "Ít nhất 2 lý do được phát triển để bảo vệ quan điểm", desc: "at least two main reasons that support that position, each explained/extended", caps: { missing: 5, partial: 6 } },
      ],
    },
    discussion: {
      label: "Discussion (Discuss both views and give your opinion)",
      detect: 'presents two views and asks to "discuss both views (and give your own opinion)"',
      parts: [
        { key: "view_a", label: "Bàn về quan điểm A", desc: "the first view in the prompt is discussed with reasons", caps: { missing: 5, partial: 6 } },
        { key: "view_b", label: "Bàn về quan điểm B", desc: "the second view in the prompt is discussed with reasons", caps: { missing: 5, partial: 6 } },
        { key: "own_opinion", label: "Ý kiến riêng rõ ràng (nếu đề yêu cầu)", desc: "the writer's own opinion is clearly stated (not_required if the prompt only says 'discuss both views')", caps: { missing: 5, partial: 6 }, optional: true },
      ],
    },
    adv_disadv: {
      label: "Advantages & Disadvantages (What are the advantages and disadvantages?)",
      detect: 'asks "What are the advantages and disadvantages…?" or "Discuss the advantages and disadvantages" WITHOUT asking which is greater',
      parts: [
        { key: "advantages", label: "Nêu và phát triển ưu điểm", desc: "advantages are presented and developed", caps: { missing: 5, partial: 6 } },
        { key: "disadvantages", label: "Nêu và phát triển nhược điểm", desc: "disadvantages are presented and developed", caps: { missing: 5, partial: 6 } },
        { key: "own_opinion", label: "Ý kiến riêng (nếu đề yêu cầu)", desc: "the writer's opinion, only if the prompt asks for it (otherwise not_required)", caps: { missing: 5, partial: 6 }, optional: true },
      ],
    },
    outweigh: {
      label: "Outweigh (Do the advantages outweigh the disadvantages?)",
      detect: 'asks whether advantages outweigh disadvantages (or benefits outweigh drawbacks / vice versa)',
      parts: [
        { key: "judgement", label: "Nhận định rõ bên nào lớn hơn", desc: "a clear judgement of which side is greater, kept consistent", caps: { missing: 5, partial: 6 } },
        { key: "advantages", label: "Phát triển ưu điểm", desc: "advantages are discussed with explanation", caps: { missing: 6, partial: 7 } },
        { key: "disadvantages", label: "Phát triển nhược điểm", desc: "disadvantages are discussed with explanation", caps: { missing: 6, partial: 7 } },
        { key: "weighing", label: "Có so sánh/cân nhắc vì sao một bên lớn hơn", desc: "the response explains WHY one side outweighs the other (weighs them), not just lists both", caps: { missing: 6.5, partial: 7 } },
      ],
    },
    positive_negative: {
      label: "Positive or negative development",
      detect: 'asks "Is this a positive or negative development/trend?"',
      parts: [
        { key: "judgement", label: "Nhận định rõ: tích cực / tiêu cực / cả hai", desc: "a clear judgement: positive, negative, or mixed with a clear overall view", caps: { missing: 5, partial: 6 } },
        { key: "support", label: "Lý do được phát triển cho nhận định", desc: "reasons supporting the judgement, explained/extended", caps: { missing: 5, partial: 6 } },
      ],
    },
    two_part: {
      label: "Two-part / Direct questions (Why…? What can be done…? Problems & solutions, Causes & effects)",
      detect: 'asks two or three direct questions, e.g. "Why…? What can be done…?", "What are the problems and what are the solutions?", "What are the causes and effects?"; also the second question of a mixed prompt',
      parts: [
        { key: "q1", label: "Trả lời câu hỏi 1", desc: "the first question in the prompt is answered and developed", caps: { missing: 5, partial: 6 } },
        { key: "q2", label: "Trả lời câu hỏi 2", desc: "the second question in the prompt is answered and developed", caps: { missing: 5, partial: 6 } },
        { key: "q3", label: "Trả lời câu hỏi 3 (nếu có)", desc: "the third question, only if the prompt has one (otherwise not_required)", caps: { missing: 5, partial: 6 }, optional: true },
      ],
    },
  },
  task1gt: {
    letter: {
      label: "General Training letter",
      detect: "a letter task with three bullet points",
      parts: [
        { key: "purpose", label: "Mục đích thư rõ ràng", desc: "the purpose of the letter is clear (usually in the first paragraph)", caps: { missing: 4.5, partial: 5.5 } },
        { key: "bullet_1", label: "Gạch đầu dòng 1", desc: "the first bullet point is covered and extended", caps: { missing: 4.5, partial: 5.5 } },
        { key: "bullet_2", label: "Gạch đầu dòng 2", desc: "the second bullet point is covered and extended", caps: { missing: 4.5, partial: 5.5 } },
        { key: "bullet_3", label: "Gạch đầu dòng 3", desc: "the third bullet point is covered and extended", caps: { missing: 4.5, partial: 5.5 } },
      ],
    },
  },
};

// Quy tắc chung cho Task 2 (mọi dạng đề)
export const TASK2_COMMON_CAPS = {
  twoOrMoreMissing: 4.5, // band 4: "the prompt is tackled in a minimal way"
  contradictoryPosition: 5.5, // band 5: "the writer expresses a position but the development is not always clear"
  noConclusion: 6, // band 6: "conclusions may be unclear, unjustified or repetitive"
  ideasMostlyListed: 6, // band 6: "some main ideas are insufficiently developed"
  ideasOverGeneralised: 7.5, // band 7: "may be a tendency to over-generalise" → chưa đạt 8
};

export const typesFor = (taskType) => QUESTION_TYPES[taskType] ?? {};

// Phần mô tả cho câu lệnh AI (bước 1)
export function requirementsPrompt(taskType) {
  const types = typesFor(taskType);
  const keys = Object.keys(types);
  if (!keys.length) return "";
  return `QUESTION TYPE AND REQUIRED PARTS
- question_type: classify the prompt as ONE of: ${keys.map((k) => `${k} = ${types[k].detect}`).join("; ")}.${taskType === "task2" ? ' If a prompt mixes types (e.g. "Why…? Is this positive or negative?"), use two_part and treat each question as q1, q2.' : ""}
- requirements: for EVERY part of the chosen type, give {key, status, evidence}:
${keys.map((k) => `  ${k}: ${types[k].parts.map((p) => `${p.key} = ${p.desc}`).join("; ")}`).join("\n")}
  status: met = clearly present and developed (at least a few sentences of explanation or an example); partial = only mentioned in passing (about one sentence), unclear, or left undeveloped; missing = not addressed at all; not_required = an optional part the prompt does not ask for.
  evidence: a short quote from the response (or "none").
  Weak, general or personal examples do NOT make a part partial — only the absence of explanation does.`;
}
