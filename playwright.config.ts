import { defineConfig, devices } from "@playwright/test";

import { randomBytes } from "node:crypto";

const baseURL = "http://127.0.0.1:4101";
process.env.FEEDBACK_E2E_DATABASE_NAME ??= `feedback_e2e_${randomBytes(12).toString("hex")}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "**/teardown.mjs",
  globalTeardown: "./tests/e2e/teardown.mjs",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun --no-env-file scripts/e2e-server.ts",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      NODE_ENV: "production",
      FEEDBACK_E2E_DATABASE_NAME: process.env.FEEDBACK_E2E_DATABASE_NAME,
      PORT: "4101",
      STATIC_ROOT: "apps/web/dist",
      VITE_APP_URL: baseURL,
      VITE_API_URL: baseURL,
      BETTER_AUTH_URL: `${baseURL}/api/auth`,
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgres://postgres:password@localhost:5433/app_test",
      SMTP_HOST: "",
      SMTP_PORT: "",
      SMTP_FROM: "",
    },
  },
});
