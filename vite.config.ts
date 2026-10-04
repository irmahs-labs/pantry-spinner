import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // `npm run dev:api` serves /api on 3002; the browser only ever sees 5173,
    // so the session cookie and every request stay same-origin, as in production.
    proxy: { "/api": "http://localhost:3002" },
  },
});
