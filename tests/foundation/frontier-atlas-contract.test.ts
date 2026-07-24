// Verifies the owned Frontier Atlas token contract and presentation safeguards.
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");
const STYLES_ROOT = join(PROJECT_ROOT, "src", "styles");
const TOKENS_PATH = join(STYLES_ROOT, "tokens.css");
const TOKENS_SOURCE = readFileSync(TOKENS_PATH, "utf8");
const PRESENTATION_ROOTS = [
  STYLES_ROOT,
  join(PROJECT_ROOT, "src", "layouts"),
  join(PROJECT_ROOT, "src", "pages"),
];

const EXPECTED_COLOR_TOKENS = {
  "--atlas-color-canvas": "#f2f4f3",
  "--atlas-color-sheet": "#fcfcfa",
  "--atlas-color-ink-primary": "#17212b",
  "--atlas-color-ink-secondary": "#50606f",
  "--atlas-color-ink-muted": "#667581",
  "--atlas-color-rule-record": "#c7d0d6",
  "--atlas-color-rule-strong": "#7c8c97",
  "--atlas-color-grid-faint": "#e3e8eb",
  "--atlas-color-route": "#006d9c",
  "--atlas-color-route-hover": "#005a83",
  "--atlas-color-focus": "#0892d0",
  "--atlas-color-route-wash": "#e8f3f8",
  "--atlas-color-control-text": "#ffffff",
  "--atlas-color-status-neutral-text": "#35434e",
  "--atlas-color-status-neutral-background": "#f5f6f4",
  "--atlas-color-status-neutral-border": "#b9c4cb",
  "--atlas-color-status-unverified-text": "#7a5a00",
  "--atlas-color-status-unverified-background": "#fff8e1",
  "--atlas-color-status-unverified-border": "#d7b85a",
  "--atlas-color-status-disputed-text": "#5c4a76",
  "--atlas-color-status-disputed-background": "#f4f0f8",
  "--atlas-color-status-disputed-border": "#b7a6c7",
  "--atlas-color-status-failed-text": "#b42318",
  "--atlas-color-status-failed-background": "#fff1ef",
  "--atlas-color-status-failed-border": "#e0a39d",
} as const;

const EXPECTED_SPACING_TOKENS = {
  "--atlas-space-4": "0.25rem",
  "--atlas-space-8": "0.5rem",
  "--atlas-space-12": "0.75rem",
  "--atlas-space-16": "1rem",
  "--atlas-space-20": "1.25rem",
  "--atlas-space-24": "1.5rem",
  "--atlas-space-32": "2rem",
  "--atlas-space-48": "3rem",
  "--atlas-space-56": "3.5rem",
  "--atlas-space-64": "4rem",
  "--atlas-space-80": "5rem",
  "--atlas-space-96": "6rem",
  "--atlas-space-128": "8rem",
} as const;

function getTokenValue(tokenName: string): string | undefined {
  const match = TOKENS_SOURCE.match(new RegExp(`${tokenName.replaceAll("-", "\\-")}\\s*:\\s*([^;]+);`));
  return match?.[1]?.trim();
}

function getFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? getFiles(path) : [path];
  });
}

function getPresentationSources(): Array<{ path: string; source: string }> {
  return PRESENTATION_ROOTS.flatMap(getFiles)
    .filter((path) => [".astro", ".css"].includes(extname(path)))
    .map((path) => ({ path, source: readFileSync(path, "utf8") }));
}

describe("Frontier Atlas token contract", () => {
  test("defines the exact approved colors in the owned token file", () => {
    for (const [tokenName, expectedValue] of Object.entries(EXPECTED_COLOR_TOKENS)) {
      expect(getTokenValue(tokenName), tokenName).toBe(expectedValue);
    }
  });

  test("defines the complete spacing, grid, radius, focus, and motion scales", () => {
    for (const [tokenName, expectedValue] of Object.entries(EXPECTED_SPACING_TOKENS)) {
      expect(getTokenValue(tokenName), tokenName).toBe(expectedValue);
    }

    expect(getTokenValue("--atlas-content-max")).toBe("78rem");
    expect(getTokenValue("--atlas-reading-measure")).toBe("68ch");
    expect(getTokenValue("--atlas-radius")).toBe("0.125rem");
    expect(getTokenValue("--atlas-focus-outline")).toBe(
      "0.1875rem solid var(--atlas-color-focus)",
    );
    expect(getTokenValue("--atlas-focus-offset")).toBe("0.1875rem");
    expect(getTokenValue("--atlas-motion-interface")).toBe("120ms ease-out");
    expect(getTokenValue("--atlas-motion-disclosure")).toBe("160ms ease-out");
  });

  test("is explicitly light-only and has no automatic dark palette", () => {
    expect(TOKENS_SOURCE).toContain("color-scheme: light;");
    expect(TOKENS_SOURCE).not.toContain("color-scheme: light dark");
    expect(TOKENS_SOURCE).not.toMatch(/prefers-color-scheme\s*:\s*dark/i);
  });
});

describe("Frontier Atlas presentation safeguards", () => {
  test("keeps hexadecimal colors centralized in the token file", () => {
    const violations = getPresentationSources()
      .filter(({ path }) => path !== TOKENS_PATH)
      .filter(({ source }) => /#[0-9a-f]{3,8}\b/i.test(source))
      .map(({ path }) => path);

    expect(violations).toEqual([]);
  });

  test("rejects gradients, glass effects, and default shadows", () => {
    const violations = getPresentationSources().flatMap(({ path, source }) => {
      const usesGradient = /(?:linear|radial|conic)-gradient\s*\(/i.test(source);
      const usesBackdropFilter = /backdrop-filter\s*:/i.test(source);
      const shadowValues = [...source.matchAll(/box-shadow\s*:\s*([^;]+)/gi)].map((match) =>
        match[1]?.trim(),
      );
      const usesShadow = shadowValues.some((value) => value !== "none");
      return usesGradient || usesBackdropFilter || usesShadow ? [path] : [];
    });

    expect(violations).toEqual([]);
  });

  test("routes radii and focus outlines through the approved tokens", () => {
    const nonTokenRadiusValues = getPresentationSources()
      .filter(({ path }) => path !== TOKENS_PATH)
      .flatMap(({ source }) =>
        [...source.matchAll(/border-radius\s*:\s*([^;]+)/gi)].map((match) => match[1]?.trim()),
      )
      .filter((value) => value !== "var(--atlas-radius)");
    const baseSource = readFileSync(join(STYLES_ROOT, "base.css"), "utf8");

    expect(nonTokenRadiusValues).toEqual([]);
    expect(baseSource).toContain("outline: var(--atlas-focus-outline);");
    expect(baseSource).not.toMatch(/outline\s*:\s*none/i);
  });
});
