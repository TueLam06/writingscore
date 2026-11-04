// Định dạng và hằng số hiển thị

export const fmtBand = (b) => (b == null ? "–" : Number(b).toFixed(1));
export const wordCount = (t) => (t.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;

export const TASK_NAME = { task1: "Task 1 Academic", task1gt: "Task 1 General", task2: "Task 2" };
export const minWordsOf = (a) => (a.taskType === "task2" ? 250 : 150);

export const STATUS = {
  draft: { label: "Chưa nộp", tone: "" },
  transcribed: { label: "Đang soát bản chép", tone: "warn" },
  graded: { label: "AI đã chấm – chờ GV duyệt", tone: "info" },
  reviewed: { label: "GV đã duyệt", tone: "ok" },
};
