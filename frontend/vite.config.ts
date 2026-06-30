import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import fs from "fs";

const isProd = process.env.NODE_ENV === "production";

export default defineConfig({
  base: isProd ? "/lumoria/" : "/",
  plugins: [react()],
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    esbuildOptions: {
      inject: [resolve(__dirname, "src/inject-buffer.js")],
      define: { global: "globalThis" },
    },
  },
  server: {
    port: 5173,
    host: true,
    https: fs.existsSync(resolve(__dirname, "localhost-key.pem")) ? {
      key: fs.readFileSync(resolve(__dirname, "localhost-key.pem")),
      cert: fs.readFileSync(resolve(__dirname, "localhost-cert.pem")),
    } : undefined,
  },
});
