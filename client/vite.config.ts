import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "..", "shared"),
      "@assets": path.resolve(__dirname, "..", "attached_assets"),
    },
  },
  server: {
    host: true,
    port: 5173,
    fs: {
      strict: false,
      allow: [".."],
    },
  },
  build: {
    outDir: path.resolve(__dirname, "..", "ims-backend", "dist"),
    emptyOutDir: true,
    assetsDir: "assets",
  },
  base: '/'
});

