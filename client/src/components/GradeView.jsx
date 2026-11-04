import { useState } from "react";
import { annotate, ERR_TYPE, severityOf } from "../lib/errors.js";
import { fmtBand } from "../lib/format.js";

const CRITERIA = [
  ["task", "Task Response"],
  ["coherence", "Coherence & Cohesion"],
  ["lexical", "Lexical Resource"],
  ["grammar", "Grammar Range & Accuracy"],
];

function Scores({ g, taskType }) {
  const name = (k, n) => (k === "task" && taskType && taskType !== "task2" ? "Task Achievement" : n);
  return (
    <div className="scores">
      <div className="score overall">
        <div className="name">Band tổng (AI)</div>
        <div className="val">{fmtBand(g.overall_band)}</div>
        {g.band_range && <div className="sub">khung {fmtBand(g.band_range[0])}–{fmtBand(g.band_range[1])}</div>}
        <div className="bar" />
      </div>
      {CRITERIA.map(([k, n]) => (
        <div className="score" key={k}>
          <div className="name">{name(k, n)}</div>
          <div className="val">{fmtBand(g[k].band)}</div>
          {g[k].range && <div className="sub">khung {fmtBand(g[k].range[0])}–{fmtBand(g[k].range[1])}</div>}
        </div>
      ))}
    </div>
  );
}

// Bài làm có tô lỗi; bấm vào chỗ tô màu hoặc vào lời giải thích để làm nổi bật cặp tương ứng
function AnnotatedEssay({ text, errors }) {
  const [active, setActive] = useState(null);
  const { parts, found } = annotate(text, errors);
  const major = errors.filter((e) => severityOf(e) === "major").length;

  const pick = (i, from) => {
    setActive(i);
    const target = document.querySelector(from === "essay" ? `#err-item-${i}` : `#err-mark-${i}`);
    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Bài viết · {errors.length ? `${errors.length} lỗi` : "không có lỗi đáng kể"}</h2>
        <div className="legend">
          <span><i className="major" />Lỗi nặng ({major})</span>
          <span><i className="minor" />Lỗi nhẹ ({errors.length - major})</span>
        </div>
      </div>
      <div className="essay">
        {parts.map((p, idx) =>
          p.err == null ? (
            <span key={idx}>{p.text}</span>
          ) : (
            <button
              type="button"
              key={idx}
              id={`err-mark-${p.err}`}
              className={`err ${severityOf(errors[p.err])} ${active === p.err ? "active" : ""}`}
              title={errors[p.err].correction}
              onClick={() => pick(p.err, "essay")}
            >
              {p.text}<sup>{p.err + 1}</sup>
            </button>
          ),
        )}
      </div>
      {errors.length > 0 && (
        <>
          <h3>Lỗi cần sửa</h3>
          <ol className="errlist">
            {errors.map((e, i) => (
              <li key={i} id={`err-item-${i}`} className={active === i ? "active" : ""} onClick={() => pick(i, "list")}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="muted">{i + 1}.</span>
                  <span className={`pill ${severityOf(e) === "major" ? "bad" : "warn"}`}>{ERR_TYPE[e.type] || e.type}</span>
                  <span>“{e.original}” → <span className="fix">{e.correction}</span></span>
                  {!found.has(i) && <span className="muted">(không tìm thấy vị trí trong bài)</span>}
                </div>
                <div className="muted" style={{ marginTop: 4 }}>{e.explanation}</div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

export default function GradeView({ g, text, taskType }) {
  return (
    <>
      <Scores g={g} taskType={taskType} />
      <div className="muted">
        {g.word_count} từ{g.model ? ` · chấm bởi ${g.model}` : ""}
      </div>
      {text && <AnnotatedEssay text={text} errors={g.errors} />}
      <div className="card">
        <h2>Nhận xét theo tiêu chí</h2>
        {CRITERIA.map(([k, n]) => (
          <div key={k} className="criteria">
            <h3>{n} – {fmtBand(g[k].band)}</h3>
            {g[k].range_reason && (
              <div className="muted">Khung {fmtBand(g[k].range[0])}–{fmtBand(g[k].range[1])}: {g[k].range_reason.join("; ")}</div>
            )}
            <div>{g[k].comment}</div>
          </div>
        ))}
        <h3>Điểm mạnh</h3>
        <ul>{g.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
        <h3>Cần cải thiện</h3>
        <ul>{g.improvements.map((x, i) => <li key={i}>{x}</li>)}</ul>
        {g.improved_version && (
          <details>
            <summary>Xem bài viết mẫu đã cải thiện (~Band 7.5)</summary>
            <div className="improved">{g.improved_version}</div>
          </details>
        )}
      </div>
    </>
  );
}
