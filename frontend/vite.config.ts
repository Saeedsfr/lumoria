import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import fs from "fs";

export default defineConfig({
  plugins: [react()],
  define: {
    // @ton/core و TonConnect در browser نیاز به global دارن
    global: "globalThis",
  },
  optimizeDeps: {
    esbuildOptions: {
      // esbuild inject برای Buffer global (deprecated warning اشکالی نداره)
      inject: [resolve(__dirname, "src/inject-buffer.js")],
      define: { global: "globalThis" },
    },
  },
  server: {
    port: 5173,
    host: true,
    https: {
      key: fs.readFileSync(resolve(__dirname, "localhost-key.pem")),
      cert: fs.readFileSync(resolve(__dirname, "localhost-cert.pem")),
    },
  },
});
