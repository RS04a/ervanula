import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import process from "node:process";

const gateway = `http://127.0.0.1:${process.env.GATEWAY_PORT ?? "3000"}`;

const proxy = { "/api": gateway, "/docs": gateway };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
  build: {
    rollupOptions: {
      input: {
        application: fileURLToPath(new URL("index.html", import.meta.url)),
        compatibility: fileURLToPath(new URL("app.html", import.meta.url)),
        payments: fileURLToPath(new URL("legacy.html", import.meta.url)),
      },
    },
  },
});
