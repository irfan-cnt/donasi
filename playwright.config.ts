import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

const port = Number(process.env.PORT ?? 3000);
// P15: suite @sandbox (tests/e2e/*.sandbox.spec.ts) hanya berjalan bila SANDBOX_BASE_URL diisi
// (deployment preview Vercel). Header bypass Deployment Protection dibaca dari env, tidak di-hardcode.
const sandboxBaseURL = process.env.SANDBOX_BASE_URL?.replace(/\/+$/, "");
const baseURL = sandboxBaseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
if (sandboxBaseURL) loadEnv({ path: ".env.local", quiet: true });
const bypass = sandboxBaseURL ? process.env.VERCEL_AUTOMATION_BYPASS_SECRET : undefined;
const SANDBOX_SPECS = /.*\.sandbox\.spec\.ts/;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry", locale: "id-ID", timezoneId: "Asia/Jakarta" },
  projects: sandboxBaseURL
    ? [
        {
          name: "sandbox",
          testMatch: SANDBOX_SPECS,
          timeout: 300_000,
          use: {
            ...devices["Desktop Chrome"],
            extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass } : undefined,
          },
        },
      ]
    : [
        { name: "mobile", testIgnore: SANDBOX_SPECS, use: { ...devices["Pixel 7"] } },
        { name: "desktop", testIgnore: SANDBOX_SPECS, use: { ...devices["Desktop Chrome"] } },
      ],
  webServer:
    sandboxBaseURL || process.env.PLAYWRIGHT_BASE_URL
      ? undefined
      : {
          command: `pnpm dev --port ${port}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          // Redirect Auth.js (mis. logout) harus ke server uji, bukan AUTH_URL dari .env.local.
          env: { AUTH_URL: baseURL },
        },
});
