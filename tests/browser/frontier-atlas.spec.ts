// Verifies Frontier Atlas computed styles, responsive behavior, and state accessibility.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const VIEWPORT_HEIGHT = 900;

async function setViewport(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
}

async function getStyles(locator: Locator, properties: string[]): Promise<Record<string, string>> {
  return locator.evaluate((element, requestedProperties) => {
    const computed = getComputedStyle(element);
    return Object.fromEntries(requestedProperties.map((property) => [property, computed.getPropertyValue(property)]));
  }, properties);
}

async function getRootTokens(page: Page, tokenNames: string[]): Promise<Record<string, string>> {
  return page.evaluate((requestedTokens) => {
    const computed = getComputedStyle(document.documentElement);
    return Object.fromEntries(requestedTokens.map((token) => [token, computed.getPropertyValue(token).trim()]));
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

test("applies the approved typography roles at mobile, tablet, and desktop widths", async ({ page }) => {
  const cases = [
    {
      width: 375,
      homepage: ["38px", "42px", 0.684],
      entry: ["34px", "40px", 0.408],
      major: ["24px", "30px"],
      card: ["21px", "27px"],
      evidence: ["17px", "27px"],
    },
    {
      width: 768,
      homepage: ["46px", "50px", 0.828],
      entry: ["34px", "40px", 0.408],
      major: ["24px", "30px"],
      card: ["21px", "27px"],
      evidence: ["17px", "27px"],
    },
    {
      width: 1024,
      homepage: ["56px", "60px", 1.4],
      entry: ["44px", "50px", 0.792],
      major: ["28px", "34px"],
      card: ["24px", "30px"],
      evidence: ["18px", "29px"],
    },
  ] as const;

  for (const typographyCase of cases) {
    await setViewport(page, typographyCase.width);
    const homepage = await getStyles(page.locator(".atlas-type-homepage-title"), [
      "font-family",
      "font-size",
      "font-weight",
      "letter-spacing",
      "line-height",
    ]);
    const entry = await getStyles(page.locator(".atlas-type-entry-title"), [
      "font-family",
      "font-size",
      "font-weight",
      "letter-spacing",
      "line-height",
    ]);
    const major = await getStyles(page.locator(".atlas-type-major-heading").first(), [
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
    ]);
    const card = await getStyles(page.locator(".atlas-type-entry-card-title"), [
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
    ]);
    const evidence = await getStyles(page.locator(".atlas-type-evidence-body"), [
      "font-family",
      "font-size",
      "line-height",
    ]);

    expect(homepage["font-family"]).toContain("Source Serif 4 Variable");
    expect(homepage["font-size"]).toBe(typographyCase.homepage[0]);
    expect(homepage["line-height"]).toBe(typographyCase.homepage[1]);
    expect(homepage["font-weight"]).toBe("650");
    expect(Number.parseFloat(homepage["letter-spacing"] ?? "")).toBeCloseTo(
      typographyCase.homepage[2],
      3,
    );
    expect(entry["font-family"]).toContain("Source Serif 4 Variable");
    expect(entry["font-size"]).toBe(typographyCase.entry[0]);
    expect(entry["line-height"]).toBe(typographyCase.entry[1]);
    expect(entry["font-weight"]).toBe("650");
    expect(Number.parseFloat(entry["letter-spacing"] ?? "")).toBeCloseTo(typographyCase.entry[2], 3);
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
    expect(evidence["font-size"]).toBe(typographyCase.evidence[0]);
    expect(evidence["line-height"]).toBe(typographyCase.evidence[1]);
    expect(evidence["font-family"]).toContain("Source Serif 4 Variable");
  }

  const editorial = await getStyles(page.locator(".atlas-type-editorial-lead"), [
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
  ]);
  const metadata = await getStyles(page.locator(".atlas-type-metadata").first(), [
    "font-family",
    "font-size",
    "font-weight",
    "font-variant-numeric",
    "letter-spacing",
    "line-height",
  ]);
  expect(editorial).toMatchObject({ "font-size": "19px", "font-weight": "450", "line-height": "30px" });
  expect(editorial["font-family"]).toContain("Source Serif 4 Variable");
  expect(metadata).toMatchObject({
    "font-size": "12px",
    "font-weight": "600",
    "font-variant-numeric": "tabular-nums",
    "line-height": "16px",
  });
  expect(metadata["font-family"]).toContain("Source Sans 3 Variable");
});

test("implements the approved grid, margins, maximum width, and overflow behavior", async ({ page }) => {
  const cases = [
    { width: 375, columns: 4, gutter: 16, margin: 16, contentWidth: 343 },
    { width: 767, columns: 4, gutter: 16, margin: 20, contentWidth: 727 },
    { width: 768, columns: 8, gutter: 20, margin: 24, contentWidth: 720 },
    { width: 1024, columns: 12, gutter: 20, margin: 24, contentWidth: 976 },
    { width: 1312, columns: 12, gutter: 24, margin: 32, contentWidth: 1248 },
    { width: 1440, columns: 12, gutter: 24, margin: 32, contentWidth: 1248 },
  ];

  for (const gridCase of cases) {
    await setViewport(page, gridCase.width);
    const pageMetrics = await page.locator(".atlas-page").evaluate((element) => {
      const computed = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      const paddingLeft = Number.parseFloat(computed.paddingLeft);
      const paddingRight = Number.parseFloat(computed.paddingRight);
      return {
        contentWidth: bounds.width - paddingLeft - paddingRight,
        paddingLeft,
        width: bounds.width,
      };
    });
    const gridStyles = await getStyles(page.locator(".atlas-grid"), ["column-gap", "grid-template-columns"]);
    const documentWidths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));

    expect(pageMetrics.paddingLeft).toBe(gridCase.margin);
    expect(pageMetrics.contentWidth).toBeCloseTo(gridCase.contentWidth, 1);
    expect(Number.parseFloat(gridStyles["column-gap"] ?? "")).toBe(gridCase.gutter);
    expect(gridStyles["grid-template-columns"]?.split(" ")).toHaveLength(gridCase.columns);
    expect(documentWidths.scroll).toBeLessThanOrEqual(documentWidths.client);
  }
});

test("styles sheets, buttons, links, and statuses with exact interaction states", async ({ page }) => {
  const sheet = page.locator(".atlas-sheet").first();
  await expect(sheet).toHaveCSS("background-color", "rgb(252, 252, 250)");
  await expect(sheet).toHaveCSS("border-top-color", "rgb(199, 208, 214)");
  await expect(sheet).toHaveCSS("border-top-width", "1px");
  await expect(sheet).toHaveCSS("border-radius", "2px");
  await expect(sheet).toHaveCSS("box-shadow", "none");

  const primaryButton = page.getByRole("link", { name: "View evidence" });
  const secondaryButton = page.getByRole("link", { name: "Review statuses" });
  const primaryBox = await primaryButton.boundingBox();
  expect(primaryBox?.height).toBeGreaterThanOrEqual(48);
  await expect(primaryButton).toHaveCSS("background-color", "rgb(0, 109, 156)");
  await expect(primaryButton).toHaveCSS("border-left-width", "1px");
  await expect(primaryButton).toHaveCSS("padding-left", "20px");
  await primaryButton.hover();
  await expect(primaryButton).toHaveCSS("background-color", "rgb(0, 90, 131)");
  await expect(secondaryButton).toHaveCSS("background-color", "rgb(252, 252, 250)");
  await expect(secondaryButton).toHaveCSS("color", "rgb(23, 33, 43)");
  await secondaryButton.hover();
  await expect(secondaryButton).toHaveCSS("border-top-color", "rgb(0, 109, 156)");
  await expect(secondaryButton).toHaveCSS("color", "rgb(0, 109, 156)");

  const proseLink = page.getByRole("link", { name: "prose link to the evidence table" });
  await expect(proseLink).toHaveCSS("color", "rgb(0, 109, 156)");
  await expect(proseLink).toHaveCSS("text-decoration-line", "underline");
  await proseLink.focus();
  await expect(proseLink).toHaveCSS("outline-color", "rgb(8, 146, 208)");
  await expect(proseLink).toHaveCSS("outline-width", "3px");
  await expect(proseLink).toHaveCSS("outline-offset", "3px");

  const expectedStatuses = [
    ["Supported", "rgb(53, 67, 78)", "rgb(245, 246, 244)", "rgb(185, 196, 203)"],
    ["Reported But Unverified", "rgb(122, 90, 0)", "rgb(255, 248, 225)", "rgb(215, 184, 90)"],
    ["Disputed", "rgb(92, 74, 118)", "rgb(244, 240, 248)", "rgb(183, 166, 199)"],
    ["Failed / Retracted", "rgb(180, 35, 24)", "rgb(255, 241, 239)", "rgb(224, 163, 157)"],
  ] as const;
  for (const [label, text, background, border] of expectedStatuses) {
    const status = page.locator("#statuses .atlas-status-tab", { hasText: label });
    await expect(status).toHaveCSS("color", text);
    await expect(status).toHaveCSS("background-color", background);
    await expect(status).toHaveCSS("border-top-color", border);
    await expect(status).toHaveCSS("border-radius", "2px");
    const statusBox = await status.boundingBox();
    expect(statusBox?.height).toBeGreaterThanOrEqual(28);
  }
});

test("adapts record layouts and essential tables without horizontal scrolling", async ({ page }) => {
  await setViewport(page, 375);
  await expect(page.locator(".atlas-metadata-band")).toHaveCSS("flex-direction", "column");
  await expect(page.locator(".atlas-registration-cue")).toHaveCSS("display", "none");
  await expect(page.locator(".atlas-table thead")).toHaveCSS("position", "absolute");
  await expect(page.locator(".atlas-table td").first()).toHaveCSS("display", "grid");
  const mobileDeltaColumns = await page.locator(".atlas-frontier-delta").evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
  );
  expect(mobileDeltaColumns).toBe(1);
  const mobileRail = await page.locator(".atlas-rail-layout").evaluate((element) => {
    const rail = element.querySelector(".atlas-heading-rail")!.getBoundingClientRect();
    const content = element.querySelector(":scope > :not(.atlas-heading-rail)")!.getBoundingClientRect();
    return { contentTop: content.top, railBottom: rail.bottom };
  });
  expect(mobileRail.contentTop).toBeGreaterThanOrEqual(mobileRail.railBottom);

  await setViewport(page, 768);
  await expect(page.locator(".atlas-metadata-band")).toHaveCSS("flex-direction", "row");
  await expect(page.locator(".atlas-table thead")).toHaveCSS("position", "static");
  await expect(page.locator(".atlas-table td").first()).toHaveCSS("display", "table-cell");
  const tabletDeltaColumns = await page.locator(".atlas-frontier-delta").evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
  );
  expect(tabletDeltaColumns).toBe(3);

  await setViewport(page, 1024);
  await expect(page.locator(".atlas-registration-cue")).toHaveCSS("display", "block");
  const desktopLayouts = await page.evaluate(() => {
    const rail = document.querySelector(".atlas-heading-rail")!.getBoundingClientRect();
    const railContent = document
      .querySelector(".atlas-rail-layout > :not(.atlas-heading-rail)")!
      .getBoundingClientRect();
    const annotationContent = document.querySelector(".atlas-annotation-layout > div")!.getBoundingClientRect();
    const annotation = document.querySelector(".atlas-margin-annotation")!.getBoundingClientRect();
    return {
      annotationContentRight: annotationContent.right,
      annotationLeft: annotation.left,
      railContentLeft: railContent.left,
      railRight: rail.right,
    };
  });
  expect(desktopLayouts.railContentLeft).toBeGreaterThanOrEqual(desktopLayouts.railRight);
  expect(desktopLayouts.annotationLeft).toBeGreaterThanOrEqual(desktopLayouts.annotationContentRight);
});

test("removes non-essential motion while preserving disclosure state", async ({ page }) => {
  const disclosure = page.locator(".atlas-disclosure");
  const panel = disclosure.locator(".atlas-disclosure__panel");
  await expect(panel).toHaveCSS("transition-duration", "0.16s, 0.16s");
  await disclosure.locator("summary").click();
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(panel).toHaveCSS("visibility", "visible");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(panel).toHaveCSS("transition-duration", "0s");
  await expect(page.getByRole("link", { name: "View evidence" })).toHaveCSS(
    "transition-duration",
    "0s, 0s, 0s",
  );
  await expect(panel).toHaveCSS("visibility", "visible");
});

test("keeps status meaning visible and accessible in grayscale", async ({ page }) => {
  await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
  const statuses = page.locator("#statuses .atlas-status-tab");
  await expect(statuses).toHaveCount(4);
  await expect(statuses).toHaveText([
    "Supported",
    "Reported But Unverified",
    "Disputed",
    "Failed / Retracted",
  ]);
  for (const status of await statuses.all()) {
    await expect(status).toBeVisible();
    await expect(status).toHaveCSS("border-top-style", "solid");
    await expect(status).not.toHaveText("");
  }

  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(scan.violations).toEqual([]);
});
