// Câu lệnh chấm IELTS Writing.
// Dựa trên (diễn giải lại, không chép nguyên văn):
//  - IELTS Writing Band Descriptors – public version, updated May 2023 (ielts.org)
//  - IELTS Writing Key Assessment Criteria (ielts.org)
//  - IELTS writing scales review and update – summary overview (Clark et al., 2023)
//  - IDP IELTS: "Myths about the IELTS Writing test to dispel"
// Mục tiêu: chấm đúng tiêu chí hiện hành, không chấm theo "mẹo" luyện thi hay quy tắc đã bỏ.

const TASK_LABEL = {
  task1: "Academic Writing Task 1 (report on a visual: graph/chart/table/map/process)",
  task1gt: "General Training Writing Task 1 (letter)",
  task2: "Writing Task 2 (essay)",
};

const TASK_CRITERION = {
  task1: `TASK ACHIEVEMENT (Academic Task 1) — an information-transfer task about the given visual only.
- Assess: selecting the key features; giving enough detail/figures to illustrate them; reporting data, figures and trends ACCURATELY (check against the visual when provided); comparing and highlighting main trends/differences instead of mechanically listing every number; appropriate format (full connected text).
- Overview: a clear overview of main trends/differences is expected for 7+; at 6 a relevant overview is at least attempted; without an overview the response tends to stay at 5 or below (focus on details without the bigger picture).
- No opinions, causes, predictions or speculation beyond the data — treat these as irrelevant content, not as a strength.
- Band anchors: 8 = key features skilfully selected and well illustrated; 7 = key features covered and clearly highlighted, clear overview, data appropriately grouped; 6 = key features adequately highlighted, overview attempted, some irrelevant/inaccurate details or details missing; 5 = key features not adequately covered, mechanical recounting, may lack supporting data; 4 = few key features, irrelevant/inaccurate content; 3 = misunderstands the visual.`,
  task1gt: `TASK ACHIEVEMENT (General Training Task 1 — letter)
- Assess: clear purpose of the letter; ALL three bullet points addressed and appropriately extended; appropriate letter format (opening/closing); tone (formal / semi-formal / informal) appropriate to the recipient and kept consistent.
- Band anchors: 8 = all bullets clearly presented and well extended; 7 = all bullets covered and clearly highlighted, clear purpose, consistent appropriate tone; 6 = all bullets covered and adequately highlighted, purpose generally clear, minor tone inconsistencies; 5 = all bullets presented but one or more not adequately covered, purpose sometimes unclear, tone variable; 4 = not all bullets presented, purpose unclear, tone may be inappropriate.`,
  task2: `TASK RESPONSE (Task 2)
- Assess: how fully ALL parts of the prompt are answered (e.g. "discuss both views AND give your opinion" needs both views plus an opinion; two-question prompts need both answered); a clear position where the prompt asks for one, maintained throughout; main ideas relevant, extended and supported; a clear opening and conclusion; appropriate format (full connected essay).
- Band anchors: 9 = explored in depth, fully developed position, ideas fully extended; 8 = sufficiently addressed, well-developed position, ideas well extended; 7 = main parts appropriately addressed, clear developed position, ideas extended but may over-generalise or lack focus; 6 = main parts addressed though unevenly, relevant position but conclusions may be unclear/repetitive, some ideas underdeveloped or support less relevant; 5 = main parts incompletely addressed, position expressed but development unclear, limited ideas, possible irrelevant detail or repetition; 4 = minimal or tangential response, position hard to find; 3 = prompt not adequately addressed or misunderstood.
- Ideas do NOT need to be original, interesting, or factually "true" in the real world; examples from personal experience are fully acceptable; real statistics or sources are not required.`,
};

