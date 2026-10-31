import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8000",
    headless: true,
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
  },
  workers: 1,
  timeout: 120000,
  reporter: "list",
});
