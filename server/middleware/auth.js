import { verifyTokenString } from "../auth/token.js";
import { query } from "../db/index.js";

export async function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Bạn cần đăng nhập" });
  let payload;
  try {
    payload = verifyTokenString(header.slice(7));
  } catch (err) {
    const expired = err.name === "TokenExpiredError";
    return res.status(401).json({ error: expired ? "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại" : "Token không hợp lệ" });
  }
  try {
    // Vai trò lấy từ db, không tin payload: admin đổi vai trò thì có hiệu lực ngay
    const { rows } = await query("SELECT id, email, role FROM users WHERE id = $1", [payload.id]);
    if (!rows[0]) return res.status(401).json({ error: "Tài khoản không còn tồn tại" });
    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ error: "Bạn không có quyền thực hiện thao tác này" });

export const isStaff = (user) => user.role === "teacher" || user.role === "admin";
export const requireStaff = requireRole("teacher", "admin");
