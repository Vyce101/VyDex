// Verifies the static About page content, responsive rules, navigation, and accessibility.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function setViewport(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 1000 });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/about/");
});

test("renders through the shared shell with a canonical URL and active About navigation", async ({ page }) => {
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://vydex.example/about/",
  );
  const activeLinks = page.locator('header [aria-current="page"]');
  await expect(activeLinks).toHaveCount(2);
  await expect(activeLinks).toHaveText(["About", "About"]);
  await expect(page.locator('[data-site-header] a[href="/#latest"]')).toHaveCount(2);
  await expect(page.locator("[data-site-header]")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.locator("footer")).toHaveCount(1);
});

test("renders the exact heading hierarchy, section order, and canonical identity copy", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About VyDex");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "What VyDex Is",
    "Why VyDex Exists",
    "Who Runs VyDex",
    "Scope Limits",
    "Coverage Baseline",
    "How VyDex Stays Careful",
    "Related Links",
  ]);
  expect(
    await page.locator("[data-about-page] > [data-about-section]").evaluateAll((sections) =>
      sections.map((section) => section.getAttribute("data-about-section")),
    ),
  ).toEqual([
    "about-header",
    "what-vydex-is",
    "why-vydex-exists",
    "who-runs-vydex",
    "scope-limits",
    "coverage-baseline",
    "how-vydex-stays-careful",
    "related-links",
  ]);

  await expect(page.locator(".about-header__lead")).toHaveText(
    "VyDex tracks important frontier claims with evidence, caveats, sources, and updates.",
  );
  await expect(page.locator(".about-header__positioning")).toHaveText(
    "Not AI news. Not a hype feed.",
  );
  await expect(page.getByRole("link", { name: "Luke Daniels" })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/ljdaniels101/",
  );
  await expect(page.getByRole("link", { name: "Vyce" })).toHaveAttribute(
    "href",
    "https://github.com/Vyce101",
  );
  await expect(page.locator(".about-maintainer__label")).toHaveText("Maintainer");
});

test("renders ordered actions, scope rows, carefulness cells, and semantic related links", async ({ page }) => {
  const actions = page.locator(".about-header__actions > a");
  await expect(actions).toHaveText(["Read Latest Entries", "View Methodology"]);
  await expect(actions.nth(0)).toHaveAttribute("href", "/#latest");
  await expect(actions.nth(1)).toHaveAttribute("href", "/methodology/");
  await expect(page.getByRole("link", { name: "View the Methodology →" })).toHaveAttribute(
    "href",
    "/methodology/",
  );
  await expect(page.getByRole("link", { name: "Read the Methodology →" })).toHaveAttribute(
    "href",
    "/methodology/",
  );

  await expect(page.locator(".about-scope-limits > li > h3")).toHaveText([
    "Curated, Not Exhaustive",
    "English-Language Bias",
    "Verification Varies by Domain",
    "AI-Heavy Coverage",
    "Evidence Can Change",
  ]);
  await expect(page.locator(".about-carefulness-band__cell > h3")).toHaveText([
    "Methodology",
    "Sources",
    "Updates",
  ]);
  await expect(page.locator(".about-related-links")).toHaveJSProperty("tagName", "UL");
  await expect(page.locator(".about-related-links > li")).toHaveCount(3);
  for (const [label, href] of [
    ["Methodology", "https://vydex.example/methodology/"],
    ["Changelog", "https://vydex.example/changelog/"],
    ["Export JSON", "https://vydex.example/export/"],
  ] as const) {
    await expect(page.locator(".about-related-links").getByRole("link", { name: label })).toHaveAttribute(
      "href",
      href,
    );
  }
});

test("keeps actions and ruled structures responsive without horizontal overflow", async ({ page }) => {
  await setViewport(page, 375);
  const headerWidth = (await page.locator(".about-header").boundingBox())?.width;
  const primaryWidth = (await page.getByRole("link", { name: "Read Latest Entries" }).boundingBox())?.width;
  const secondaryWidth = (await page.getByRole("link", { name: "View Methodology" }).boundingBox())?.width;
  expect(primaryWidth).toBeCloseTo(headerWidth ?? 0, 0);
  expect(secondaryWidth).toBeCloseTo(headerWidth ?? 0, 0);
  await expect(page.locator(".about-scope-limits > li").first()).toHaveCSS("padding-top", "20px");
  await expect(page.locator(".about-carefulness-band__cell").nth(1)).toHaveCSS(
    "border-top-width",
    "1px",
  );
  await expect(page.locator(".about-carefulness-band__cell").nth(1)).toHaveCSS(
    "border-left-width",
    "0px",
  );

  await setViewport(page, 768);
  expect((await page.getByRole("link", { name: "Read Latest Entries" }).boundingBox())?.width).toBeLessThan(
    (await page.locator(".about-header").boundingBox())?.width ?? Number.POSITIVE_INFINITY,
  );
  await expect(page.locator(".about-scope-limits > li").first()).toHaveCSS("padding-top", "24px");
  await expect(page.locator(".about-carefulness-band__cell").nth(1)).toHaveCSS(
    "border-top-width",
    "0px",
  );
  await expect(page.locator(".about-carefulness-band__cell").nth(1)).toHaveCSS(
    "border-left-width",
    "1px",
  );

  for (const width of [320, 375, 768, 1024, 1440]) {
    await setViewport(page, width);
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll, `${width}px viewport`).toBeLessThanOrEqual(dimensions.client);
  }
});

test("uses accessible static HTML and omits prohibited content and runtime UI", async ({ page }) => {
  const main = page.getByRole("main");
  await expect(main.locator("img, picture, svg, canvas, figure, input, select, textarea, progress")).toHaveCount(0);
  await expect(main.locator('[role="search"], form, [aria-busy="true"], [class*="loading"]')).toHaveCount(0);
  await expect(main.locator(".atlas-sheet")).toHaveCount(0);
  await expect(main).not.toContainText(
    /Coming Soon|Contact|Donations|Submissions|Reports|Media|Credentials|Education/,
  );
  await expect(page.getByText("Maintainer details not added yet.")).toHaveCount(0);

  const primaryAction = page.getByRole("link", { name: "Read Latest Entries" });
  await primaryAction.focus();
  await expect(primaryAction).toHaveCSS("outline-width", "3px");
  expect(await primaryAction.evaluate((link) => link.tabIndex)).toBe(0);

  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
});

test("requires no fetch or XHR requests to render canonical About content", async ({ page }) => {
  const dynamicRequests: string[] = [];
  page.on("request", (request) => {
    if (["fetch", "xhr"].includes(request.resourceType())) dynamicRequests.push(request.url());
  });

  await page.reload();
  await expect(page.locator("[data-about-page]")).toBeVisible();
  expect(dynamicRequests).toEqual([]);
});
