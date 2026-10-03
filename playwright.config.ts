import { defineConfig, devices } from "@playwright/test";

/**
 * E2E : application construite (`npm run build`) et base de démo seedée
 * (`npm run db:seed`). Chromium préinstallé : CHROMIUM_PATH le cas échéant.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/v1/health`,
    reuseExistingServer: true,
    env: { APP_URL: `http://localhost:${PORT}` },
  },
});
