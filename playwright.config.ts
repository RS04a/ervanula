import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./frontend/test",
  use: {
    baseURL: "http://localhost:5173",
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
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: "npm run start:frontend",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
});
