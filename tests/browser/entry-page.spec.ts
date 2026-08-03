// Verifies static Entry routes, canonical metadata, complete rendering, responsive behavior, and 404 handling.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { EXPECTED_SITE_ORIGIN } from "./playwright-config";

const METR_ENTRY_PATH = "/entries/metr-software-task-horizons-doubling-seven-months/";
const ENTRY_PATHS = [
  "/entries/dreamer-4-offline-minecraft-diamonds/",
  "/entries/artificial-neuron-biological-voltage-energy/",
  "/entries/epoch-frontier-ai-benchmark-progress-acceleration-2024/",
  "/entries/google-deepmind-gdmi-leading-hurricane-guidance-2025/",
  METR_ENTRY_PATH,
] as const;

async function openEntry(page: Page): Promise<void> {
  const response = await page.goto(ENTRY_PATHS[0]);
  expect(response?.status()).toBe(200);
}

test("generates every genuine seed Entry as a successful static route", async ({ page }) => {
  for (const path of ENTRY_PATHS) {
    const dynamicRequests: string[] = [];
    page.on("request", (request) => {
      if (["fetch", "xhr"].includes(request.resourceType())) dynamicRequests.push(request.url());
    });
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator("[data-entry-page]")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${EXPECTED_SITE_ORIGIN}${path}`,
    );
    expect(dynamicRequests).toEqual([]);
  }
});

test("renders the exact Entry hierarchy and continuous record order", async ({ page }) => {
  await openEntry(page);

  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Frontier Delta",
    "Details",
    "Significance",
    "Caveats",
    "Dates and Metadata",
    "Sources",
    "Methodology Used",
  ]);
  await expect(page.locator('[data-entry-section="details"] h3')).toHaveText([
    "What Happened?",
    "What Does the Evidence Show?",
    "What Context Changes Interpretation?",
    "What Should the Reader Take From It?",
  ]);
  await expect(page.locator('[data-entry-section="frontier-delta"] h3')).toHaveText([
    "Previous Frontier",
    "New Claim / Result",
    "Delta",
  ]);
  expect(
    await page.locator(".entry-page__sheet > [data-entry-section]").evaluateAll((sections) =>
      sections.map((section) => section.getAttribute("data-entry-section")),
    ),
  ).toEqual([
    "header",
    "status-summary",
    "frontier-delta",
    "details",
    "significance",
    "caveats",
    "dates-and-metadata",
    "sources",
    "methodology-used",
  ]);
  await expect(page.locator('[data-entry-section="caution"]')).toHaveCount(0);
  const sectionIndex = page.getByRole("navigation", { name: "Entry sections" });
  await expect(sectionIndex.getByRole("link")).toHaveText([
    "Frontier Delta",
    "Details",
    "Significance",
    "Caveats",
    "Metadata",
    "Sources",
  ]);
  expect(
    await sectionIndex.getByRole("link").evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")),
    ),
  ).toEqual([
    "#frontier-delta",
    "#details",
    "#significance",
    "#caveats",
    "#dates-and-metadata",
    "#sources",
  ]);
  await expect(page.getByRole("link", { name: "← Back to Latest" })).toHaveAttribute(
    "href",
    "/#latest",
  );
});

test("shows all Domains, relationships, statuses, follow-up context, and metadata", async ({ page }) => {
  await openEntry(page);

  await expect(page.locator(".entry-header__domains li")).toHaveText([
    "AI Capabilities",
    "AI Evaluation",
  ]);
  await expect(page.locator(".entry-header__trails")).toContainText(
    "Topic Trail: World models for agent training",
  );
  await expect(page.locator(".entry-status-summary__tabs .atlas-status-tab")).toHaveText([
    "Claim: Supported",
    "Evidence: Strong",
    "Review: Stable",
    "State: Main Entry",
  ]);
  await expect(page.locator(".entry-status-summary__methodology")).toHaveText(
    "Methodology: v1.0.0",
  );
  await expect(page.locator(".entry-status-summary__review")).toHaveCount(0);
  await expect(page.locator(".entry-metadata__list dt")).toHaveText([
    "Date Happened",
    "Date Disclosed",
    "Date Added",
    "Date Updated",
    "Date Last Checked",
    "Next Check Date",
    "Entry State",
    "Domain",
    "Topic Trail",
    "Evidence Type",
  ]);
  await expect(page.locator(".entry-metadata__list dd").nth(0)).toHaveText("Unknown");
  await expect(page.locator(".entry-metadata__list dd").nth(5)).toHaveText("None scheduled");
  await expect(page.locator(".entry-metadata__list dd").nth(6)).toHaveText("Main Entry");
});

test("renders resolved sources in role order with intact context and descriptive links", async ({ page }) => {
  await page.goto(METR_ENTRY_PATH);
  const records = page.locator(".entry-source");

  await expect(records).toHaveCount(7);
  await expect(records.locator(".entry-source__metadata > div:first-child dd")).toHaveText([
    "Primary Evidence",
    "Primary Evidence",
    "Independent Replication",
    "Strong Artifact",
    "Context Source",
    "Context Source",
    "Context Source",
  ]);
  for (const record of await records.all()) {
    const title = (await record.getByRole("heading", { level: 3 }).textContent())!;
    await expect(record.locator(".entry-source__publisher")).not.toBeEmpty();
    await expect(record.getByText("Used For", { exact: true })).toBeVisible();
    await expect(record.getByRole("link", { name: `Open source: ${title} →` })).toHaveAttribute(
      "href",
      /^https?:\/\//,
    );
  }
});

test("uses the approved continuous-sheet responsive transformations without overflow", async ({ page }) => {
  await openEntry(page);
  const cases = [
    { width: 375, padding: "20px", statusDirection: "column", connector: "vertical" },
    { width: 768, padding: "32px", statusDirection: "row", connector: "vertical" },
    { width: 1024, padding: "32px", statusDirection: "row", connector: "horizontal" },
  ] as const;

  for (const layoutCase of cases) {
    await page.setViewportSize({ width: layoutCase.width, height: 1000 });
    await expect(page.locator(".entry-page__sheet")).toHaveCSS("padding-left", layoutCase.padding);
    await expect(page.locator(".entry-status-summary__tabs")).toHaveCSS(
      "flex-direction",
      layoutCase.statusDirection,
    );
    const statusFontSizes = await page.locator(".entry-status-summary .atlas-status-tab")
      .evaluateAll((elements) => elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize)));
    expect(Math.min(...statusFontSizes)).toBeGreaterThanOrEqual(12);
    const connector = page.locator(".entry-frontier__connector");
    await expect(connector).toHaveCSS(
      layoutCase.connector === "vertical" ? "border-left-width" : "border-top-width",
      "1px",
    );
    const arrowHead = await connector.evaluate((element) => {
      const styles = getComputedStyle(element, "::after");
      return { backgroundColor: styles.backgroundColor, clipPath: styles.clipPath };
    });
    expect(arrowHead.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(arrowHead.clipPath).toBe(
      layoutCase.connector === "vertical"
        ? "polygon(0px 0px, 100% 0px, 50% 100%)"
        : "polygon(0px 0px, 100% 50%, 0px 100%)",
    );
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  }

  const sheet = page.locator(".entry-page__sheet");
  await expect(sheet).toHaveCSS("max-width", "1080px");
  await expect(sheet).toHaveCSS("border-radius", "2px");
  await expect(sheet).toHaveCSS("box-shadow", "none");

  await page.setViewportSize({ width: 1024, height: 1000 });
  const proseMeasures = await page.evaluate(() => ({
    details: getComputedStyle(document.querySelector(".entry-details .entry-prose")!).maxWidth,
    frontier: getComputedStyle(document.querySelector(".entry-frontier .entry-prose")!).maxWidth,
  }));
  expect(proseMeasures.details).not.toBe("none");
  expect(proseMeasures.frontier).toBe("none");

  const sectionLayout = await page.evaluate(() => {
    const details = document.querySelector(".entry-details")!.getBoundingClientRect();
    const significance = document.querySelector(".entry-significance")!.getBoundingClientRect();
    const caveats = document.querySelector(".entry-caveats")!.getBoundingClientRect();
    const frontier = document.querySelector(".entry-frontier")!.getBoundingClientRect();
    const header = document.querySelector(".entry-header")!.getBoundingClientRect();
    const metadata = document.querySelector(".entry-metadata")!.getBoundingClientRect();
    const sources = document.querySelector(".entry-sources")!.getBoundingClientRect();
    const methodology = document.querySelector(".entry-methodology")!.getBoundingClientRect();
    return {
      frontierWidth: frontier.width,
      fullWidthSections: [
        header.width,
        details.width,
        significance.width,
        caveats.width,
        metadata.width,
        sources.width,
        methodology.width,
      ],
    };
  });
  for (const width of sectionLayout.fullWidthSections) {
    expect(width).toBeCloseTo(sectionLayout.frontierWidth, 0);
  }
});

test("keeps focus and status meaning visible and passes Axe", async ({ page }) => {
  await openEntry(page);
  await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
  const backLink = page.getByRole("link", { name: "← Back to Latest" });
  await backLink.focus();
  await expect(backLink).toHaveCSS("outline-width", "3px");
  await expect(page.locator(".entry-status-summary__tabs")).toContainText("Claim: Supported");

  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
});

test("omits prohibited article, dashboard, and runtime patterns", async ({ page }) => {
  await openEntry(page);
  const main = page.getByRole("main");
  await expect(main.locator("img, picture, svg, canvas, progress, input, select, button")).toHaveCount(0);
  await expect(main.locator("aside:not(.entry-caution), [class*='sidebar'], [role='tab']")).toHaveCount(0);
  await expect(main).not.toContainText(/Cite This|Corrections|Donations|Read More|History selector/);
});

test("serves an unknown Entry slug through the static generic 404 without redirecting", async ({ page }) => {
  const unknownPath = "/entries/not-a-genuine-entry/";
  const response = await page.goto(unknownPath);

  expect(response?.status()).toBe(404);
  expect(new URL(page.url()).pathname).toBe(unknownPath);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  await expect(page.getByText("The page you requested could not be found.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to the Homepage" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.locator("[data-entry-page]")).toHaveCount(0);
});