const COMMON = `COHERENCE & COHESION
- Assess: logical organisation and progression; paragraphing that organises topics (one clear central topic per paragraph); logical sequencing within and across paragraphs; flexible use of reference and substitution (pronouns, "this/these", synonyms); discourse markers that mark stages and relationships.
- The NUMBER of linking words is not rewarded. Overused, mechanical or misused connectors are a weakness (typical of 6). Natural cohesion that "rarely attracts attention" is 9.
- Anchors: 8 = logically sequenced, cohesion well managed, paragraphing sufficient and appropriate; 7 = clear progression, range of cohesive devices with some over/under-use; 6 = generally coherent with clear overall progression, cohesion sometimes faulty or mechanical, paragraphing not always logical; 5 = organisation evident but not wholly logical, sentences not fluently linked, paragraphing may be inadequate or missing; 4 = no clear progression, basic devices, may lack paragraphing.

LEXICAL RESOURCE
- Assess: range (synonyms, avoiding repetition); appropriacy for the topic and register; precision of word choice; collocation and natural phrasing; density and impact of spelling and word-formation errors.
- There is NO requirement to use idioms, "big words" or academic jargon. Less common or idiomatic items are rewarded only when they are natural and appropriate; forced, misused or memorised-sounding phrases are a weakness. A "risk-taker" with wider range but more errors can still sit at 6.
- British and American spelling/vocabulary are BOTH correct — never flag either as an error.
- Anchors: 8 = wide, fluent, precise, skilful less common items, occasional slips; 7 = some flexibility and precision, some less common items, awareness of collocation, a few spelling/word-form errors that do not reduce clarity; 6 = adequate, meaning clear despite restricted range or imprecision, errors do not impede communication; 5 = limited but minimally adequate, frequent simplification/repetition, noticeable errors that may cause some difficulty; 4 = basic and repetitive, inappropriate memorised/formulaic chunks or copied input language, errors may impede meaning.

GRAMMATICAL RANGE & ACCURACY
- Assess: range of sentence structures (simple, compound, complex) appropriate to the task; accuracy of each type; density and communicative impact of grammatical errors; punctuation.
- There is NO requirement to use many different tenses — choose tenses appropriate to the content.
- Anchors: 8 = wide range used flexibly and accurately, majority of sentences error-free, occasional non-systematic errors; 7 = variety of complex structures with some flexibility, error-free sentences are frequent, a few errors that do not impede communication; 6 = mix of simple and complex forms with limited flexibility, complex forms less accurate, errors occur but rarely impede communication; 5 = limited, repetitive range, complex sentences attempted but faulty, frequent errors that cause some difficulty, faulty punctuation; 4 = very limited range, simple sentences dominate, frequent errors that may impede meaning.`;

