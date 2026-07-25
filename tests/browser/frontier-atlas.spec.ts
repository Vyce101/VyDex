// Verifies Frontier Atlas computed styles on the production-shaped Stage 1 Homepage.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

async function getStyles(locator: Locator, properties: string[]): Promise<Record<string, string>> {
  return locator.evaluate((element, requestedProperties) => {
    const computed = getComputedStyle(element);
    return Object.fromEntries(
      requestedProperties.map((property) => [property, computed.getPropertyValue(property)]),
    );
  }, properties);
}

async function getRootTokens(page: Page, tokenNames: string[]): Promise<Record<string, string>> {
  return page.evaluate((requestedTokens) => {
    const computed = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      requestedTokens.map((token) => [token, computed.getPropertyValue(token).trim()]),
    );
  }, tokenNames);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("exposes exact colors and remains unchanged under an OS dark preference", async ({ page }) => {
  const expectedTokens = {
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
  };
  const tokenNames = Object.keys(expectedTokens);

  expect(await getRootTokens(page, tokenNames)).toEqual(expectedTokens);
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await getRootTokens(page, tokenNames)).toEqual(expectedTokens);
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
});

test("applies approved Homepage, heading, card, editorial, and metadata typography", async ({ page }) => {
  const cases = [
    { width: 375, homepage: ["38px", "42px"], major: ["24px", "30px"], card: ["21px", "27px"] },
    { width: 768, homepage: ["46px", "50px"], major: ["24px", "30px"], card: ["21px", "27px"] },
    { width: 1100, homepage: ["56px", "60px"], major: ["28px", "34px"], card: ["24px", "30px"] },
  ] as const;

  for (const typographyCase of cases) {
    await page.setViewportSize({ width: typographyCase.width, height: 1000 });
    const homepage = await getStyles(page.locator(".atlas-type-homepage-title"), [
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
    ]);
    const major = await getStyles(page.locator(".atlas-type-major-heading").first(), [
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
    ]);
    const card = await getStyles(page.locator(".atlas-type-entry-card-title").first(), [
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
    ]);

    expect(homepage).toMatchObject({
      "font-size": typographyCase.homepage[0],
      "font-weight": "650",
      "line-height": typographyCase.homepage[1],
    });
    expect(homepage["font-family"]).toContain("Source Serif 4 Variable");
    expect(major).toMatchObject({
      "font-size": typographyCase.major[0],
      "font-weight": "700",
      "line-height": typographyCase.major[1],
    });
    expect(major["font-family"]).toContain("Source Sans 3 Variable");
    expect(card).toMatchObject({
      "font-size": typographyCase.card[0],
      "font-weight": "600",
      "line-height": typographyCase.card[1],
    });
    expect(card["font-family"]).toContain("Source Serif 4 Variable");
  }

  const editorial = await getStyles(page.locator(".homepage-hero__description"), [
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
  ]);
  expect(editorial).toMatchObject({ "font-size": "19px", "font-weight": "450", "line-height": "30px" });
  expect(editorial["font-family"]).toContain("Source Serif 4 Variable");
  await expect(page.locator(".homepage-hero__latest-label")).toHaveCSS("color", "rgb(23, 33, 43)");
  await expect(page.locator(".homepage-hero__latest-label")).toHaveCSS("font-size", "12px");
});

test("preserves page margins, maximum width, responsive grids, and overflow boundaries", async ({ page }) => {
  const cases = [
    { width: 375, margin: 16, contentWidth: 343 },
    { width: 767, margin: 20, contentWidth: 727 },
    { width: 768, margin: 24, contentWidth: 720 },
    { width: 1024, margin: 24, contentWidth: 976 },
    { width: 1312, margin: 32, contentWidth: 1248 },
    { width: 1440, margin: 32, contentWidth: 1248 },
  ];

  for (const gridCase of cases) {
    await page.setViewportSize({ width: gridCase.width, height: 1000 });
    const metrics = await page.locator(".atlas-page").evaluate((element) => {
      const computed = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return {
        contentWidth:
          bounds.width - Number.parseFloat(computed.paddingLeft) - Number.parseFloat(computed.paddingRight),
        paddingLeft: Number.parseFloat(computed.paddingLeft),
      };
    });
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));

    expect(metrics.paddingLeft).toBe(gridCase.margin);
    expect(metrics.contentWidth).toBeCloseTo(gridCase.contentWidth, 1);
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  }
});

test("styles sheets, controls, links, and statuses with approved interaction states", async ({ page }) => {
  const sheet = page.locator(".atlas-sheet").first();
  await expect(sheet).toHaveCSS("background-color", "rgb(252, 252, 250)");
  await expect(sheet).toHaveCSS("border-top-color", "rgb(199, 208, 214)");
  await expect(sheet).toHaveCSS("border-top-width", "1px");
  await expect(sheet).toHaveCSS("border-radius", "2px");
  await expect(sheet).toHaveCSS("box-shadow", "none");

  const primaryButton = page.getByRole("link", { name: "Read Latest Entries" });
  const secondaryButton = page.getByRole("link", { name: "View Methodology" });
  await expect(primaryButton).toHaveCSS("background-color", "rgb(0, 109, 156)");
  await primaryButton.hover();
  await expect(primaryButton).toHaveCSS("background-color", "rgb(0, 90, 131)");
  await expect(secondaryButton).toHaveCSS("background-color", "rgb(252, 252, 250)");
  await secondaryButton.hover();
  await expect(secondaryButton).toHaveCSS("border-top-color", "rgb(0, 109, 156)");

  const aboutLink = page.getByRole("link", { name: "About VyDex" });
  await expect(aboutLink).toHaveCSS("text-decoration-line", "underline");
  await aboutLink.focus();
  await expect(aboutLink).toHaveCSS("outline-color", "rgb(8, 146, 208)");
  await expect(aboutLink).toHaveCSS("outline-width", "3px");

  const statuses = page.locator("[data-homepage-latest] .atlas-status-tab");
  await expect(statuses).toHaveCount(3);
  for (const status of await statuses.all()) {
    await expect(status).toHaveCSS("border-radius", "2px");
    await expect(status).toHaveCSS("border-top-style", "solid");
  }
});

test("removes non-essential motion while preserving static content", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("link", { name: "Read Latest Entries" })).toHaveCSS(
    "transition-duration",
    "0s, 0s, 0s",
  );
  await expect(page.locator("[data-homepage-latest]")).toBeVisible();
  await expect(page.locator(".homepage-reading__band")).toBeVisible();
});

test("keeps evidence states understandable in grayscale and passes Axe", async ({ page }) => {
  await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
  const statuses = page.locator("[data-homepage-latest] .atlas-status-tab");
  await expect(statuses).toHaveText([
    "Claim: Supported",
    "Evidence: Strong",
    "Review: Follow-Up Needed",
  ]);
  for (const status of await statuses.all()) {
    await expect(status).toBeVisible();
    await expect(status).toHaveCSS("border-top-style", "solid");
  }

  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
});
