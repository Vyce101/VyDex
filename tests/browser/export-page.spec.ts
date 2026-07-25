// Verifies the Export JSON page, immutable download, responsive table, and accessibility.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const RELEASE_ID = "01900000-0000-7000-8000-000000000099";
const GENERATED_DATE = "2026-07-24";
const DOWNLOAD_FILENAME = `vydex-latest-entry-versions-v1-0-0-${GENERATED_DATE}.json`;
const DOWNLOAD_PATH = `/datasets/releases/${RELEASE_ID}/${DOWNLOAD_FILENAME}`;

test.beforeEach(async ({ page }) => {
  await page.goto("/export/");
});

test("renders the exact hierarchy through the active shared shell", async ({ page }) => {
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://vydex.example/export/",
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
  await expect(downloadLink).toHaveAttribute("href", DOWNLOAD_PATH);
  await expect(downloadLink).toHaveAttribute("download", DOWNLOAD_FILENAME);
  expect(await downloadLink.getAttribute("href")).not.toBe(
    "/datasets/vydex-latest-entry-versions-v1-0-0.json",
  );

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    downloadLink.click(),
  ]);
  expect(download.suggestedFilename()).toBe(DOWNLOAD_FILENAME);
});

test("publishes Schema-valid JSON matching the page count and UTC generation date", async ({ page, request }) => {
  const artifactResponse = await request.get(DOWNLOAD_PATH);
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
  expect(dataset.release_id).toBe(RELEASE_ID);
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
    await expect(page.locator("[data-export-download]")).toHaveAttribute("href", DOWNLOAD_PATH);
    await expect(page.getByRole("heading", { name: "Use Notes" })).toBeVisible();
  });
});
