// Verifies static Methodology routes, anchors, responsive records, and Entry help links.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { EXPECTED_SITE_ORIGIN } from "./playwright-config";

const METHODOLOGY_ROUTES = ["/methodology/", "/methodology/1.0.0/"] as const;
const JUMP_TARGETS = [
  "inclusion-standard",
  "claim-appraisal",
  "claim-status",
  "evidence-strength",
  "review-status",
  "entry-state",
  "frontier-delta",
  "significance",
  "caveats",
  "sources-and-evidence-types",
  "dates-and-evidence-monitoring",
  "topic-trails",
  "domains",
  "entry-titles",
  "versioning",
] as const;
const ENTRY_HELP_TARGETS = [
  "domains",
  "topic-trails",
  "evidence-types",
  "used-for",
  "source-roles",
  "significance",
  "review-status",
] as const;
const ENTRY_PATH = "/entries/dreamer-4-offline-minecraft-diamonds/";

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

test("generates current and immutable routes from identical substantive content", async ({ page }) => {
  const renderedContent: string[] = [];

  for (const route of METHODOLOGY_ROUTES) {
    const dynamicRequests: string[] = [];
    page.on("request", (request) => {
      if (["fetch", "xhr"].includes(request.resourceType())) dynamicRequests.push(request.url());
    });
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("[data-methodology-page]")).toBeVisible();
    renderedContent.push(await page.locator("[data-methodology-page]").innerHTML());
    expect(dynamicRequests).toEqual([]);
  }

  expect(renderedContent[1]).toBe(renderedContent[0]);
});

test("uses route-specific self canonical links and active shared navigation", async ({ page }) => {
  for (const route of METHODOLOGY_ROUTES) {
    await page.goto(route);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${EXPECTED_SITE_ORIGIN}${route}`,
    );
    const activeLinks = page.locator('header [aria-current="page"]');
    await expect(activeLinks).toHaveCount(2);
    await expect(activeLinks).toHaveText(["Methodology", "Methodology"]);
    await expect(page.locator('header a[href="/#latest"]')).toHaveCount(2);
  }
});

test("renders the exact heading hierarchy and protected canonical content", async ({ page }) => {
  await page.goto(METHODOLOGY_ROUTES[0]);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Methodology");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Inclusion Rule",
    "Jump To",
    "Inclusion Standard",
    "Claim Appraisal",
    "Public Labels",
    "Entry Fields",
    "Sources and Evidence Types",
    "Dates and Evidence Monitoring",
    "Topic Trails and Domains",
    "Entry Titles",
    "Versioning",
  ]);
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "Claim Status",
    "Evidence Strength",
    "Review Status",
    "Entry State",
    "Frontier Delta",
    "Significance",
    "Caveats",
    "Evidence Types",
    "Used For",
    "Source Roles",
    "Source Ordering",
    "Date Fields",
    "Evidence Monitoring",
    "Topic Trails",
    "Domains",
  ]);
  await expect(page.locator(".methodology-version-strip")).toContainText(
    "Current Versionv1.0.0Effective From2026-07-24Version TypeMajor",
  );
  await expect(page.getByText(/Review Reason explains why an Entry is marked Follow-Up Needed/)).toBeVisible();
  await expect(page.locator("#evidence-types tbody tr")).toHaveCount(12);
  await expect(page.locator("#domains tbody tr")).toHaveCount(12);
  await expect(page.locator("#entry-state tbody tr")).toHaveCount(2);
  await expect(page.getByText("Volatile", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Watchlist", { exact: true })).toHaveCount(0);
});

test("resolves every Jump To target with focus and scroll spacing", async ({ page }) => {
  for (const route of METHODOLOGY_ROUTES) {
    await page.goto(route);
    const jumpLinks = page.locator(".methodology-jump a");
    await expect(jumpLinks).toHaveCount(JUMP_TARGETS.length);
    expect(await jumpLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual(
      JUMP_TARGETS.map((target) => `#${target}`),
    );

    for (const target of JUMP_TARGETS) {
      await expect(page.locator(`#${target}`), target).toHaveCount(1);
    }

    const firstLink = jumpLinks.first();
    await firstLink.focus();
    await expect(firstLink).toHaveCSS("outline-width", "3px");
    await expect(page.locator("#inclusion-standard")).toHaveCSS("scroll-margin-top", "24px");
  }
});

