import fs from "node:fs";
import crypto from "node:crypto";
import { DB_FILE, UPLOAD_DIR } from "./paths.js";

// "Cơ sở dữ liệu" JSON đơn giản: toàn bộ dữ liệu nằm trong bộ nhớ, ghi ra file sau mỗi thay đổi

const SEED = {
  users: [
    { id: "t1", name: "GV1", role: "teacher" },
    { id: "s1", name: "HS1", role: "student" },
    { id: "s2", name: "HS2", role: "student" },
    { id: "s3", name: "HS3", role: "student" },
  ],
  assignments: [
    {
      id: "a1",
      title: "Task 2 – Technology",
      taskType: "task2",
      prompt:
        "Some people believe that technology has made our lives easier, while others think it has made life more complicated. Discuss both views and give your own opinion.\n\nWrite at least 250 words.",
      promptImage: null,
      dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    },
  ],
  submissions: [],
};

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf8")) : structuredClone(SEED);
db.speaking ??= [];

export const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
save();

export const newId = () => crypto.randomUUID().slice(0, 8);
