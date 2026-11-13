import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, postJson, setToken } from "./api.js";

const AuthContext = createContext(null);

export const ROLE_NAME = { student: "Học viên", teacher: "Giáo viên", admin: "Admin" };
export const isStaff = (user) => user?.role === "teacher" || user?.role === "admin";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (getToken()) {
      api("/api/auth/me")
        .then((d) => setUser(d.user))
        .catch(logout)
        .finally(() => setLoading(false));
    }
    window.addEventListener("auth:expired", logout);
    return () => window.removeEventListener("auth:expired", logout);
  }, [logout]);

  const signIn = (d) => {
    setToken(d.token);
    setUser(d.user);
    return d.user;
  };

  const value = {
    user,
    loading,
    logout,
    login: (email, password) => postJson("/api/auth/login", { email, password }).then(signIn),
    register: (form) => postJson("/api/auth/register", form).then(signIn),
    changePassword: (currentPassword, newPassword) => postJson("/api/auth/change-password", { currentPassword, newPassword }),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải được gọi bên trong <AuthProvider>");
  return ctx;
}
