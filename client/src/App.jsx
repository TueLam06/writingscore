import { useCallback, useEffect, useState } from "react";
import { api } from "./lib/api.js";
import { ZoomProvider } from "./components/Zoom.jsx";
import Sidebar from "./components/Sidebar.jsx";
import AssignmentList from "./components/AssignmentList.jsx";
import AssignmentForm from "./components/AssignmentForm.jsx";
import TeacherAssignment from "./pages/TeacherAssignment.jsx";
import StudentAssignment from "./pages/StudentAssignment.jsx";

export default function App() {
  const [meta, setMeta] = useState(null);
  const [meId, setMeId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [mySubs, setMySubs] = useState([]);
  const [selected, setSelected] = useState(null); // id bài tập đang mở
  const [mode, setMode] = useState("view"); // view | new | edit
  const [error, setError] = useState("");

  const me = meta?.users.find((u) => u.id === meId);

  useEffect(() => {
    api("/api/meta")
      .then((m) => {
        setMeta(m);
        const saved = localStorage.getItem("me");
        setMeId(m.users.some((u) => u.id === saved) ? saved : m.users[0].id);
      })
      .catch((e) => setError(`Không tải được dữ liệu: ${e.message}`));
  }, []);

  const reload = useCallback(async () => {
    if (!me) return;
    setAssignments(await api("/api/assignments"));
    setMySubs(me.role === "student" ? await api(`/api/submissions?studentId=${me.id}`) : []);
  }, [me]);

  useEffect(() => {
    setSelected(null);
    setMode("view");
    reload().catch((e) => setError(e.message));
  }, [reload]);

  const switchUser = (id) => {
    localStorage.setItem("me", id);
    setMeId(id);
  };

  const open = (id) => { setSelected(id); setMode("view"); };
  const assignment = assignments.find((a) => a.id === selected);

  let detail;
  if (mode === "new") {
    detail = <AssignmentForm onCancel={() => setMode("view")} onSaved={async (a) => { await reload(); open(a.id); }} />;
  } else if (mode === "edit" && assignment) {
    detail = <AssignmentForm assignment={assignment} onCancel={() => setMode("view")} onSaved={async (a) => { await reload(); open(a.id); }} />;
  } else if (assignment && me.role === "teacher") {
    detail = (
      <TeacherAssignment
        key={assignment.id}
        assignment={assignment}
        users={meta.users}
        onEdit={() => setMode("edit")}
        onDeleted={async () => { await reload(); setSelected(null); }}
      />
    );
  } else if (assignment) {
    detail = <StudentAssignment key={`${assignment.id}-${me.id}`} assignment={assignment} me={me} onChanged={reload} />;
  } else {
    detail = <div className="card empty">Chọn một bài tập trong danh sách.</div>;
  }

  return (
    <ZoomProvider>
      <div className="shell">
        <Sidebar meta={meta} me={me} onSwitchUser={switchUser} />
        <main className="main">
          {error && <div className="notice bad" style={{ marginBottom: 16 }}>{error}</div>}
          {me && (
            <>
              <div className="page-head">
                <div>
                  <div className="crumb">{me.role === "teacher" ? "Giáo viên" : "Học viên"} / Bài tập</div>
                  <h1 className="page-title">{assignment && mode !== "new" ? assignment.title : "Bài tập"}</h1>
                </div>
                {me.role === "teacher" && (
                  <button type="button" className="btn primary" onClick={() => { setSelected(null); setMode("new"); }}>
                    + Giao bài mới
                  </button>
                )}
              </div>
              <div className="layout">
                <div className="list-col">
                  <AssignmentList assignments={assignments} mySubs={mySubs} me={me} selected={selected} onOpen={open} />
                </div>
                <div className="detail-col">{detail}</div>
              </div>
            </>
          )}
        </main>
      </div>
    </ZoomProvider>
  );
}
