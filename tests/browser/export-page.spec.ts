// Verifies the Export JSON page, immutable download, responsive table, and accessibility.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { EXPECTED_SITE_ORIGIN } from "./playwright-config";

const DOWNLOAD_PATH_PATTERN = /^\/datasets\/releases\/[0-9a-f-]+\/vydex-latest-entry-versions-v1-0-0-\d{4}-\d{2}-\d{2}\.json$/;

test.beforeEach(async ({ page }) => {
  await page.goto("/export/");
});

test("renders the exact hierarchy through the active shared shell", async ({ page }) => {
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${EXPECTED_SITE_ORIGIN}/export/`,
  );
  await expect(page.locator('header [aria-current="page"]')).toHaveText([
    "Export JSON",
    "Export JSON",
  ]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Export JSON");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Current Export",
    "What’s Included",
    "Stage 1 Limits",
    "Use Notes",
  ]);
  expect(
    await page.locator("[data-export-page] > [data-export-section]").evaluateAll((sections) =>
      sections.map((section) => section.getAttribute("data-export-section")),
    ),
  ).toEqual([
    "export-header",
    "current-export",
    "whats-included",
    "stage-one-limits",
    "use-notes",
  ]);
});

test("links directly to the dated immutable artifact and downloads with its generated filename", async ({ page }) => {
  const downloadLink = page.locator("[data-export-download]");
  const downloadPath = await downloadLink.getAttribute("href");
  const downloadFilename = await downloadLink.getAttribute("download");
  expect(downloadPath).toMatch(DOWNLOAD_PATH_PATTERN);
  expect(downloadFilename).toMatch(/^vydex-latest-entry-versions-v1-0-0-\d{4}-\d{2}-\d{2}\.json$/);
  expect(downloadPath).not.toBe(
    "/datasets/vydex-latest-entry-versions-v1-0-0.json",
  );

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    downloadLink.click(),
  ]);
  expect(download.suggestedFilename()).toBe(downloadFilename);
});

test("publishes Schema-valid JSON matching the page count and UTC generation date", async ({ page, request }) => {
  const downloadPath = await page.locator("[data-export-download]").getAttribute("href");
  expect(downloadPath).toMatch(DOWNLOAD_PATH_PATTERN);
  const artifactResponse = await request.get(downloadPath!);
  expect(artifactResponse.ok()).toBe(true);
  expect(artifactResponse.headers()["content-type"]).toContain("application/json");
  const dataset = await artifactResponse.json();

  const schemaResponse = await request.get("/schemas/vydex-dataset/1.0.0.json");
  expect(schemaResponse.ok()).toBe(true);
  const schema = await schemaResponse.json();
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  expect(validate(dataset), JSON.stringify(validate.errors, null, 2)).toBe(true);

  await expect(page.locator("[data-export-entry-count]")).toHaveText(String(dataset.entry_count));
  await expect(page.locator("[data-export-generated-date]")).toHaveText(
    dataset.generated_at.slice(0, 10),
  );
  expect(downloadPath).toBe(
    `/datasets/releases/${dataset.release_id}/vydex-latest-entry-versions-v1-0-0-${dataset.generated_at.slice(0, 10)}.json`,
  );
  expect(dataset.scope).toBe("latest_entry_versions");
});

test("states Stage 1 limits without unsupported product or archive claims", async ({ page }) => {
  await expect(page.getByText("This export is not a full historical archive.")).toBeVisible();
  await expect(page.getByText("No historical entry versions")).toBeVisible();
  await expect(page.getByText("No custom filters")).toBeVisible();
  await expect(page.getByText("No CSV export")).toBeVisible();
  await expect(page.getByText("No public API")).toBeVisible();
  for (const unsupportedText of [
    "Developer Platform",
    "Premium Data",
    "Complete Dataset",
    "Get Access",
    "View Entries",
    "llms.txt",
  ]) {
    await expect(page.getByText(unsupportedText, { exact: true })).toHaveCount(0);
  }
});

test("stacks essential table records on mobile and preserves visible download focus", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(page.locator(".export-included tbody")).toHaveCSS("display", "block");
  await expect(page.locator(".export-included td").first()).toHaveCSS("display", "grid");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);

  const downloadLink = page.locator("[data-export-download]");
  await downloadLink.focus();
  await expect(downloadLink).toHaveCSS("outline-style", "solid");
  await expect(downloadLink).toHaveCSS("outline-width", "3px");

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator(".export-included tbody")).toHaveCSS("display", "table-row-group");
  await expect(page.locator(".export-included td").first()).toHaveCSS("display", "table-cell");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
});

test("has no automatically detectable accessibility violations", async ({ page }) => {
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
});

test.describe("without browser JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the complete export record and download available", async ({ page }) => {
    await page.goto("/export/");
    await expect(page.getByRole("heading", { name: "Current Export" })).toBeVisible();
    await expect(page.locator("[data-export-download]")).toHaveAttribute("href", DOWNLOAD_PATH_PATTERN);
    await expect(page.getByRole("heading", { name: "Use Notes" })).toBeVisible();
  });
});
