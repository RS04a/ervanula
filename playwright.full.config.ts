import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const macChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export default defineConfig({
  testDir: "frontend/test",
  testMatch: "full-app.spec.ts",
  outputDir: "test-results/full-app",
  testIdAttribute: "data-testid",
  timeout: 120_000,
  expect: { timeout: 18_000 },
  workers: 1,
  use: {
    actionTimeout: 10000,
    baseURL: "http://localhost:15173",
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ||
        (existsSync(macChrome) ? macChrome : undefined),
    },
  },
  projects: [
    {
      name: "escritorio",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    { name: "movil", use: { ...devices["Pixel 7"] } },
  ],
});