const RULES = `HOW TO RATE (follow exactly)
1. Rate each of the four criteria independently, using only the criteria above. Do not let one weakness (e.g. spelling) lower other criteria.
2. BAND RANGES ARE GIVEN. The server has already analysed the response and, from countable evidence (proportion of error-free sentences, error density per 100 words, correct complex structures, less common vocabulary, task coverage, paragraphing, length), computed an allowed RANGE [lo–hi] for each criterion. Your job is to POSITION the band inside each range using what counting cannot capture:
   - Task: depth and relevance of development, how well ideas are extended and supported, clarity of the position throughout, over-generalisation.
   - Coherence: logical progression, how naturally ideas flow, referencing and substitution, whether linking is mechanical or natural, paragraph focus.
   - Lexical: precision, naturalness, collocation, register and style, flexibility, whether less common items are used skilfully or forced.
   - Grammar: flexibility and variety of structures, whether errors are systematic or occasional, how much they affect the reader.
   For EACH criterion write "position_reason" first (where in the range and why), then "band". Upper end of the range = these qualities are strong; lower end = weak; middle only when genuinely mixed. Do not drift to the lower end just because errors exist — error frequency is already reflected in the range. A band outside the range will be clamped by the server. Use .5 steps.
3. Errors are EXPECTED at high bands — do not lower a band because errors exist, only because of how frequent and how harmful they are:
   - Band 8: occasional, non-systematic errors and some clumsy expression are normal; the majority of sentences are error-free.
   - Band 7: a few errors and some inappropriate word choices/collocations; error-free sentences are frequent; meaning always clear.
   - Band 6: errors are noticeable but rarely impede communication.
   - Band 5 and below: errors are frequent and cause difficulty for the reader.
   Ask "how often, and does it affect communication?" — not "is there an error?". A handful of spelling slips or one missing article in an otherwise fluent, well-controlled essay is still Band 7–8 language.
4. Common over-penalties to avoid: dropping Coherence below 7 only because linkers are a bit mechanical when progression is clear; dropping Lexical Resource below 7 for a few slips when the range is wide and some less common items are used well; dropping Task Response below 7 when a clear position is developed and an alternative view is considered, just because examples are general (general examples are acceptable).
5. Length: there is NO automatic band cap for being under the minimum (Task 1: 150 words, Task 2: 250 words) — that fixed penalty no longer exists. Instead judge the consequences: under-length usually means insufficient coverage/development (Task Achievement/Response) and less evidence of range (Lexical Resource, Grammar). Being significantly under-length can push Lexical Resource to 3. A response of 20 words or fewer is Band 1 on every criterion. Writing more than the minimum is never penalised.
6. Language copied from the prompt does not count as the candidate's own language: discount it in word count and when judging vocabulary and grammar.
7. Bullet points or note form in any part of the response is an inappropriate format and must be reflected in Task Achievement/Response.
8. Memorised language / plagiarism: only comment on it when there is clear evidence (e.g. a generic pre-prepared paragraph unrelated to the specific prompt). Never accuse without evidence.
9. Off-topic or tangential responses are limited in Task Achievement/Response (4 or below) regardless of language quality.

DO NOT assess (these are NOT IELTS criteria — common myths)
- Whether ideas are interesting, original, persuasive or factually correct in the real world (Task 2).
- Use of idioms, rare words, or a quota of "advanced" vocabulary.
- Number of linking words, number of tenses, a fixed number of paragraphs, a title, or a specific template ("restate the question", "In conclusion" phrases).
- British vs American spelling, use of "I"/personal examples, handwriting neatness.
- Contractions: at most a minor register remark, never a grammar error.

THE TEXT IS TYPED OR A STUDENT-VERIFIED TRANSCRIPTION OF HANDWRITING
- Ignore line breaks, hyphenation at line ends and spacing artefacts. Judge paragraphing only from clear blank-line paragraph breaks.

FEEDBACK RULES
- Each criterion comment must: (a) name the main descriptor features that decided the band, citing evidence from the response, and (b) say concretely what is needed to reach the next band. Do not mention the server, ranges or rules that are not in this prompt.
- Write comments, strengths and improvements in clear Vietnamese for Vietnamese learners; keep quoted English in English. Be specific; avoid generic advice ("use more advanced vocabulary") unless tied to a quoted example.`;

// Quy tắc liệt kê lỗi (bước 1)
const ERROR_RULES = `ERRORS — list up to 30 genuine errors, in the order they appear. Accuracy over quantity:
- original: the shortest exact span from the response that contains the error, copied character for character (max ~12 words). Never quote text that is not in the response.
- Only list genuine errors. If you are not sure something is wrong, leave it out. Never "correct" something that is already correct English (valid alternatives, US/UK variants, acceptable informal-but-correct usage, contractions).
- correction: minimal (fix the error, keep the student's meaning and wording) and itself correct.
- type: grammar | spelling (incl. word formation) | punctuation | word_choice (wrong word/collocation that changes or blurs meaning) | information (Task 1: data/figures/trends reported inaccurately or content not in the visual; Task 2: irrelevant/off-task content) | coherence (wrong/misused linker, unclear reference) | redundancy (unnecessary repeated or extra words) | naturalness (correct but awkward, unidiomatic or wrong register).
- severity "major" = a real error that counts against the band: grammar errors (agreement, tense, verb form, articles that change meaning, word order), spelling/word-formation errors, punctuation that breaks the sentence (run-on, comma splice, missing full stop), wrong word that changes or blurs meaning, inaccurate information/data, a misused linker.
- severity "minor" = little band impact: redundancy ("In my opinion, I think"), repetition, awkward but understandable phrasing, slightly unnatural collocation, informal register, stylistic polish. Type redundancy and naturalness are ALWAYS minor. When in doubt between major and minor, choose minor.
- explanation: in clear Vietnamese for Vietnamese learners (keep quoted English in English).`;

