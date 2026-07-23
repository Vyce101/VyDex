// Verifies the responsive, semantic, and accessible static fixture page.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders semantic content without horizontal overflow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Static foundation fixture" })).toBeVisible();

  const viewportFitsContent = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(viewportFitsContent).toBe(true);
});

test("loads project-owned fonts without external requests", async ({ page }) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.hostname !== "127.0.0.1") {
      externalRequests.push(request.url());
    }
  });

  await page.goto("/");
  const fontState = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      body: getComputedStyle(document.body).fontFamily,
      heading: getComputedStyle(document.querySelector("h1")!).fontFamily,
    };
  });

  expect(fontState.body).toContain("Source Sans 3 Variable");
  expect(fontState.heading).toContain("Source Serif 4 Variable");
  expect(externalRequests).toEqual([]);
});

test("has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/");
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(scan.violations).toEqual([]);
});

test("publishes the immutable Dataset 1.0.0 Schema", async ({ request }) => {
  const response = await request.get("/schemas/vydex-dataset/1.0.0.json");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/json");

  const text = await response.text();
  const schema = JSON.parse(text) as {
    $schema: string;
    $id: string;
    $defs: {
      dates: { properties: Record<string, { description?: string }> };
      entry: { properties: Record<string, { description?: string }> };
    };
  };
  expect(text.endsWith("\n")).toBe(true);
  expect(text.endsWith("\n\n")).toBe(false);
  expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
  expect(schema.$id).toBe("https://vydex.example/schemas/vydex-dataset/1.0.0.json");
  expect(schema.$defs.dates.properties.date_happened?.description).toContain("null means unknown");
  expect(schema.$defs.dates.properties.date_disclosed?.description).toContain("null means unknown");
  expect(schema.$defs.dates.properties.next_check_date?.description).toContain("no check is scheduled");
  expect(schema.$defs.entry.properties.potential_significance_if_confirmed?.description).toContain(
    "null means not applicable",
  );

  const hostingHeaders = await request.get("/_headers");
  expect(hostingHeaders.ok()).toBe(true);
  const hostingHeadersText = await hostingHeaders.text();
  expect(hostingHeadersText).toContain("Content-Type: application/schema+json; charset=utf-8");
  expect(hostingHeadersText).toContain("Cache-Control: public, max-age=31536000, immutable");
});

test.describe("without browser JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the core fixture readable", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("main")).toContainText("project build and browser-test harness");
    await expect(page.locator("script")).toHaveCount(0);
  });
});
