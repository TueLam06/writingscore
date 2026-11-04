import path from "node:path";
import { fileURLToPath } from "node:url";

// Đường dẫn dùng chung, tính từ thư mục gốc của dự án
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = path.join(ROOT, "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const DB_FILE = path.join(DATA_DIR, "db.json");
export const CLIENT_DIST = path.join(ROOT, "client", "dist");
export const EVAL_DIR = path.join(ROOT, "eval");
