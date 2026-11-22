import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import process from "node:process";

const gateway = `http://127.0.0.1:${process.env.GATEWAY_PORT ?? "3000"}`;

const proxy = { "/api": gateway, "/docs": gateway };

export default defineConfig({
  server: { proxy },
  preview: { proxy },
  build: {
    rollupOptions: {
      input: {
        payments: fileURLToPath(new URL("index.html", import.meta.url)),
        application: fileURLToPath(new URL("app.html", import.meta.url)),
      },
    },
  },
});
