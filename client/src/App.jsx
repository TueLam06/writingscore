import { useCallback, useEffect, useState } from "react";
import { api } from "./lib/api.js";
import { ZoomProvider } from "./components/Zoom.jsx";
import Sidebar from "./components/Sidebar.jsx";
import AssignmentList from "./components/AssignmentList.jsx";
import AssignmentForm from "./components/AssignmentForm.jsx";
import TeacherAssignment from "./pages/TeacherAssignment.jsx";
import StudentAssignment from "./pages/StudentAssignment.jsx";
import ReviewQueue from "./pages/ReviewQueue.jsx";

const isDone = (s) => s?.status === "graded" || s?.status === "reviewed";
const DEFAULT_VIEW = { teacher: "assignments", student: "todo" };

export default function App() {
  const [meta, setMeta] = useState(null);
  const [meId, setMeId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [subs, setSubs] = useState([]); // GV: mọi bài nộp; HV: bài nộp của mình
  const [view, setView] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [openSubId, setOpenSubId] = useState(null);
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
    if (!me) return [];
    const [a, s] = await Promise.all([
      api("/api/assignments"),
      api(me.role === "student" ? `/api/submissions?studentId=${me.id}` : "/api/submissions"),
    ]);
    setAssignments(a);
    setSubs(s);
    return s;
  }, [me]);

  useEffect(() => {
    if (!me) return;
    setView(DEFAULT_VIEW[me.role]);
    setSelected(null);
    setEditing(false);
    reload().catch((e) => setError(e.message));
  }, [me, reload]);

  const switchUser = (id) => {
    localStorage.setItem("me", id);
    setMeId(id);
  };

  const go = (v) => { setView(v); setSelected(null); setEditing(false); setOpenSubId(null); };
  const open = (id) => { setSelected(id); setEditing(false); setOpenSubId(null); };

  if (!me || !view) {
    return (
      <div className="shell">
        <Sidebar meta={meta} me={me} items={[]} onSwitchUser={switchUser} />
        <main className="main">{error && <div className="notice bad">{error}</div>}</main>
      </div>
    );
  }

  const subOf = (aid) => subs.find((s) => s.assignmentId === aid);
  const assignment = assignments.find((a) => a.id === selected);
  const pendingCount = subs.filter((s) => s.status === "graded").length;
  const todo = assignments.filter((a) => !isDone(subOf(a.id)));
  const done = assignments.filter((a) => isDone(subOf(a.id)));

  const items = me.role === "teacher"
    ? [
        { id: "assignments", label: "Bài tập", icon: "list" },
        { id: "review", label: "Chờ duyệt", icon: "check", count: pendingCount },
        { id: "new", label: "Giao bài mới", icon: "plus" },
      ]
    : [
        { id: "todo", label: "Cần làm", icon: "pen", count: todo.length },
        { id: "done", label: "Đã chấm", icon: "star", count: done.length },
      ];
  const current = items.find((it) => it.id === view);

  // Học viên nộp bài xong → chuyển sang mục "Đã chấm", vẫn mở đúng bài đó
  const studentChanged = async () => {
    const s = await reload();
    if (view === "todo" && isDone(s.find((x) => x.assignmentId === selected))) setView("done");
  };

  let body;
  if (view === "new") {
    body = (
      <div style={{ maxWidth: 760 }}>
        <AssignmentForm onCancel={() => go("assignments")} onSaved={async (a) => { await reload(); setView("assignments"); open(a.id); }} />
      </div>
    );
  } else if (view === "review") {
    body = (
      <ReviewQueue
        subs={subs}
        assignments={assignments}
        users={meta.users}
        onOpen={(s) => { setView("assignments"); setSelected(s.assignmentId); setEditing(false); setOpenSubId(s.id); }}
      />
    );
  } else {
    const list = view === "todo" ? todo : view === "done" ? done : assignments;
    let detail;
    if (editing && assignment) {
      detail = <AssignmentForm assignment={assignment} onCancel={() => setEditing(false)} onSaved={async (a) => { await reload(); open(a.id); }} />;
    } else if (assignment && me.role === "teacher") {
      detail = (
        <TeacherAssignment
          key={`${assignment.id}-${openSubId}`}
          assignment={assignment}
          users={meta.users}
          initialOpenId={openSubId}
          onEdit={() => setEditing(true)}
          onChanged={reload}
          onDeleted={async () => { await reload(); setSelected(null); }}
        />
      );
    } else if (assignment) {
      detail = <StudentAssignment key={`${assignment.id}-${me.id}`} assignment={assignment} me={me} onChanged={studentChanged} />;
    } else {
      detail = (
        <div className="card empty">
          {list.length ? "Chọn một bài tập trong danh sách." : view === "todo" ? "Bạn đã làm hết bài tập." : view === "done" ? "Chưa có bài nào được chấm." : "Chưa có bài tập nào."}
        </div>
      );
    }
    body = (
      <div className="layout">
        <div className="list-col">
          <AssignmentList assignments={list} mySubs={subs} me={me} selected={selected} onOpen={open} />
        </div>
        <div className="detail-col">{detail}</div>
      </div>
    );
  }

  return (
    <ZoomProvider>
      <div className="shell">
        <Sidebar meta={meta} me={me} items={items} active={view} onSelect={go} onSwitchUser={switchUser} />
        <main className="main">
          {error && <div className="notice bad" style={{ marginBottom: 16 }}>{error}</div>}
          <div className="page-head">
            <div>
              <div className="crumb">{me.role === "teacher" ? "Giáo viên" : "Học viên"} / {current?.label}</div>
              <h1 className="page-title">{assignment && !["new", "review"].includes(view) ? assignment.title : current?.label}</h1>
            </div>
          </div>
          {body}
        </main>
      </div>
    </ZoomProvider>
  );
}