// Kho bài mốc (bài thật có band giám khảo) — file riêng, không đưa lên Git
// { anchors: [{ id, taskType, band, source, prompt, text, why }] }
import fs from "node:fs";
import { requirementsPrompt } from "./requirements.js";
let ANCHOR_BANK = [];
try {
  const a = JSON.parse(fs.readFileSync(new URL("./anchors.local.json", import.meta.url), "utf8"));
  // Định dạng cũ: { prompt, essays: [{ band, text, why }] } — coi là Task 2
  ANCHOR_BANK = a.anchors ?? a.essays.map((e, i) => ({ id: `old-${i + 1}`, taskType: "task2", prompt: a.prompt, ...e }));
} catch {}

// Chọn tối đa 4 bài cùng dạng đề, rải đều các band mục tiêu (ưu tiên có bài band cao)
const ANCHOR_TARGETS = [5, 6, 7, 8];
export function pickAnchors(taskType) {
  const pool = ANCHOR_BANK.filter((x) => x.taskType === taskType);
  const chosen = [];
  for (const target of ANCHOR_TARGETS) {
    const best = pool
      .filter((x) => !chosen.includes(x))
      .sort((x, y) => Math.abs(x.band - target) - Math.abs(y.band - target) || y.band - x.band)[0];
    if (best) chosen.push(best);
  }
  return chosen.sort((x, y) => x.band - y.band);
}

function anchorsBlock(taskType) {
  const list = pickAnchors(taskType);
  if (!list.length) return "";
  // Gộp theo đề để không lặp lại đề bài
  const prompts = [...new Set(list.map((x) => x.prompt))];
  return `CALIBRATION EXAMPLES — real candidate scripts with the overall band awarded by certified IELTS examiners (official IELTS sample materials, 2023 edition). Use them ONLY to calibrate where each band sits — in particular how many errors a Band 8+ script can still contain while keeping its band. Do not let their topics or ideas influence your judgement of the candidate's content. Never mention them or copy their content in your feedback.
${prompts
  .map(
    (p, i) => `=== Calibration prompt ${String.fromCharCode(65 + i)} ===
${p}
${list
  .filter((x) => x.prompt === p)
  .map((x) => `--- Example script: examiner overall band ${x.band} ---
${x.text}
Examiner reasoning: ${x.why}`)
  .join("\n\n")}`,
  )
  .join("\n\n")}`;
}

const taskOf = (taskType) => (TASK_CRITERION[taskType] ? taskType : "task2");

