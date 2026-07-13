// Configures browser checks against the built static application.
import { defineConfig } from "@playwright/test";

const BROWSER_TEST_HOST = "127.0.0.1";
const BROWSER_TEST_PORT = 4321;
const BROWSER_TEST_URL = `http://${BROWSER_TEST_HOST}:${BROWSER_TEST_PORT}`;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: BROWSER_TEST_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        browserName: "chromium",
        hasTouch: true,
        isMobile: true,
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: `npm run preview -- --host ${BROWSER_TEST_HOST} --port ${BROWSER_TEST_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: BROWSER_TEST_URL,
  },
});
