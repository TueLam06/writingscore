import { useCallback, useEffect, useState } from "react";
import { api } from "./lib/api.js";
import { isStaff, ROLE_NAME, useAuth } from "./lib/auth.jsx";
import { ZoomProvider } from "./components/Zoom.jsx";
import Sidebar from "./components/Sidebar.jsx";
import AssignmentList from "./components/AssignmentList.jsx";
import AssignmentForm from "./components/AssignmentForm.jsx";
import TeacherAssignment from "./pages/TeacherAssignment.jsx";
import StudentAssignment from "./pages/StudentAssignment.jsx";
import ReviewQueue from "./pages/ReviewQueue.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";

const isDone = (s) => s?.status === "graded" || s?.status === "reviewed";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="empty"><span className="spinner" /> Đang tải…</div>;
  if (!user) return <AuthPage />;
  return <Workspace key={user.id} me={user} />;
}

function Workspace({ me }) {
  const { logout } = useAuth();
  const staff = isStaff(me);
  const [meta, setMeta] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [subs, setSubs] = useState([]); // GV/admin: mọi bài nộp; HV: bài nộp của mình
  const [students, setStudents] = useState([]);
  const [view, setView] = useState(staff ? "assignments" : "todo");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [openSubId, setOpenSubId] = useState(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const [a, s, st] = await Promise.all([
      api("/api/assignments"),
      api("/api/submissions"),
      staff ? api("/api/users?role=student") : Promise.resolve([]),
    ]);
    setAssignments(a);
    setSubs(s);
    setStudents(st);
    return s;
  }, [staff]);

  useEffect(() => {
    api("/api/meta").then(setMeta).catch(() => {});
    reload().catch((e) => setError(e.message));
  }, [reload]);

  const go = (v) => { setView(v); setSelected(null); setEditing(false); setOpenSubId(null); };
  const open = (id) => { setSelected(id); setEditing(false); setOpenSubId(null); };

  const subOf = (aid) => subs.find((s) => s.assignmentId === aid);
  const assignment = assignments.find((a) => a.id === selected);
  const pendingCount = subs.filter((s) => s.status === "graded").length;
  const todo = assignments.filter((a) => !isDone(subOf(a.id)));
  const done = assignments.filter((a) => isDone(subOf(a.id)));

  const items = [
    ...(staff
      ? [
          { id: "assignments", label: "Bài tập", icon: "list" },
          { id: "review", label: "Chờ duyệt", icon: "check", count: pendingCount },
          { id: "new", label: "Giao bài mới", icon: "plus" },
        ]
      : [
          { id: "todo", label: "Cần làm", icon: "pen", count: todo.length },
          { id: "done", label: "Đã chấm", icon: "star", count: done.length },
        ]),
    ...(me.role === "admin" ? [{ id: "users", label: "Người dùng", icon: "users" }] : []),
    { id: "account", label: "Tài khoản", icon: "user" },
  ];
  const current = items.find((it) => it.id === view);

  // Học viên nộp bài xong → chuyển sang mục "Đã chấm", vẫn mở đúng bài đó
  const studentChanged = async () => {
    const s = await reload();
    if (view === "todo" && isDone(s.find((x) => x.assignmentId === selected))) setView("done");
  };

  let body;
  if (view === "account") {
    body = <AccountPage />;
  } else if (view === "users") {
    body = <UsersPage />;
  } else if (view === "new") {
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
        users={students}
        onOpen={(s) => { setView("assignments"); setSelected(s.assignmentId); setEditing(false); setOpenSubId(s.id); }}
      />
    );
  } else {
    const list = view === "todo" ? todo : view === "done" ? done : assignments;
    let detail;
    if (editing && assignment) {
      detail = <AssignmentForm assignment={assignment} onCancel={() => setEditing(false)} onSaved={async (a) => { await reload(); open(a.id); }} />;
    } else if (assignment && staff) {
      detail = (
        <TeacherAssignment
          key={`${assignment.id}-${openSubId}`}
          assignment={assignment}
          users={students}
          initialOpenId={openSubId}
          onEdit={() => setEditing(true)}
          onChanged={reload}
          onDeleted={async () => { await reload(); setSelected(null); }}
        />
      );
    } else if (assignment) {
      detail = <StudentAssignment key={assignment.id} assignment={assignment} me={me} onChanged={studentChanged} />;
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

  const showAssignmentTitle = assignment && ["assignments", "todo", "done"].includes(view);

  return (
    <ZoomProvider>
      <div className="shell">
        <Sidebar meta={meta} me={me} items={items} active={view} onSelect={go} onLogout={logout} />
        <main className="main">
          {error && <div className="notice bad" style={{ marginBottom: 16 }}>{error}</div>}
          <div className="page-head">
            <div>
              <div className="crumb">{ROLE_NAME[me.role]} / {current?.label}</div>
              <h1 className="page-title">{showAssignmentTitle ? assignment.title : current?.label}</h1>
            </div>
          </div>
          {body}
        </main>
      </div>
    </ZoomProvider>
  );
}
