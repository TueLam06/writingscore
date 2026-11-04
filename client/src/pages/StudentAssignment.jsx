import { useCallback, useEffect, useState } from "react";
import { api, postJson } from "../lib/api.js";
import { compressImage, isHeic } from "../lib/image.js";
import { fmtBand, minWordsOf, TASK_NAME, wordCount } from "../lib/format.js";
import { ZoomImg } from "../components/Zoom.jsx";
import PromptBlock from "../components/PromptBlock.jsx";
import GradeView from "../components/GradeView.jsx";

export default function StudentAssignment({ assignment: a, me, onChanged }) {
  const [sub, setSub] = useState(null);
  const [redo, setRedo] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    () => postJson("/api/submissions", { assignmentId: a.id, studentId: me.id }).then(setSub).catch((e) => setError(e.message)),
    [a.id, me.id],
  );
  useEffect(() => { load(); }, [load]);

  const changed = async (updated) => {
    setSub(updated);
    setRedo(false);
    await onChanged();
  };

  const head = (
    <div className="card">
      <div className="muted" style={{ marginBottom: 8 }}>
        {TASK_NAME[a.taskType] || "Task 2"} – ít nhất {minWordsOf(a)} từ · {a.dueDate ? `Hạn ${a.dueDate}` : "Không hạn"}
      </div>
      <PromptBlock a={a} />
    </div>
  );

  if (error) return <>{head}<div className="notice bad">{error}</div></>;
  if (!sub) return <>{head}<div className="card muted"><span className="spinner" /> Đang tải…</div></>;

  const finished = (sub.status === "graded" || sub.status === "reviewed") && !redo;
  if (finished) {
    return (
      <>
        {head}
        {sub.review ? (
          <div className="card">
            <h2>Giáo viên đã chấm: Band {fmtBand(sub.review.band)}</h2>
            {sub.review.comment && <div className="prompt">{sub.review.comment}</div>}
          </div>
        ) : (
          <div className="notice info">AI đã chấm xong. Giáo viên sẽ xem và duyệt điểm cuối cùng.</div>
        )}
        {sub.status === "graded" && (
          <div className="row">
            <button type="button" className="btn" onClick={() => setRedo(true)}>Làm lại & nộp lại</button>
          </div>
        )}
        <GradeView g={sub.grade} text={sub.text} taskType={a.taskType} />
      </>
    );
  }

  return (
    <>
      {head}
      <StudentEditor a={a} sub={redo ? { ...sub, status: "draft" } : sub} onSaved={changed} />
    </>
  );
}

