import { useState } from "react";
import { ROLE_NAME, useAuth } from "../lib/auth.jsx";

export default function AccountPage() {
  const { user, changePassword } = useAuth();
  const [state, setState] = useState({ busy: false, error: "", ok: "" });

  const submit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (f.newPassword !== f.confirm) return setState({ busy: false, error: "Mật khẩu nhập lại không khớp", ok: "" });
    setState({ busy: true, error: "", ok: "" });
    try {
      const d = await changePassword(f.currentPassword, f.newPassword);
      e.target.reset();
      setState({ busy: false, error: "", ok: d.message });
    } catch (err) {
      setState({ busy: false, error: err.message, ok: "" });
    }
  };

  return (
    <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <h2>Thông tin</h2>
        <table>
          <tbody>
            <tr><th>Họ tên</th><td>{user.name}</td></tr>
            <tr><th>Email</th><td>{user.email}</td></tr>
            <tr><th>Vai trò</th><td>{ROLE_NAME[user.role]}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>Đổi mật khẩu</h2>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="p-cur">Mật khẩu hiện tại</label>
            <input id="p-cur" name="currentPassword" type="password" required autoComplete="current-password" />
          </div>
          <div className="field">
            <label htmlFor="p-new">Mật khẩu mới</label>
            <input id="p-new" name="newPassword" type="password" required minLength={6} autoComplete="new-password" />
          </div>
          <div className="field">
            <label htmlFor="p-confirm">Nhập lại mật khẩu mới</label>
            <input id="p-confirm" name="confirm" type="password" required autoComplete="new-password" />
          </div>
          {state.error && <div className="notice bad" style={{ marginBottom: 12 }}>{state.error}</div>}
          {state.ok && <div className="notice ok" style={{ marginBottom: 12 }}>{state.ok}</div>}
          <button className="btn primary" disabled={state.busy}>Đổi mật khẩu</button>
        </form>
      </div>
    </div>
  );
}
