// Gọi API của server Express; tự gắn token đăng nhập

const TOKEN_KEY = "token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api(url, opts = {}) {
  const token = getToken();
  const headers = { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  let res;
  try {
    res = await fetch(url, { ...opts, headers });
  } catch {
    throw new Error("Lỗi kết nối, thử lại sau");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) window.dispatchEvent(new Event("auth:expired"));
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

export const postJson = (url, body) =>
  api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const patchJson = (url, body) =>
  api(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
