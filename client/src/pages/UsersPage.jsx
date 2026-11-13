import { useEffect, useState } from "react";
import { api, patchJson } from "../lib/api.js";
import { ROLE_NAME, useAuth } from "../lib/auth.jsx";

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => { api("/api/users").then(setUsers).catch((e) => setError(e.message)); }, []);

  const changeRole = async (u, role) => {
    setError("");
    try {
      const updated = await patchJson(`/api/users/${u.id}/role`, { role });
      setUsers((list) => list.map((x) => (x.id === u.id ? updated : x)));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="card">
      {error && <div className="notice bad" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Họ tên</th><th>Email</th><th>Vai trò</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b></td>
                <td>{u.email}</td>
                <td>
                  {u.id === me.id ? (
                    <span className="pill info">{ROLE_NAME[u.role]}</span>
                  ) : (
                    <select aria-label={`Vai trò của ${u.name}`} value={u.role} onChange={(e) => changeRole(u, e.target.value)} style={{ maxWidth: 160 }}>
                      {Object.entries(ROLE_NAME).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
