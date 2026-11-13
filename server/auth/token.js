import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) throw new Error("JWT_SECRET chưa được set trong file .env");

export const generateToken = (user) => jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

export const verifyTokenString = (token) => jwt.verify(token, JWT_SECRET);
