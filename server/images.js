import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import heicConvert from "heic-convert";
import { createCanvas, loadImage as decodeImage } from "@napi-rs/canvas";
import { UPLOAD_DIR } from "./paths.js";
import { newId } from "./db.js";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
const isHeic = (file) => /hei[cf]/i.test(file.mimetype) || /\.hei[cf]$/i.test(file.originalname);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 6 },
  // Windows thường không nhận ra kiểu của file .heic (mimetype rỗng) → kiểm tra cả đuôi file
  fileFilter: (_req, file, cb) => cb(null, IMAGE_TYPES.includes(file.mimetype) || isHeic(file)),
});

// Chuẩn hoá mọi ảnh (kể cả HEIC từ iPhone) thành JPEG, cạnh dài tối đa 2000px
export async function saveImage(file) {
  let buf = file.buffer;
  if (isHeic(file)) buf = Buffer.from(await heicConvert({ buffer: buf, format: "JPEG", quality: 0.9 }));
  const img = await decodeImage(buf);
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
  const canvas = createCanvas(Math.round(img.width * scale), Math.round(img.height * scale));
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  const name = `${newId()}.jpg`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), await canvas.encode("jpeg", 88));
  return name;
}

// Đọc ảnh đã lưu thành base64 để gửi cho AI
export function loadImage(name) {
  const ext = path.extname(name).slice(1);
  const mediaType = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" }[ext];
  return { mediaType, base64: fs.readFileSync(path.join(UPLOAD_DIR, name)).toString("base64") };
}
