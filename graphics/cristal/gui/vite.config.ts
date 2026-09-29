import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5175, strictPort: true },
  define: { "import.meta.env.VITE_CORE_API_URL": JSON.stringify("") },
  build: { outDir: "dist" },
});
