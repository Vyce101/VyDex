// Configures browser checks against Cloudflare-shaped static test output.
import {
  BROWSER_TEST_URL,
  createStageOnePlaywrightConfig,
} from "./tests/browser/playwright-config";

export default createStageOnePlaywrightConfig({
  command: "npm run preview:browser",
  reuseExistingServer: false,
  timeout: 120_000,
  url: BROWSER_TEST_URL,
});
