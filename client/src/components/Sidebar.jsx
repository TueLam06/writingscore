const Icon = ({ d }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export default function Sidebar({ meta, me, onSwitchUser }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">W</div>
        <div className="brand-name">writingscore</div>
      </div>

      <nav className="nav" aria-label="Điều hướng chính">
        <a href="/" className="active" aria-current="page">
          <Icon d={<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>} />
          Writing
        </a>
        <a href="/speaking.html">
          <Icon d={<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>} />
          Luyện nói
        </a>
      </nav>

      <div className="side-foot">
        {meta && (
          <>
            <label htmlFor="userSelect">Đăng nhập là</label>
            <select id="userSelect" value={me?.id ?? ""} onChange={(e) => onSwitchUser(e.target.value)}>
              {meta.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role === "teacher" ? "Giáo viên" : "Học viên"}
                </option>
              ))}
            </select>
            <div className={`ai-chip ${meta.demo ? "demo" : ""}`}>
              {meta.demo ? "Chế độ DEMO – kết quả AI là dữ liệu mẫu" : `AI: ${meta.models.join(" → dự phòng ")}`}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
