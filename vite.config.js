import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Frontend React nằm trong client/. Khi dev: Vite chạy ở cổng 5173 và chuyển
// các request /api, /uploads, /eval sang server Express (cổng 3000).
export default defineConfig({
  root: "client",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/uploads": "http://localhost:3000",
      "/eval": "http://localhost:3000",
    },
  },
});
