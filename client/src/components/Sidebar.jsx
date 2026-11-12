const ICONS = {
  list: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></>,
  pen: <path d="M4 20h4L19 9l-4-4L4 16v4z" />,
  star: <path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" />,
};

const Icon = ({ name }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name]}
  </svg>
);

export default function Sidebar({ meta, me, items, active, onSelect, onSwitchUser }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">W</div>
        <div className="brand-name">writingscore</div>
      </div>

      <nav className="nav" aria-label="Điều hướng chính">
        {items.map((it) => (
          <button
            type="button"
            key={it.id}
            className={active === it.id ? "active" : ""}
            aria-current={active === it.id ? "page" : undefined}
            onClick={() => onSelect(it.id)}
          >
            <Icon name={it.icon} />
            <span className="grow">{it.label}</span>
            {it.count > 0 && <span className="nav-count">{it.count}</span>}
          </button>
        ))}
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
