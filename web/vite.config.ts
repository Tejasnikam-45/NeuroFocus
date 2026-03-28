import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // 127.0.0.1 avoids Windows resolving "localhost" to ::1 while Node listens on IPv4-only
        target: "http://127.0.0.1:3847",
        changeOrigin: true,
        timeout: 120_000,
        proxyTimeout: 120_000,
        configure(proxy) {
          proxy.on("proxyReq", (proxyReq, req) => {
            const host = req.headers.host;
            if (host) {
              proxyReq.setHeader("X-Forwarded-Host", host);
              proxyReq.setHeader("X-Forwarded-Proto", "http");
            }
          });
        },
      },
    },
  },
});
