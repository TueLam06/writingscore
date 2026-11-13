// Express 4 không tự bắt lỗi của hàm async → chuyển lỗi sang error handler chung
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
