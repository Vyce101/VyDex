// Verifies the Stage 1 Homepage content, ordering, responsive layout, and accessibility contract.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { IS_PREVIOUS_PRODUCTION_BROWSER_VERIFICATION } from "./playwright-config";

const RECENT_ENTRY_TITLES = [
  "Artificial neuron repeatedly fires within living-neuron voltage and energy ranges",
  "Dreamer 4 becomes first reported agent to obtain Minecraft diamonds using only offline training data",
  "NHC verification finds Google DeepMind’s GDMI leading individual hurricane guidance in 2025",
  "METR finds frontier AI software-task horizons doubling about every seven months",
];
const LATEST_ENTRY_TITLE =
  "Epoch estimates frontier AI benchmark progress nearly doubled in pace around April 2024";

async function setViewport(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 1000 });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("includes exactly one Google Search Console verification element in the static head", async ({
  page,
}) => {
  test.skip(
    IS_PREVIOUS_PRODUCTION_BROWSER_VERIFICATION,
    "Candidate metadata is not expected while verifying the previous production deployment.",
  );
  const verificationElement = page.locator('head meta[name="google-site-verification"]');

  await expect(verificationElement).toHaveCount(1);
  await expect(verificationElement).toHaveAttribute(
    "content",
    "_3xtwzAtvqGGFDG7AG3tJUnWFd3ZMP0PEhqIXQvyB-s",
  );
});

test("renders the exact Homepage hierarchy, copy, actions, and section order", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Versioned Evidence for Frontier Claims",
  );
  await expect(page.locator(".homepage-hero__description")).toHaveText(
    "VyDex tracks important frontier claims with evidence, caveats, sources, and updates.",
  );
  await expect(page.locator(".homepage-hero__boundary")).toHaveText(
    "Not AI news. Not a hype feed.",
  );
  await expect(page.locator(".homepage-hero__boundary")).toHaveCSS("font-size", "15px");
  await expect(page.locator(".homepage-hero__boundary")).toHaveCSS("line-height", "22px");
  await expect(page.locator(".homepage-hero__boundary")).toHaveCSS("font-weight", "650");
  await expect(page.locator(".homepage-hero__boundary")).toHaveCSS("margin-top", "16px");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Latest Update",
    "Recent Entries and Evidence Updates",
    "How VyDex Reads Claims",
  ]);

  const actions = page.locator(".homepage-hero__actions a");
  await expect(actions).toHaveText(["Read Latest Entries", "View Methodology", "About VyDex"]);
  for (const [index, href] of ["/#latest", "/methodology/", "/about/"].entries()) {
    await expect(actions.nth(index)).toHaveAttribute("href", href);
  }
  await expect(page.locator("[data-homepage-latest] > .homepage-hero__latest-label")).toHaveText(
    "Latest Update",
  );
  await expect(page.locator("#latest")).toHaveCount(1);

  expect(
    await page.locator(".homepage > section").evaluateAll((sections) =>
      sections.map((section) => section.className),
    ),
  ).toEqual(["homepage-hero", "homepage-recent", "homepage-reading"]);
});

test("renders the selected latest Entry once and the four distinct recent Entries", async ({ page }) => {
  const latestTitle = page.locator(
    '[data-homepage-latest] [data-entry-preview-field="title"] a',
  );
  const recentTitles = page.locator(
    '[data-homepage-recent-list] [data-entry-preview-field="title"] a',
  );

  await expect(latestTitle).toHaveText(LATEST_ENTRY_TITLE);
  await expect(recentTitles).toHaveText(RECENT_ENTRY_TITLES);
  await expect(recentTitles).toHaveCount(4);
  expect(await recentTitles.allTextContents()).not.toContain(LATEST_ENTRY_TITLE);
  await expect(page.getByText("No entries have been added yet.")).toHaveCount(0);
});

test("omits prohibited Homepage patterns and runtime controls", async ({ page }) => {
  const main = page.getByRole("main");
  await expect(main.locator("img, picture, svg, canvas, figure, progress")).toHaveCount(0);
  await expect(main.locator('input, select, [role="search"], [aria-roledescription="carousel"]')).toHaveCount(0);
  await expect(main).not.toContainText(/Featured|Trending|Breakthrough|Coming Soon|Scope Limits|Donations|Submissions|Reports/);
  await expect(page.locator(".homepage-hero__identity.atlas-sheet")).toHaveCount(0);
});

