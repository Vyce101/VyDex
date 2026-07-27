// Guards release command identity, archive, hosting, and public-route boundaries.
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");

describe("release publication foundation", () => {
  test("provides strict reproduction, byte-aware synchronization, and the compatibility alias", async () => {
    const packageJson = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(packageJson.scripts["release:ci"]).toContain("scripts/release/release-ci.ts");
    expect(packageJson.scripts["release:check"]).toContain("scripts/release/check-release-selection.ts");
    expect(packageJson.scripts["release:sync"]).toContain("scripts/release/sync-release-selection.ts");
    expect(packageJson.scripts["release:next"]).toContain("scripts/release/next-release.ts");
    expect(packageJson.scripts["release:stage-1:ci"]).toBe("npm run release:ci");
    expect(packageJson.scripts["release:stage-1"]).toBe("npm run release:ci");
  });

  test("keeps release reproduction free of release identity and clock generation", async () => {
    const source = await readFile(resolve(ROOT, "src/release/release-publication/run-release-ci.ts"), "utf8");
    expect(source).not.toMatch(/\buuidV7\b|\brandomUUID\b|\bnew Date\b|Date\.now/);
  });

  test("synchronizes release state only for trusted pull request branches", async () => {
    const workflow = await readFile(resolve(ROOT, ".github/workflows/validate-application.yml"), "utf8");
    expect(workflow).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("npm run release:sync -- --confirm CREATE_NEXT_RELEASE");
    expect(workflow).toContain("grep -v '^generated/release-data/'");
    expect(workflow).toContain("git add -- generated/release-data");
    expect(workflow).toContain('git push origin "HEAD:${HEAD_REF}"');

    const synchronizationIndex = workflow.indexOf("npm run release:sync");
    const verificationIndex = workflow.indexOf("npm run release:check", synchronizationIndex);
    const validationIndex = workflow.indexOf("npm run release:ci", verificationIndex);
    const pushIndex = workflow.indexOf('git push origin "HEAD:${HEAD_REF}"');
    expect(synchronizationIndex).toBeGreaterThan(-1);
    expect(verificationIndex).toBeGreaterThan(synchronizationIndex);
    expect(validationIndex).toBeGreaterThan(verificationIndex);
    expect(pushIndex).toBeGreaterThan(validationIndex);
  });

  test("does not add public manifest, history, diagnostics, or archive-index pages", async () => {
    const pages = (await readdir(resolve(ROOT, "src/pages"), { recursive: true }))
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.replaceAll("\\", "/"));
    expect(pages.some((entry) => /manifest|release-history|diagnostic|archive-index|private-preview/i.test(entry))).toBe(false);
  });
});
