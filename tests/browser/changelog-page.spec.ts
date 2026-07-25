// Verifies the static material Changelog content, responsive index, and accessibility.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function setViewport(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 1000 });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/changelog/");
});

test("renders through the shared shell with canonical metadata and active navigation", async ({ page }) => {
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://vydex.example/changelog/",
  );
  await expect(page.locator('header [aria-current="page"]')).toHaveCount(2);
  await expect(page.locator('header [aria-current="page"]')).toHaveText(["Changelog", "Changelog"]);
  await expect(page.locator("[data-site-header]")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.locator("footer")).toHaveCount(1);
});

test("renders the required hierarchy, section order, legend, and launch events", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Changelog");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Change Types", "Changes"]);
  expect(
    await page.locator("[data-changelog-page] > [data-changelog-section]").evaluateAll((sections) =>
      sections.map((section) => section.getAttribute("data-changelog-section")),
    ),
  ).toEqual(["header", "change-types", "changes"]);

  await expect(page.locator(".changelog-header__intro")).toHaveText(
    "Material changes to the VyDex evidence ledger.",
  );
  await expect(page.locator(".changelog-header__explanation")).toHaveText(
    "This page records new entries, meaningful updates, removals, and methodology changes.",
  );
  await expect(page.locator(".changelog-change-types__cell dt")).toHaveText([
    "Added",
    "Updated",
    "Removed",
    "Methodology Change",
  ]);
  await expect(page.locator(".changelog-change-types__cell dd")).toHaveText([
    "New entry added to the ledger.",
    "Important source, status, evidence, caveat, context, or interpretation changed.",
    "Entry removed because it no longer meets criteria or no longer supports the frontier interpretation.",
    "Rules, labels, categories, or judgment standards changed.",
  ]);

  await expect(page.locator("[data-changelog-date-group] > h3")).toHaveText([
    "2026-07-25",
    "2026-07-24",
  ]);
  await expect(page.locator("[data-changelog-record]")).toHaveCount(5);
  await expect(page.locator("[data-changelog-date-group]").nth(0).locator("[data-changelog-record]"))
    .toHaveAttribute("data-change-type", "updated");
  await expect(
    page.locator("[data-changelog-date-group]").nth(1).locator(".changelog-type-tab"),
  ).toHaveText(["Added", "Added", "Added", "Methodology Change"]);
  await expect(page.getByRole("heading", { level: 4, name: "Methodology v1.0.0 Published" }))
    .toHaveCount(1);
});

test("uses semantic date-only output and record-specific accessible link names", async ({ page }) => {
  const dates = page.locator("[data-changelog-date-group] time");
  await expect(dates).toHaveCount(2);
  await expect(dates.nth(0)).toHaveAttribute("datetime", "2026-07-25");
  await expect(dates.nth(1)).toHaveAttribute("datetime", "2026-07-24");
  await expect(page.getByRole("main")).not.toContainText(/19:21:21|20:18:26|13:03:03/);

  const entryLinks = page.locator('a[aria-label^="View Entry:"]');
  await expect(entryLinks).toHaveCount(4);
  await expect(entryLinks).toHaveText(["View Entry →", "View Entry →", "View Entry →", "View Entry →"]);
  const methodologyLink = page.getByRole("link", {
    name: "View Methodology: Methodology v1.0.0 Published",
  });
  await expect(methodologyLink).toHaveText("View Methodology →");
  await expect(methodologyLink).toHaveAttribute(
    "href",
    "https://vydex.example/methodology/1.0.0/",
  );
});

test("switches the ruled legend and date rail at approved breakpoints without overflow", async ({ page }) => {
  await setViewport(page, 375);
  await expect(page.locator(".changelog-change-types__cell").nth(1)).toHaveCSS(
    "border-top-width",
    "1px",
  );
  await expect(page.locator(".changelog-change-types__cell").nth(1)).toHaveCSS(
    "border-left-width",
    "0px",
  );
  expect(
    await page.locator(".changelog-date-group").first().evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(1);

  await setViewport(page, 768);
  await expect(page.locator(".changelog-change-types__cell").nth(1)).toHaveCSS(
    "border-top-width",
    "0px",
  );
  await expect(page.locator(".changelog-change-types__cell").nth(1)).toHaveCSS(
    "border-left-width",
    "1px",
  );
  expect(
    await page.locator(".changelog-change-types__band").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(4);
  expect(
    await page.locator(".changelog-date-group").first().evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(1);

  await setViewport(page, 1024);
  expect(
    await page.locator(".changelog-date-group").first().evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(12);

  for (const width of [320, 375, 768, 1024, 1440]) {
    await setViewport(page, width);
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll, `${width}px viewport`).toBeLessThanOrEqual(dimensions.client);
  }
});

test("keeps type meaning visible, focus accessible, and feed UI absent", async ({ page }) => {
  await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
  await expect(page.locator('.changelog-type-tab[data-change-type="removed"]')).toHaveText("Removed");
  await expect(page.locator('.changelog-type-tab[data-change-type="added"]').first()).toHaveText("Added");

  const firstLink = page.locator('a[aria-label^="View Entry:"]').first();
  await firstLink.focus();
  await expect(firstLink).toHaveCSS("outline-width", "3px");

  const main = page.getByRole("main");
  await expect(main.locator("input, select, form, canvas, img, picture, svg, progress")).toHaveCount(0);
  await expect(main.locator('[role="search"], [role="tab"], [aria-busy="true"]')).toHaveCount(0);
  await expect(main).not.toContainText(/Latest News|Trending|Breaking|Latest\/Older|Celebrat/);
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
});

test("requires no runtime loading to render the complete Changelog", async ({ page }) => {
  const dynamicRequests: string[] = [];
  page.on("request", (request) => {
    if (["fetch", "xhr"].includes(request.resourceType())) dynamicRequests.push(request.url());
  });

  await page.reload();
  await expect(page.locator("[data-changelog-record]")).toHaveCount(5);
  expect(dynamicRequests).toEqual([]);
});

test.describe("without browser JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps every material event in normal readable flow", async ({ page }) => {
    await page.goto("/changelog/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Changelog");
    await expect(page.locator("[data-changelog-record]")).toHaveCount(5);
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });
});
