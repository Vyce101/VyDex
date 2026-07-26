// Guards release command identity, archive, hosting, and public-route boundaries.
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");

describe("release publication foundation", () => {
  test("provides strict reproduction, explicit successor creation, and the compatibility alias", async () => {
    const packageJson = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(packageJson.scripts["release:ci"]).toContain("scripts/release/release-ci.ts");
    expect(packageJson.scripts["release:next"]).toContain("scripts/release/next-release.ts");
    expect(packageJson.scripts["release:stage-1:ci"]).toBe("npm run release:ci");
    expect(packageJson.scripts["release:stage-1"]).toBe("npm run release:ci");
  });

  test("keeps release reproduction free of release identity and clock generation", async () => {
    const source = await readFile(resolve(ROOT, "src/release/release-publication/run-release-ci.ts"), "utf8");
    expect(source).not.toMatch(/\buuidV7\b|\brandomUUID\b|\bnew Date\b|Date\.now/);
  });

  test("does not add public manifest, history, diagnostics, or archive-index pages", async () => {
    const pages = (await readdir(resolve(ROOT, "src/pages"), { recursive: true }))
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.replaceAll("\\", "/"));
    expect(pages.some((entry) => /manifest|release-history|diagnostic|archive-index|private-preview/i.test(entry))).toBe(false);
  });
});
