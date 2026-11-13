import { rateLimit, ipKeyGenerator } from "express-rate-limit";

function createLimiter({ windowMs, limit, message, ...options }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: message }),
    ...options,
  });
}

// Tối đa 5 lần SAI / 15 phút cho mỗi cặp IP + email
export const loginLimiter = createLimiter({
  windowMs: 15 * 60_000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email || "").trim().toLowerCase()}`,
  message: "Bạn đăng nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút",
});

// Chặn thêm theo IP để không dò được bằng cách đổi email liên tục
export const loginIpLimiter = createLimiter({
  windowMs: 15 * 60_000,
  limit: 30,
  skipSuccessfulRequests: true,
  message: "Bạn đăng nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút",
});

export const registerLimiter = createLimiter({
  windowMs: 60 * 60_000,
  limit: 10,
  skipFailedRequests: true,
  message: "Bạn đăng ký quá nhiều tài khoản, vui lòng thử lại sau",
});

export const changePasswordLimiter = createLimiter({
  windowMs: 15 * 60_000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip)),
  message: "Bạn nhập sai mật khẩu hiện tại quá nhiều lần, vui lòng thử lại sau 15 phút",
});
