# writingscored – bản demo

Web nhỏ chạy trên máy (localhost) để giao và chấm bài IELTS Writing:

1. **Giáo viên** giao bài (Task 1 có thể kèm ảnh biểu đồ, Task 2), đặt hạn nộp.
2. **Học viên** chụp bài viết tay (tối đa 6 trang), AI đọc chữ thành văn bản, hoặc tự gõ bài.
3. Học viên **soát bản chép** bên cạnh ảnh gốc, chỉ sửa chỗ AI đọc nhầm.
4. AI **chấm theo 4 tiêu chí IELTS**: band từng tiêu chí, nhận xét tiếng Việt, lỗi cụ thể, bài mẫu đã sửa.
5. **Giáo viên duyệt**: xem ảnh gốc, thấy cảnh báo nếu học viên đã sửa bản chép, rồi chốt band và nhận xét.

## Chạy

```bash
npm install
npm run build
npm start
```

Mở http://localhost:3000, rồi chọn người dùng ở cuối thanh bên trái (GV1 là giáo viên, HS1/HS2/HS3 là học viên).

Khi sửa giao diện: chạy `npm start` và `npm run dev` ở hai terminal, rồi mở http://localhost:5173 (tự tải lại khi lưu file).

## Cấu trúc

```
server/            Backend Express
  index.js         Khởi động server, gắn các route
  routes/          API: assignments, submissions, speaking
  ai.js            Gọi Claude / Gemini / DEMO
  prompts/         Câu lệnh chấm Writing và Speaking
  db.js, images.js, paths.js
client/            Frontend React + Vite
  src/pages/       Màn hình giáo viên, học viên
  src/components/  Thành phần giao diện dùng lại
  src/lib/         Gọi API, định dạng, xử lý ảnh, tô lỗi
  src/styles/      CSS (màu, font)
  public/          speaking.html (trang Luyện nói)
eval/              Bộ đo độ lệch so với giám khảo (npm run eval)
data/              Dữ liệu chạy (không đưa lên Git)
```

## Dùng AI thật

Chưa có API key thì app chạy ở **chế độ DEMO**: kết quả là dữ liệu mẫu, không tốn tiền.
App dùng được hai loại AI. Điền key nào vào `.env` thì dùng loại đó (điền cả hai thì ưu tiên Gemini):

**Google Gemini (có hạn mức miễn phí)**
1. Vào https://aistudio.google.com/apikey, đăng nhập Google, bấm **Create API key**.
2. Mở file `.env` và điền `GEMINI_API_KEY=...`
3. Tắt (Ctrl+C) và chạy lại `npm start`.

Mô hình mặc định là `gemini-3.6-flash` (dự phòng: `gemini-3.5-flash-lite`); đổi bằng `GEMINI_MODEL` trong `.env`. Gói miễn phí giới hạn số lần gọi mỗi phút/ngày,
và Google có thể dùng dữ liệu gửi lên để cải thiện sản phẩm. Không nên gửi bài thật của học viên khi dùng gói miễn phí.

**Anthropic Claude (trả phí)**
1. Tạo API key tại https://console.anthropic.com (nên đặt giới hạn chi tiêu tháng ở đó).
2. Điền `ANTHROPIC_API_KEY=...` vào `.env` (để trống `GEMINI_API_KEY`), rồi chạy lại.

Mô hình dùng: `claude-opus-5-5`. Ước tính khoảng 1.000–3.000đ cho mỗi bài (đọc ảnh và chấm).

## Dữ liệu

- `data/db.json`: bài tập và bài nộp
- `data/uploads/`: ảnh bài viết
- Xoá thư mục `data/` để làm lại từ đầu.

## Giới hạn của bản demo

- Chưa có đăng nhập thật (chọn người dùng bằng menu); danh sách học viên sửa trong `SEED` ở `server/db.js`.
- Lưu dữ liệu bằng file JSON. Đủ cho thử nghiệm; dùng thật lâu dài nên chuyển sang cơ sở dữ liệu (SQLite/Supabase).
- Luyện nói (Speaking, bản demo) ở http://localhost:3000/speaking.html: cần Chrome/Edge (nhận dạng giọng nói của trình duyệt, gửi âm thanh qua máy chủ Google). AI chỉ chấm trên bản chép lời nói + số đo thời gian/ngắt nghỉ, nên Pronunciation là ước lượng.
