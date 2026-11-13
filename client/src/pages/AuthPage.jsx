import { useState } from "react";
import { useAuth } from "../lib/auth.jsx";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  const submit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    setError("");
    if (!isLogin && f.password !== f.confirm) return setError("Mật khẩu nhập lại không khớp");
    setBusy(true);
    try {
      if (isLogin) await login(f.email, f.password);
      else await register({ name: f.name, email: f.email, password: f.password, role: f.role });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const switchMode = () => { setMode(isLogin ? "register" : "login"); setError(""); };

  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">W</div>
          <div className="brand-name">writingscore</div>
        </div>
        <div>
          <h1 className="auth-tagline">Chấm IELTS Writing nhanh, nhận xét rõ ràng.</h1>
          <p className="auth-sub">Giáo viên giao bài, học viên nộp bài, AI chấm theo 4 tiêu chí và giáo viên duyệt điểm cuối cùng.</p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <h2 className="page-title" style={{ fontSize: 26 }}>{isLogin ? "Đăng nhập" : "Tạo tài khoản"}</h2>
          <p className="muted" style={{ margin: "6px 0 24px" }}>
            {isLogin ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
            <button type="button" className="link-btn" onClick={switchMode}>{isLogin ? "Đăng ký" : "Đăng nhập"}</button>
          </p>

          <form key={mode} onSubmit={submit}>
            {!isLogin && (
              <>
                <fieldset className="field role-pick">
                  <legend>Bạn là</legend>
                  <label><input type="radio" name="role" value="student" defaultChecked /> Học viên</label>
                  <label><input type="radio" name="role" value="teacher" /> Giáo viên</label>
                </fieldset>
                <div className="field">
                  <label htmlFor="a-name">Họ tên</label>
                  <input id="a-name" name="name" required maxLength={100} autoComplete="name" />
                </div>
              </>
            )}
            <div className="field">
              <label htmlFor="a-email">Email</label>
              <input id="a-email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="a-pass">Mật khẩu</label>
              <input id="a-pass" name="password" type="password" required minLength={isLogin ? undefined : 6} autoComplete={isLogin ? "current-password" : "new-password"} />
            </div>
            {!isLogin && (
              <div className="field">
                <label htmlFor="a-confirm">Nhập lại mật khẩu</label>
                <input id="a-confirm" name="confirm" type="password" required autoComplete="new-password" />
              </div>
            )}
            {error && <div className="notice bad" style={{ marginBottom: 14 }}>{error}</div>}
            <button className="btn primary" style={{ width: "100%" }} disabled={busy}>
              {busy ? <span className="spinner" /> : isLogin ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
