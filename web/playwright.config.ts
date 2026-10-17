import { defineConfig, devices } from "@playwright/test";

// Load local env (Supabase URL / service key for the test-only auth helper).
for (const file of [".env.local", ".env.development.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* optional */
  }
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const live = process.env.LIVE === "1";
// @live hits the real API (and OpenAI); @screenshots refreshes the README images in docs/screenshots.
// @audit is the full click-through matrix (~45 min); it runs nightly in CI or with AUDIT=1.
const skipped = [
  !live && "@live",
  process.env.SCREENSHOTS !== "1" && "@screenshots",
  process.env.AUDIT !== "1" && "@audit",
].filter(Boolean);

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 }, // parallel workers share one server; 5s is tight under load
  reporter: [["list"], ["html", { open: "never" }]],
  grepInvert: skipped.length ? new RegExp(skipped.join("|")) : undefined,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run start -- -p 3000", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
