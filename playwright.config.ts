import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  expect: { timeout: 8000 },
  use: {
    baseURL: process.env.HUMANRANK_TEST_URL ?? "http://127.0.0.1:5174",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        launchOptions: process.env.HUMANRANK_WEBKIT_EXECUTABLE
          ? { executablePath: process.env.HUMANRANK_WEBKIT_EXECUTABLE }
          : undefined,
      },
    },
  ],
});
