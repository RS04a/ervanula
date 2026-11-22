import { defineConfig } from "@playwright/test";
const isolated = process.env.ARVELUNA_LEGACY_TEST === "true";
const frontend = isolated ? "http://localhost:25173" : "http://localhost:5173";
const gateway = isolated ? "http://127.0.0.1:23000" : "http://localhost:3000";

export default defineConfig({
  testDir: "./frontend/test",
  testIgnore: "**/full-app.spec.ts",
  outputDir: "test-results/legacy",

  use: {
    baseURL: frontend,
    headless: true,
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ??
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
  },
  webServer: [
    {
      command: "npm run start:backend",
      url: `${gateway}/api/health`,
      reuseExistingServer: !isolated && !process.env.CI,
      timeout: 60000,
    },
    {
      command: isolated
        ? "node node_modules/vite/bin/vite.js preview frontend --host 127.0.0.1 --port 25173 --strictPort"
        : "npm run start:frontend",
      url: frontend,
      reuseExistingServer: !isolated && !process.env.CI,
      timeout: 60000,
    },
  ],
});
