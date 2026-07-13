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

test.describe("without browser JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the core fixture readable", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("main")).toContainText("project build and browser-test harness");
    await expect(page.locator("script")).toHaveCount(0);
  });
});
