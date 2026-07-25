// Runs the shared Stage 1 browser suite directly against a hosted production deployment.
import { createStageOnePlaywrightConfig } from "./tests/browser/playwright-config";

if (!process.env.VYDEX_BROWSER_BASE_URL?.trim()) {
  throw new Error("VYDEX_BROWSER_BASE_URL is required for hosted browser verification.");
}

export default createStageOnePlaywrightConfig();