test("keeps tables semantic on desktop and labeled stacked records on mobile", async ({ page }) => {
  await page.goto(METHODOLOGY_ROUTES[0]);
  const table = page.locator("#claim-status table");
  await expect(table.locator("th")).toHaveText(["Status", "Meaning", "UI Treatment"]);

  await page.setViewportSize({ width: 375, height: 1000 });
  await expect(table.locator("thead")).toHaveCSS("position", "absolute");
  await expect(table.locator("td").first()).toHaveCSS("display", "grid");
  expect(
    await table.locator("td").first().evaluate((element) => getComputedStyle(element, "::before").content),
  ).toBe('"Status"');
  await expect(page.locator(".methodology-jump ol")).toHaveCSS(
    "grid-template-columns",
    /\d+(?:\.\d+)?px/,
  );
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 1024, height: 1000 });
  await expect(table.locator("thead")).toHaveCSS("display", "table-header-group");
  await expect(table.locator("td").first()).toHaveCSS("display", "table-cell");
  const desktopJumpColumns = await page.locator(".methodology-jump ol").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").length,
  );
  expect(desktopJumpColumns).toBe(3);
  await expectNoHorizontalOverflow(page);
});

test("links Entry explanatory labels to immutable Methodology anchors", async ({ page }) => {
  await page.goto(ENTRY_PATH);
  const expectedVisibleLinks = [
    ["Domain", "domains"],
    ["Topic Trail", "topic-trails"],
    ["Evidence Type", "evidence-types"],
    ["Used For", "used-for"],
    ["Source Role", "source-roles"],
    ["Potential Significance If Confirmed", "significance"],
  ] as const;

  for (const [label, target] of expectedVisibleLinks) {
    const links = page.getByRole("link", { name: label, exact: true });
    expect(await links.count(), label).toBeGreaterThan(0);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute(
        "href",
        `${EXPECTED_SITE_ORIGIN}/methodology/1.0.0/#${target}`,
      );
    }
  }

  await expect(page.getByText("AI Capabilities", { exact: true }).first()).not.toHaveAttribute("href");
  await expect(page.getByRole("link", { name: "World models for agent training" }).first()).toHaveAttribute(
    "href",
    /\/topic-trails\/world-models-for-agent-training\/$/,
  );

  for (const target of ENTRY_HELP_TARGETS) {
    for (const route of METHODOLOGY_ROUTES) {
      await page.goto(`${route}#${target}`);
      await expect(page.locator(`#${target}`), `${route}#${target}`).toHaveCount(1);
    }
  }
});

test("passes accessibility checks and omits prohibited documentation-template UI", async ({ page }) => {
  await page.goto(METHODOLOGY_ROUTES[0]);
  const main = page.getByRole("main");
  await expect(main.locator("img, picture, svg, canvas, progress, input, select, button")).toHaveCount(0);
  await expect(main.locator("details, [role='tab'], [class*='sidebar'], [class*='sticky']")).toHaveCount(0);
  await expect(main).not.toContainText(/Compare Versions|Version Archive|Older Versions/);

  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
});

test("does not generate fake immutable Methodology versions", async ({ page }) => {
  const response = await page.goto("/methodology/2.0.0/");
  expect(response?.status()).toBe(404);
  await expect(page.locator("[data-methodology-page]")).toHaveCount(0);
});

test.describe("without browser JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps every core definition in normal readable flow", async ({ page }) => {
    await page.goto(METHODOLOGY_ROUTES[1]);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Methodology");
    await expect(page.locator("#evidence-types tbody tr")).toHaveCount(12);
    await expect(page.locator("#domains tbody tr")).toHaveCount(12);
    await expect(page.getByText("Current Stage 1 methodology version: v1.0.0")).toBeVisible();
  });
});
