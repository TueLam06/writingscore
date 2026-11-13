import { Router } from "express";
import { query, publicUser } from "../db/index.js";
import { requireRole, requireStaff } from "../middleware/auth.js";
import { ah } from "../middleware/async.js";

const router = Router();
const ROLES = ["student", "teacher", "admin"];

router.get("/", requireStaff, ah(async (req, res) => {
  const { role } = req.query;
  const { rows } = await query(
    "SELECT * FROM users WHERE ($1::text IS NULL OR role = $1) ORDER BY created_at",
    [role || null],
  );
  res.json(rows.map(publicUser));
}));

router.patch("/:id/role", requireRole("admin"), ah(async (req, res) => {
  if (!ROLES.includes(req.body.role)) return res.status(400).json({ error: "Vai trò không hợp lệ" });
  if (req.params.id === req.user.id) return res.status(400).json({ error: "Không thể tự đổi vai trò của chính mình" });
  const { rows } = await query("UPDATE users SET role = $1 WHERE id = $2 RETURNING *", [req.body.role, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Không tìm thấy người dùng" });
  res.json(publicUser(rows[0]));
}));

export default router;
