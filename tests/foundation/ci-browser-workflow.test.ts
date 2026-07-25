// Verifies CI routes browser checks through the atomic release gate.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();

describe("CI browser workflow", () => {
  it("keeps local browser preparation while CI checks the staged release", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(repositoryRoot, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const workflow = await readFile(
      resolve(repositoryRoot, ".github/workflows/validate-application.yml"),
      "utf8",
    );
    const releaseGate = await readFile(
      resolve(repositoryRoot, "src/release/stage-one-release/run-stage-one-release.ts"),
      "utf8",
    );

    expect(packageJson.scripts?.["test:browser:configured"]).toBe(
      "npm run build:test && npm run test:browser:run",
    );
    expect(packageJson.scripts?.["test:browser:run"]).toBe(
      "tsx scripts/test/prepare-browser-output.ts && playwright test",
    );
    expect(workflow).toContain("run: npm run release:stage-1:ci");
    expect(workflow).not.toContain("run: npx playwright test");
    expect(releaseGate).toContain("scripts/test/run-stage-one-browser-checks.ts");
  });
});
