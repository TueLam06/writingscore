import { fmtBand, TASK_NAME } from "../lib/format.js";

const fmtDate = (iso) => {
  if (!iso) return "–";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Bài AI đã chấm, đang chờ giáo viên duyệt (bài nộp sớm nhất lên đầu)
export default function ReviewQueue({ subs, assignments, users, onOpen }) {
  const pending = subs
    .filter((s) => s.status === "graded")
    .sort((a, b) => (a.submittedAt || "").localeCompare(b.submittedAt || ""));

  if (!pending.length) return <div className="card empty">Không còn bài nào chờ duyệt.</div>;

  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Học viên</th><th>Bài tập</th><th>Loại</th><th>AI chấm</th><th>Nộp lúc</th></tr>
          </thead>
          <tbody>
            {pending.map((s) => {
              const a = assignments.find((x) => x.id === s.assignmentId);
              const st = users.find((u) => u.id === s.studentId);
              return (
                <tr
                  key={s.id}
                  className="click"
                  tabIndex={0}
                  onClick={() => onOpen(s)}
                  onKeyDown={(e) => e.key === "Enter" && onOpen(s)}
                >
                  <td><b>{st?.name ?? s.studentId}</b></td>
                  <td>{a?.title ?? "(đã xoá)"}</td>
                  <td><span className="pill">{TASK_NAME[a?.taskType] || "Task 2"}</span></td>
                  <td>{fmtBand(s.grade?.overall_band)}</td>
                  <td className="muted">{fmtDate(s.submittedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
