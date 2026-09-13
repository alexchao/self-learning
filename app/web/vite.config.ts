import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const webDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: webDirectory,
  plugins: [react()],
  build: { outDir: path.join(webDirectory, "dist"), emptyOutDir: true },
  server: { proxy: { "/api": "http://localhost:4747", "/session-assets": "http://localhost:4747" } },
});
