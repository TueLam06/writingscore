// Thu nhỏ ảnh chụp điện thoại trước khi tải lên (tối đa 2000px, JPEG)

export const isHeic = (f) => /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);

export async function compressImage(file, maxSide = 2000) {
  if (isHeic(file)) return file; // HEIC: trình duyệt không đọc được → máy chủ tự chuyển
  let img;
  try { img = await createImageBitmap(file); } catch { return file; }
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = Object.assign(document.createElement("canvas"), {
    width: Math.round(img.width * scale),
    height: Math.round(img.height * scale),
  });
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}
