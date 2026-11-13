import { Router } from "express";
import bcrypt from "bcryptjs";
import { query, newId, publicUser, SALT_ROUNDS } from "../db/index.js";
import { generateToken } from "../auth/token.js";
import { verifyToken } from "../middleware/auth.js";
import { ah } from "../middleware/async.js";
import { loginLimiter, loginIpLimiter, registerLimiter, changePasswordLimiter } from "../middleware/rateLimit.js";

const router = Router();
const SELF_REGISTER_ROLES = ["student", "teacher"];
const normEmail = (e) => String(e || "").trim().toLowerCase();
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

router.post("/register", registerLimiter, ah(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = normEmail(req.body.email);
  const password = String(req.body.password || "");
  const role = req.body.role;

  if (!name || !email || !password) return res.status(400).json({ error: "Cần nhập họ tên, email và mật khẩu" });
  if (name.length > 100) return res.status(400).json({ error: "Họ tên tối đa 100 ký tự" });
  if (!isEmail(email) || email.length > 150) return res.status(400).json({ error: "Email không hợp lệ" });
  if (password.length < 6) return res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự" });
  if (!SELF_REGISTER_ROLES.includes(role)) return res.status(400).json({ error: "Vai trò không hợp lệ" });

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows } = await query(
    `INSERT INTO users (id, name, email, role, password_hash) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING RETURNING *`,
    [newId(), name, email, role, hash],
  );
  if (!rows[0]) return res.status(409).json({ error: "Email đã được sử dụng" });
  res.status(201).json({ user: publicUser(rows[0]), token: generateToken(rows[0]) });
}));

router.post("/login", loginIpLimiter, loginLimiter, ah(async (req, res) => {
  const email = normEmail(req.body.email);
  const password = String(req.body.password || "");
  if (!email || !password) return res.status(400).json({ error: "Cần nhập email và mật khẩu" });

  const { rows } = await query("SELECT * FROM users WHERE email = $1", [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Email hoặc mật khẩu không đúng" });
  }
  res.json({ user: publicUser(user), token: generateToken(user) });
}));

router.get("/me", verifyToken, ah(async (req, res) => {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [req.user.id]);
  res.json({ user: publicUser(rows[0]) });
}));

router.post("/change-password", verifyToken, changePasswordLimiter, ah(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Thiếu mật khẩu hiện tại hoặc mật khẩu mới" });
  if (newPassword.length < 6) return res.status(400).json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự" });
  if (newPassword === currentPassword) return res.status(400).json({ error: "Mật khẩu mới phải khác mật khẩu hiện tại" });

  const { rows } = await query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
  if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
    return res.status(400).json({ error: "Mật khẩu hiện tại không đúng" });
  }
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(newPassword, SALT_ROUNDS), req.user.id]);
  res.json({ message: "Đã đổi mật khẩu" });
}));

export default router;
