// Verifies the Export Page source contract and its exact static content sequence.
import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

const componentPath = new URL("../../src/features/export-page/ExportPage.astro", import.meta.url);

describe("Export Page component contract", () => {
  test("keeps the required hierarchy, order, and immutable download binding", async () => {
    const source = await readFile(componentPath, "utf8");

    expect(source.match(/<h1\b/g)).toHaveLength(1);
    expect(source.match(/<h2\b/g)).toHaveLength(4);
    const orderedSections = [
      'data-export-section="export-header"',
      'data-export-section="current-export"',
      'data-export-section="whats-included"',
      'data-export-section="stage-one-limits"',
      'data-export-section="use-notes"',
    ];
    expect(orderedSections.map((marker) => source.indexOf(marker))).toEqual(
      [...orderedSections.map((marker) => source.indexOf(marker))].sort((left, right) => left - right),
    );
    expect(source).toContain("href={model.download_path}");
    expect(source).toContain("download={model.download_filename}");
    expect(source).not.toContain('href="/datasets/vydex-latest-entry-versions-v1-0-0.json"');
  });

  test("contains the exact Stage 1 limitations and excludes unsupported product language", async () => {
    const source = await readFile(componentPath, "utf8");

    for (const limitation of [
      "No historical entry versions",
      "No custom filters",
      "No CSV export",
      "No public API",
    ]) {
      expect(source).toContain(limitation);
    }
    for (const unsupportedText of [
      "Developer Platform",
      "Premium Data",
      "Complete Dataset",
      "Full Archive",
      "Get Access",
      "View Entries",
      "llms.txt",
    ]) {
      expect(source).not.toContain(unsupportedText);
    }
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });
});
