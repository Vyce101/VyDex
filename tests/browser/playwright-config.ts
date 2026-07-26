// Defines the shared desktop and mobile Playwright projects for Stage 1 browser checks.
import { defineConfig, type PlaywrightTestConfig } from "@playwright/test";
import { resolve } from "node:path";
import { parseRequiredPublicSiteOrigin } from "../../src/adapters/public-site-origin";

export const BROWSER_TEST_HOST = "127.0.0.1";
export const BROWSER_TEST_PORT = 4322;
export const BROWSER_TEST_URL = `http://${BROWSER_TEST_HOST}:${BROWSER_TEST_PORT}`;
export const EXPECTED_SITE_ORIGIN = parseRequiredPublicSiteOrigin(process.env.PUBLIC_SITE_ORIGIN);
export const BROWSER_BASE_URL = process.env.VYDEX_BROWSER_BASE_URL?.trim() || BROWSER_TEST_URL;
export const IS_HOSTED_BROWSER_TEST = BROWSER_BASE_URL !== BROWSER_TEST_URL;
const PREVIOUS_PRODUCTION_VERIFICATION_PHASES = new Set([
  "pre-deployment-current-production",
  "failed-deployment-restoration",
]);
export const IS_PREVIOUS_PRODUCTION_BROWSER_VERIFICATION =
  IS_HOSTED_BROWSER_TEST &&
  PREVIOUS_PRODUCTION_VERIFICATION_PHASES.has(
    process.env.VYDEX_HOSTED_VERIFICATION_PHASE?.trim() ?? "",
  );

export function createStageOnePlaywrightConfig(
  webServer?: PlaywrightTestConfig["webServer"],
): PlaywrightTestConfig {
  return defineConfig({
    testDir: resolve(import.meta.dirname),
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: "list",
    use: {
      baseURL: BROWSER_BASE_URL,
      screenshot: "only-on-failure",
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
          viewport: { width: 375, height: 812 },
        },
      },
    ],
    ...(webServer ? { webServer } : {}),
  });
}
