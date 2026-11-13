import { ROLE_NAME } from "../lib/auth.jsx";

const ICONS = {
  list: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></>,
  pen: <path d="M4 20h4L19 9l-4-4L4 16v4z" />,
  star: <path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.6-4.8-4-5.6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></>,
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
};

const Icon = ({ name }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name]}
  </svg>
);

export default function Sidebar({ meta, me, items, active, onSelect, onLogout }) {
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
        {me && (
          <div className="me">
            <span className="avatar" aria-hidden="true">{me.name.trim().charAt(0).toUpperCase()}</span>
            <div className="grow">
              <div className="me-name">{me.name}</div>
              <div className="me-role">{ROLE_NAME[me.role]}</div>
            </div>
            <button type="button" className="icon-btn" aria-label="Đăng xuất" title="Đăng xuất" onClick={onLogout}>
              <Icon name="logout" />
            </button>
          </div>
        )}
        {meta && (
          <div className={`ai-chip ${meta.demo ? "demo" : ""}`}>
            {meta.demo ? "Chế độ DEMO – kết quả AI là dữ liệu mẫu" : `AI: ${meta.models.join(" → dự phòng ")}`}
          </div>
        )}
      </div>
    </aside>
  );
}