function StudentEditor({ a, sub, onSaved }) {
  const hasTranscript = sub.status === "transcribed";
  const minWords = minWordsOf(a);
  const [typing, setTyping] = useState(false);
  const [files, setFiles] = useState([]);
  const [text, setText] = useState(hasTranscript ? sub.text : "");
  const [ocrState, setOcrState] = useState({ busy: false, error: "" });
  const [gradeState, setGradeState] = useState({ busy: false, error: "" });
  const n = wordCount(text);

  const runOcr = async () => {
    if (!files.length) return setOcrState({ busy: false, error: "Hãy chọn ít nhất 1 ảnh." });
    if (files.length > 6) return setOcrState({ busy: false, error: "Tối đa 6 ảnh." });
    setOcrState({ busy: true, error: "" });
    try {
      const fd = new FormData();
      for (const f of files) fd.append("pages", await compressImage(f));
      const updated = await api(`/api/submissions/${sub.id}/transcribe`, { method: "POST", body: fd });
      setText(updated.text);
      setTyping(false);
      setOcrState({ busy: false, error: "" });
      await onSaved(updated);
    } catch (err) {
      setOcrState({ busy: false, error: err.message });
    }
  };

  const grade = async () => {
    setGradeState({ busy: true, error: "" });
    try {
      const updated = await postJson(`/api/submissions/${sub.id}/grade`, { text });
      await onSaved(updated);
    } catch (err) {
      setGradeState({ busy: false, error: err.message });
    }
  };

  return (
    <>
      <div className="card">
        <h2>Bước 1 – Chụp bài viết tay</h2>
        <p className="muted" style={{ marginTop: 0 }}>Chụp thẳng, đủ sáng, mỗi trang một ảnh, chọn theo đúng thứ tự trang (tối đa 6 ảnh).</p>
        <div className="row">
          <label htmlFor="pages" className="sr-only" style={{ position: "absolute", left: -9999 }}>Chọn ảnh bài viết</label>
          <input id="pages" type="file" accept="image/*,.heic,.heif" multiple className="grow" onChange={(e) => setFiles([...e.target.files])} />
          <button type="button" className="btn primary" disabled={ocrState.busy} onClick={runOcr}>AI đọc bài</button>
        </div>
        {files.length > 0 && (
          <div className="thumbs" style={{ marginTop: 10 }}>
            {files.map((f) => (isHeic(f) ? <span key={f.name} className="pill">{f.name}</span> : <ZoomImg key={f.name} src={URL.createObjectURL(f)} alt={f.name} />))}
          </div>
        )}
        <p className="muted" style={{ marginBottom: 0 }}>
          Hoặc <button type="button" className="link-btn" onClick={() => setTyping(true)}>tự gõ bài trên máy</button> (bỏ qua bước chụp ảnh).
        </p>
        {ocrState.busy && <div className="notice info" style={{ marginTop: 12 }}><span className="spinner" /> AI đang đọc chữ viết tay… (khoảng 10–40 giây)</div>}
        {ocrState.error && <div className="notice bad" style={{ marginTop: 12 }}>{ocrState.error}</div>}
      </div>

      {(hasTranscript || typing) && (
        <div className="card">
          <h2>Bước 2 – Soát bản chép & nộp chấm</h2>
          {hasTranscript && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              <div className="notice warn">Chỉ sửa những chỗ <b>AI đọc nhầm</b> so với ảnh. Không chữa lỗi của chính bạn – giáo viên sẽ thấy những chỗ bạn đã sửa.</div>
              {sub.ocr.model && <div className="muted">Bản chép do <b>{sub.ocr.model}</b> đọc từ ảnh.</div>}
              {sub.ocr.legibility === "poor" && <div className="notice bad">Ảnh/chữ khá khó đọc. Nên chụp lại rõ hơn để AI đọc chính xác.</div>}
              {sub.ocr.unclear?.length > 0 && (
                <div className="notice info">
                  <b>Những chỗ AI không chắc:</b>
                  <ul style={{ margin: "4px 0" }}>{sub.ocr.unclear.map((u, i) => <li key={i}><b>{u.text}</b> – {u.note}</li>)}</ul>
                </div>
              )}
            </div>
          )}
          <div className={hasTranscript ? "split" : ""}>
            {hasTranscript && <div className="imgcol">{sub.images.map((img) => <ZoomImg key={img} src={`/uploads/${img}`} alt="Trang bài viết tay" />)}</div>}
            <div>
              <label htmlFor="essay" className="muted">Bài viết</label>
              <textarea id="essay" rows={18} value={text} onChange={(e) => setText(e.target.value)} autoFocus={typing} />
              <div className="muted">
                {n} từ {n < minWords && <span style={{ color: "var(--bad)" }}>(dưới {minWords} từ – sẽ bị trừ điểm)</span>}
              </div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button type="button" className="btn primary" disabled={gradeState.busy} onClick={grade}>Nộp bài & chấm điểm</button>
            {gradeState.busy && <span className="notice info"><span className="spinner" /> AI đang chấm… (khoảng 20–60 giây)</span>}
            {gradeState.error && <span className="notice bad">{gradeState.error}</span>}
          </div>
        </div>
      )}
    </>
  );
}
