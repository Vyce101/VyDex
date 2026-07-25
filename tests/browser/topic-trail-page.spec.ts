// Verifies generated Topic Trail routes, metadata, previews, accessibility, and 404 behavior.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const TRAILS = [
  {
    path: "/topic-trails/ai-agents-in-software-engineering/",
    name: "AI agents in software engineering",
    lastActivity: "2026-07-24",
    entryTitle: "METR finds frontier AI software-task horizons doubling about every seven months",
  },
  {
    path: "/topic-trails/ai-in-operational-weather-forecasting/",
    name: "AI in operational weather forecasting",
    lastActivity: "2026-07-24",
    entryTitle:
      "NHC verification finds Google DeepMind’s GDMI leading individual hurricane guidance in 2025",
  },
  {
    path: "/topic-trails/world-models-for-agent-training/",
    name: "World models for agent training",
    lastActivity: "2026-07-25",
    entryTitle:
      "Dreamer 4 becomes first reported agent to obtain Minecraft diamonds using only offline training data",
  },
] as const;

const DEFAULT_TRAIL = TRAILS[2];

async function openDefaultTrail(page: Page): Promise<void> {
  await page.goto(DEFAULT_TRAIL.path);
}

test("generates exactly one working route for every seed Topic Trail", async ({ request }) => {
  expect(new Set(TRAILS.map(({ path }) => path)).size).toBe(3);
  for (const trail of TRAILS) {
    const response = await request.get(trail.path);
    expect(response.status(), trail.path).toBe(200);
    const html = await response.text();
    expect(html).toContain(`>${trail.name}</h1>`);
    expect(html).toContain(trail.entryTitle);
  }
});

test("renders the required page sequence, exact metadata, and current-trail footer", async ({ page }) => {
  await openDefaultTrail(page);
  const main = page.getByRole("main");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(DEFAULT_TRAIL.name);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Entries in This Trail");
  await expect(main.locator("h1")).toHaveCount(1);
  expect(
    await main.locator("[data-topic-trail-section]").evaluateAll((sections) =>
      sections.map((section) => section.getAttribute("data-topic-trail-section")),
    ),
  ).toEqual(["trail-header", "metadata", "trail-note", "entries"]);

  const metadata = main.locator("[data-topic-trail-section='metadata']");
  await expect(metadata.locator("dt")).toHaveText([
    "Entries in VyDex:",
    "Last Activity:",
    "Default Order:",
  ]);
  await expect(metadata.locator("dd")).toHaveText(["1", DEFAULT_TRAIL.lastActivity, "Latest Updates"]);
  await expect(metadata.locator("time")).toHaveAttribute("datetime", DEFAULT_TRAIL.lastActivity);

  const note = main.locator("[data-topic-trail-section='trail-note']");
  await expect(note).toContainText(
    "Topic Trails group related entries over time. They are not complete histories.",
  );
  await expect(note.getByRole("link", { name: "How Topic Trails Are Defined →" })).toHaveAttribute(
    "href",
    "/methodology/#topic-trails",
  );

  const previews = main.locator("[data-topic-trail-entry-list] [data-entry-preview]");
  await expect(previews).toHaveCount(1);
  await expect(previews.getByRole("link", { name: DEFAULT_TRAIL.entryTitle, exact: true })).toBeVisible();
  await expect(
    previews.getByRole("link", { name: `Topic Trail: ${DEFAULT_TRAIL.name}`, exact: true }),
  ).toHaveAttribute("href", new RegExp(`${DEFAULT_TRAIL.path}$`));
});

test("keeps Header navigation inactive and preserves canonical route metadata", async ({ page }) => {
  await openDefaultTrail(page);

  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.locator("header [aria-current]")).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`${DEFAULT_TRAIL.path}$`),
  );
  await expect(page).toHaveTitle(`${DEFAULT_TRAIL.name} — VyDex`);
});

test("uses a quieter preview treatment without changing its content or links", async ({ page }) => {
  await openDefaultTrail(page);
  const preview = page.locator("[data-topic-trail-entry-list] [data-entry-preview]");

  await expect(preview).toHaveAttribute("data-entry-preview-treatment", "quiet");
  await expect(preview).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(preview).toHaveCSS("border-left-width", "0px");
  await expect(preview).toHaveCSS("border-radius", "2px");
  await expect(preview.locator("[data-entry-preview-field]")).toHaveCount(9);
  await expect(preview.getByRole("link", { name: `Read Entry: ${DEFAULT_TRAIL.entryTitle}` })).toBeVisible();
});

test("stacks metadata, keeps compact text readable, and prevents horizontal overflow", async ({ page }) => {
  await openDefaultTrail(page);
  const metadata = page.locator("[data-topic-trail-section='metadata']");

  await page.setViewportSize({ width: 375, height: 900 });
  await expect(metadata).toHaveCSS("grid-template-columns", /.+/);
  await expect(metadata.locator("div").nth(1)).toHaveCSS("border-top-width", "1px");
  await expect(metadata).toHaveCSS("font-size", "12px");

  for (const width of [320, 375, 767, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  }

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(metadata.locator("div").nth(1)).toHaveCSS("border-left-width", "1px");
  await expect(metadata.locator("div").nth(1)).toHaveCSS("border-top-width", "0px");
});

test("keeps every page link keyboard reachable with visible focus", async ({ page }) => {
  await openDefaultTrail(page);
  const main = page.getByRole("main");

  for (const link of await main.getByRole("link").all()) {
    await link.focus();
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS("outline-width", "3px");
  }
});

test("omits prohibited controls, media, causal connectors, and completeness claims", async ({ page }) => {
  await openDefaultTrail(page);
  const main = page.getByRole("main");

  await expect(main.locator("img, picture, svg, canvas, figure, progress, input, select, button")).toHaveCount(0);
  await expect(main).not.toContainText(
    /\b(?:Search|Filters|Sort|Date Range|Timeline|Chart|Related Trails|Subscribe|Follow|Popularity|Top Entries|Complete History)\b/i,
  );
  await expect(main.locator("[class*='connector'], [class*='timeline']")).toHaveCount(0);
});

test("has no automatically detectable accessibility violations", async ({ page }) => {
  await openDefaultTrail(page);
  const scan = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
});

test("serves an unknown Topic Trail slug through the existing static 404", async ({ page }) => {
  const unknownPath = "/topic-trails/not-a-genuine-trail/";
  const response = await page.goto(unknownPath);

  expect(response?.status()).toBe(404);
  expect(new URL(page.url()).pathname).toBe(unknownPath);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  await expect(page.locator("[data-topic-trail-page]")).toHaveCount(0);
});

test.describe("without browser JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the complete Topic Trail and Entry preview in normal HTML", async ({ page }) => {
    await openDefaultTrail(page);
    await expect(page.locator("[data-topic-trail-page]")).toBeVisible();
    await expect(page.locator("[data-topic-trail-entry-list] [data-entry-preview]")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(DEFAULT_TRAIL.name);
  });
});