test("stacks the Hero before 1100px and uses the approved desktop rails from 1100px", async ({ page }) => {
  await setViewport(page, 1099);
  await expect(page.locator(".homepage-hero")).toHaveCSS("display", "flex");
  await expect(page.locator(".homepage-hero__latest")).toHaveCSS("border-left-width", "0px");
  const stackedHero = await page.evaluate(() => {
    const identity = document.querySelector(".homepage-hero__identity")!.getBoundingClientRect();
    const latest = document.querySelector(".homepage-hero__latest")!.getBoundingClientRect();
    const heading = document.querySelector(".homepage-recent > h2")!.getBoundingClientRect();
    const list = document.querySelector(".homepage-recent__list")!.getBoundingClientRect();
    return { identityBottom: identity.bottom, latestTop: latest.top, headingBottom: heading.bottom, listTop: list.top };
  });
  expect(stackedHero.latestTop).toBeGreaterThanOrEqual(stackedHero.identityBottom);
  expect(stackedHero.listTop).toBeGreaterThanOrEqual(stackedHero.headingBottom);

  await setViewport(page, 1100);
  await expect(page.locator(".homepage-hero")).toHaveCSS("display", "grid");
  await expect(page.locator(".homepage-hero__latest")).toHaveCSS("border-left-width", "1px");
  const desktopColumns = await page.evaluate(() => {
    const hero = document.querySelector(".homepage-hero")!.getBoundingClientRect();
    const identity = document.querySelector(".homepage-hero__identity")!.getBoundingClientRect();
    const latest = document.querySelector(".homepage-hero__latest")!.getBoundingClientRect();
    const heading = document.querySelector(".homepage-recent > h2")!.getBoundingClientRect();
    const list = document.querySelector(".homepage-recent__list")!.getBoundingClientRect();
    return {
      heroWidth: hero.width,
      identityWidth: identity.width,
      latestWidth: latest.width,
      topDifference: Math.abs(identity.top - latest.top),
      recentSideBySide: list.left > heading.left,
    };
  });
  expect(desktopColumns.identityWidth / desktopColumns.heroWidth).toBeGreaterThan(0.5);
  expect(desktopColumns.latestWidth / desktopColumns.heroWidth).toBeGreaterThan(0.3);
  expect(desktopColumns.topDifference).toBeLessThanOrEqual(1);
  expect(desktopColumns.recentSideBySide).toBe(true);
});

test("uses full-width mobile actions and preserves the required Hero order", async ({ page }) => {
  await setViewport(page, 375);
  const primary = page.getByRole("link", { name: "Read Latest Entries" });
  const secondary = page.getByRole("link", { name: "View Methodology" });
  const identity = page.locator(".homepage-hero__identity");
  const identityWidth = (await identity.boundingBox())?.width;
  expect((await primary.boundingBox())?.width).toBeCloseTo(identityWidth ?? 0, 0);
  expect((await secondary.boundingBox())?.width).toBeCloseTo(identityWidth ?? 0, 0);

  const orderedTops = await Promise.all([
    page.getByRole("heading", { level: 1 }).boundingBox(),
    page.locator(".homepage-hero__description").boundingBox(),
    page.locator(".homepage-hero__boundary").boundingBox(),
    primary.boundingBox(),
    secondary.boundingBox(),
    page.getByRole("link", { name: "About VyDex" }).boundingBox(),
    page.locator(".homepage-hero__latest-label").boundingBox(),
    page.locator("[data-homepage-latest] [data-entry-preview]").boundingBox(),
  ]);
  expect(orderedTops.every(Boolean)).toBe(true);
  expect(orderedTops.map((box) => box!.y)).toEqual(
    [...orderedTops].map((box) => box!.y).sort((left, right) => left - right),
  );
});

test("keeps one continuous claim-reading surface with responsive dividers", async ({ page }) => {
  const band = page.locator(".homepage-reading__band");
  await expect(band).toHaveCSS("border-radius", "2px");
  await expect(band).toHaveCSS("border-top-width", "1px");
  await expect(page.locator(".homepage-reading__cell")).toHaveCount(3);
  await expect(page.locator(".homepage-reading__cell").first()).toHaveCSS("padding", "28px");
  await expect(page.locator(".homepage-reading__cell h3")).toHaveText(["Claim", "Evidence", "Caveat"]);

  await setViewport(page, 375);
  await expect(page.locator(".homepage-reading__cell").nth(1)).toHaveCSS("border-top-width", "1px");
  await expect(page.locator(".homepage-reading__cell").nth(1)).toHaveCSS("border-left-width", "0px");

  await setViewport(page, 768);
  await expect(page.locator(".homepage-reading__cell").nth(1)).toHaveCSS("border-top-width", "0px");
  await expect(page.locator(".homepage-reading__cell").nth(1)).toHaveCSS("border-left-width", "1px");
  await expect(page.getByRole("link", { name: "Read the Methodology →" })).toHaveAttribute(
    "href",
    "/methodology/",
  );
});

test("uses normal anchor navigation, reduced motion, and accessible static HTML", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("link", { name: "Read Latest Entries" })).toHaveCSS(
    "transition-duration",
    "0s, 0s, 0s",
  );
  await page.getByRole("link", { name: "Read Latest Entries" }).click();
  await expect(page).toHaveURL(/\/#latest$/);
  await expect(page.locator("#latest")).toBeVisible();

  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
});