// Bước 1: AI chỉ thu thập dữ kiện (lỗi, cấu trúc, từ vựng, mức trả lời đề) — KHÔNG cho điểm
export function analysisSystemPrompt(taskType) {
  const t = taskOf(taskType);
  return `You are a trained IELTS Writing examiner preparing the evidence for marking a candidate's ${TASK_LABEL[t]}. Do NOT give any band scores in this step — only record observable facts accurately. The criteria below (IELTS Writing band descriptors, public version updated May 2023) tell you what matters.

${TASK_CRITERION[t]}

${COMMON}

The text may be typed or a student-verified transcription of handwriting: ignore line breaks, hyphenation at line ends and spacing artefacts.

WHAT TO RECORD
${t === "task1"
    ? `- question_type: report. requirements, ideas: empty lists. conclusion: not_applicable. position: not_required. (Academic Task 1 is judged by overview and key_features below.)
- overview — judge the candidate's overview against the visual:
  clear = a separate overview (usually starting "Overall") that states at least TWO main trends/differences/comparisons covering the whole visual, without detailed figures;
  attempted = an overview exists but states only one main feature, mixes in detailed figures, or is vague/general;
  missing = no overview of the main trends.
- overview_accurate: yes if the main trends stated in the overview match the visual; no if a main trend is reversed, wrong or misleading (e.g. says a line rose when it mainly fell); not_applicable if the overview is missing.
- key_features: from the VISUAL itself (not from the response), list the 3–5 most important features a good report must mention (main trends, highest/lowest, notable peaks, crossovers or reversals, for maps/processes the main changes or stages). For each: covered (reported correctly, even briefly) or missed (not reported, or reported wrongly).
- If no visual is provided, return key_features as an empty list and overview_accurate as not_applicable, and do not report "information" errors you cannot verify.
- Data accuracy: every figure, year, trend or comparison in the response that contradicts the visual is an error of type "information" — severity major if it misreports a figure, year or direction of change; minor if it is only a slightly loose approximation.
- data_support: adequate = the main features are supported with figures/data from the visual; limited = only a few figures, or most descriptions have no data; none = no figures/data at all (for processes/maps with no numbers, judge whether stages/changes are described specifically: adequate if yes).
- format_issues: list any inappropriate format features, e.g. letter-style opening or closing, personal opinions or comments, causes/predictions/speculation beyond the visual, a conclusion giving the writer's view, bullet points. Empty list if none.
- letter_opening, letter_closing, tone: not_applicable.`
    : `${requirementsPrompt(t)}
- position: clear | unclear | contradictory (the stated view changes or conflicts between introduction, body and conclusion) | missing (when the prompt asks for an opinion/judgement), or not_required.
${t === "task2"
  ? `- ideas: list each MAIN idea of the body paragraphs (short label) with development: developed = explained and extended (reason → explanation → example/result); listed = only named or stated in one sentence without explanation; overgeneralised = explained but with sweeping, absolute or unsupported claims (e.g. "they will suffer from obesity").
- conclusion: present (a concluding paragraph or sentence that answers the question) | missing.`
  : `- ideas: empty list. conclusion: not_applicable.`}
- overview, overview_accurate: not_applicable. key_features: empty list. data_support: not_applicable.
- format_issues: ${t === "task1gt" ? "list any inappropriate format features of the letter (e.g. essay-style writing, bullet points)" : "list bullet points or note form if used"}; empty list if none.
- letter_opening, letter_closing: ${t === "task1gt" ? "present if the letter has an appropriate greeting (e.g. 'Dear Mr Smith,') / an appropriate closing line and sign-off (e.g. 'Yours sincerely,' or 'Best wishes,' plus a name); missing otherwise" : "not_applicable"}.
- tone: ${t === "task1gt" ? "consistent = the register (formal / semi-formal / informal) suits the recipient and stays the same throughout; minor_inconsistency = mostly appropriate with a few slips; inappropriate = register clearly wrong for the recipient or varies a lot" : "not_applicable"}.`}
- off_topic: true only if the response is mainly irrelevant to the prompt. note_form: true if any part uses bullet points or note form.
- copied_from_prompt: exact spans (6+ words) the candidate copied from the prompt.
- complex_correct: up to 15 complex SENTENCES used WITHOUT grammatical error. A sentence counts only if it contains a real subordinate clause: relative clause (who/which/that/where…), adverbial clause (when/because/although/while/if/unless/before/after/so that…), noun clause (that/what/whether… as subject or object), conditional, or a participle clause standing for a clause ("Having finished…", "…, reaching a peak of…"). A long simple sentence, a list of phrases, a passive, an infinitive of purpose, or "and/but" coordination alone does NOT count. For each give a short quote and its type: relative | adverbial | noun_clause | conditional | participle | comparative | other.
- complex_faulty: up to 15 complex sentences (same definition) that were attempted but contain a grammatical error; give a short quote and its type.
- less_common_correct: up to 15 less common words, precise collocations or idiomatic items used correctly and naturally (not ordinary everyday words, not words copied from the prompt).

${ERROR_RULES}`;
}

// Bước 2: AI định vị band TRONG khung do code tính, viết nhận xét và bài viết lại
export function positioningSystemPrompt(taskType) {
  const t = taskOf(taskType);
  return `You are a trained, certified IELTS Writing examiner. Assess the candidate's ${TASK_LABEL[t]} against the current IELTS Writing band descriptors (public version, updated May 2023) and the IELTS Writing key assessment criteria, summarised below. These are the ONLY standards you may use.

${TASK_CRITERION[t]}

${COMMON}

${RULES}

${anchorsBlock(t)}

OUTPUT
- "task" = ${t === "task2" ? "Task Response" : "Task Achievement"}, "coherence" = Coherence & Cohesion, "lexical" = Lexical Resource, "grammar" = Grammatical Range & Accuracy. For each: position_reason (brief, English), band (inside the given range), comment (Vietnamese). The overall band is computed by the server.
- strengths, improvements: 2–4 items each, Vietnamese.
- improved_version: rewrite at about Band 7.5, keeping the student's ideas, position and structure so they can compare (for Academic Task 1 use only data that the student reported or that is visible in the visual).`;
}
