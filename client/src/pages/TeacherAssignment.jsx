import { useCallback, useEffect, useRef, useState } from "react";
import { api, postJson } from "../lib/api.js";
import { fmtBand, STATUS, TASK_NAME } from "../lib/format.js";
import { ZoomImg } from "../components/Zoom.jsx";
import GradeView from "../components/GradeView.jsx";
import PromptBlock from "../components/PromptBlock.jsx";

export default function TeacherAssignment({ assignment: a, users, onEdit, onDeleted }) {
  const [subs, setSubs] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [notice, setNotice] = useState("");
  const students = users.filter((u) => u.role === "student");

  const load = useCallback(() => api(`/api/submissions?assignmentId=${a.id}`).then(setSubs), [a.id]);
  useEffect(() => { load(); }, [load]);

  const done = subs.filter((s) => ["graded", "reviewed"].includes(s.status)).length;
  const openSub = subs.find((s) => s.id === openId);

  const remove = async () => {
    if (!confirm("Xoá bài tập này và toàn bộ bài nộp?")) return;
    await api(`/api/assignments/${a.id}`, { method: "DELETE" });
    onDeleted();
  };

  return (
    <>
      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <div className="grow muted">
            {TASK_NAME[a.taskType] || "Task 2"} · {a.dueDate ? `Hạn ${a.dueDate}` : "Không hạn"} · Đã nộp {done}/{students.length}
          </div>
          <button type="button" className="btn small" onClick={onEdit}>Sửa</button>
          <button type="button" className="btn small danger" onClick={remove}>Xoá</button>
        </div>
        <PromptBlock a={a} />
      </div>

      <div className="card">
        <h2>Bài nộp của học viên</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Học viên</th><th>Trạng thái</th><th>AI chấm</th><th>Điểm GV</th></tr>
            </thead>
            <tbody>
              {students.map((st) => {
                const s = subs.find((x) => x.studentId === st.id);
                const status = STATUS[s?.status || "draft"];
                const clickable = !!s?.grade;
                return (
                  <tr
                    key={st.id}
                    className={clickable ? "click" : ""}
                    onClick={clickable ? () => { setNotice(""); setOpenId(s.id); } : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onKeyDown={clickable ? (e) => e.key === "Enter" && setOpenId(s.id) : undefined}
                  >
                    <td><b>{st.name}</b></td>
                    <td>
                      <span className={`pill ${status.tone}`}>{status.label}</span>
                      {s?.editedAfterOcr && <> <span className="pill warn" title="Học viên đã sửa bản chép từ ảnh">đã sửa bản chép</span></>}
                    </td>
                    <td>{fmtBand(s?.grade?.overall_band)}</td>
                    <td>{fmtBand(s?.review?.band)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {notice && <div className="notice ok">{notice}</div>}
      {openSub && (
        <TeacherSubmission
          key={openSub.id}
          s={openSub}
          a={a}
          student={users.find((u) => u.id === openSub.studentId)}
          onReviewed={async (name) => { await load(); setOpenId(null); setNotice(`Đã lưu điểm duyệt cho ${name}.`); }}
        />
      )}
    </>
  );
}

function TeacherSubmission({ s, a, student, onReviewed }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth" }); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.target);
    try {
      await postJson(`/api/submissions/${s.id}/review`, { band: fd.get("band"), comment: fd.get("comment") });
      await onReviewed(student.name);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card" ref={ref}>
        <h2>Bài của {student.name}</h2>
        {s.images.length ? (
          <>
            <h3>Ảnh bài viết tay</h3>
            <div className="thumbs">{s.images.map((n) => <ZoomImg key={n} src={`/uploads/${n}`} alt="Trang bài viết tay" />)}</div>
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Học viên tự gõ bài (không có ảnh).</p>
        )}
        {s.editedAfterOcr && (
          <>
            <div className="notice warn" style={{ marginTop: 12 }}>
              Học viên đã sửa bản chép do AI đọc từ ảnh. Hãy so với ảnh gốc để chắc học viên chỉ sửa chỗ máy đọc nhầm, không chữa lỗi của chính mình.
            </div>
            <details>
              <summary>Xem bản AI đọc từ ảnh (trước khi học viên sửa)</summary>
              <div className="prompt">{s.ocr.transcript}</div>
            </details>
          </>
        )}
      </div>

      <GradeView g={s.grade} text={s.text} taskType={a.taskType} />

      <div className="card">
        <h2>Giáo viên duyệt</h2>
        <form onSubmit={submit}>
          <div className="field" style={{ maxWidth: 180 }}>
            <label htmlFor="r-band">Band cuối cùng</label>
            <input id="r-band" name="band" type="number" min="0" max="9" step="0.5" defaultValue={s.review?.band ?? s.grade.overall_band} />
          </div>
          <div className="field">
            <label htmlFor="r-comment">Nhận xét của giáo viên</label>
            <textarea id="r-comment" name="comment" rows={3} defaultValue={s.review?.comment || ""} />
          </div>
          {error && <div className="notice bad" style={{ marginBottom: 12 }}>{error}</div>}
          <button className="btn primary" disabled={busy}>{s.review ? "Cập nhật" : "Duyệt & trả bài"}</button>
        </form>
      </div>
    </>
  );
}
