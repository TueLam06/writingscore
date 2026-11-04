import { STATUS, TASK_NAME } from "../lib/format.js";

export default function AssignmentList({ assignments, mySubs, me, selected, onOpen }) {
  if (!assignments.length) return <div className="card muted">Chưa có bài tập nào.</div>;
  return (
    <div className="list">
      {assignments.map((a) => {
        let pill = <span className="pill">{TASK_NAME[a.taskType] || "Task 2"}</span>;
        if (me.role === "student") {
          const s = mySubs.find((x) => x.assignmentId === a.id);
          const st = STATUS[s?.status || "draft"];
          pill = <span className={`pill ${st.tone}`}>{st.label}</span>;
        }
        return (
          <button type="button" key={a.id} className={`list-item ${selected === a.id ? "active" : ""}`} onClick={() => onOpen(a.id)}>
            <b>{a.title}</b>
            <div className="row">
              <span className="muted grow">{a.dueDate ? `Hạn: ${a.dueDate}` : "Không hạn"}</span>
              {pill}
            </div>
          </button>
        );
      })}
    </div>
  );
}
