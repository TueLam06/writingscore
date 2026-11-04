import { useState } from "react";
import { api } from "../lib/api.js";
import { compressImage } from "../lib/image.js";
import { ZoomImg } from "./Zoom.jsx";

// assignment: bài tập cần sửa (không truyền = giao bài mới)
export default function AssignmentForm({ assignment: a = null, onSaved, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.target);
    const img = fd.get("promptImage");
    if (img && img.size) fd.set("promptImage", await compressImage(img));
    else fd.delete("promptImage");
    try {
      const saved = await api(a ? `/api/assignments/${a.id}` : "/api/assignments", { method: a ? "PUT" : "POST", body: fd });
      await onSaved(saved);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>{a ? "Sửa bài tập" : "Giao bài mới"}</h2>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="f-title">Tiêu đề</label>
          <input id="f-title" name="title" required placeholder="VD: Task 2 – Education" defaultValue={a?.title || ""} />
        </div>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="field grow">
            <label htmlFor="f-type">Loại bài</label>
            <select id="f-type" name="taskType" defaultValue={a?.taskType || "task2"}>
              <option value="task2">Task 2 – Essay</option>
              <option value="task1">Task 1 Academic – Report (biểu đồ)</option>
              <option value="task1gt">Task 1 General – Letter (thư)</option>
            </select>
          </div>
          <div className="field grow">
            <label htmlFor="f-due">Hạn nộp</label>
            <input id="f-due" type="date" name="dueDate" defaultValue={a?.dueDate || ""} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="f-prompt">Đề bài</label>
          <textarea id="f-prompt" name="prompt" rows={6} required defaultValue={a?.prompt || ""} />
        </div>
        <div className="field">
          <label htmlFor="f-img">
            Ảnh biểu đồ/bản đồ (cho Task 1, không bắt buộc){a?.promptImage ? " – chọn ảnh mới để thay" : ""}
          </label>
          {a?.promptImage && (
            <div className="row" style={{ marginBottom: 6 }}>
              <ZoomImg src={`/uploads/${a.promptImage}`} alt="Ảnh đề hiện tại" style={{ height: 80, borderRadius: 8, border: "1px solid var(--line)", cursor: "zoom-in" }} />
              <label className="row" style={{ gap: 6, fontSize: 14 }}>
                <input type="checkbox" name="removeImage" value="1" /> Bỏ ảnh này
              </label>
            </div>
          )}
          <input id="f-img" type="file" name="promptImage" accept="image/*,.heic,.heif" />
        </div>
        {error && <div className="notice bad" style={{ marginBottom: 12 }}>{error}</div>}
        <div className="row">
          <button className="btn primary" disabled={busy}>{a ? "Lưu thay đổi" : "Giao bài"}</button>
          <button type="button" className="btn" onClick={onCancel}>Huỷ</button>
        </div>
      </form>
    </div>
  );
}
