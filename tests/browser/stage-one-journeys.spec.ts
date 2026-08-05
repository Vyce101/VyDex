// Verifies complete Stage 1 journeys, direct routes, redirects, and navigation boundaries.
import { expect, test, type Page } from "@playwright/test";
import {
  BROWSER_TEST_URL,
  EXPECTED_SITE_ORIGIN,
  IS_HOSTED_BROWSER_TEST,
} from "./playwright-config";

const ENTRY_PATHS = [
  "/entries/dreamer-4-offline-minecraft-diamonds/",
  "/entries/google-deepmind-gdmi-leading-hurricane-guidance-2025/",
  "/entries/metr-software-task-horizons-doubling-seven-months/",
  "/entries/artificial-neuron-biological-voltage-energy/",
  "/entries/epoch-frontier-ai-benchmark-progress-acceleration-2024/",
  "/entries/gpt-5-erdos-literature-search-status-changes/",
  "/entries/kosmos-ai-neuron-clearance-signal/",
] as const;
const LATEST_ENTRY_PATH = "/entries/kosmos-ai-neuron-clearance-signal/";
const TOPIC_TRAIL_PATHS = [
  "/topic-trails/world-models-for-agent-training/",
  "/topic-trails/ai-in-operational-weather-forecasting/",
  "/topic-trails/ai-agents-in-software-engineering/",
  "/topic-trails/brain-inspired-hardware-biological-function/",
  "/topic-trails/frontier-ai-capability-progress-over-time/",
  "/topic-trails/ai-assisted-scientific-literature-discovery/",
  "/topic-trails/ai-in-research-mathematics/",
  "/topic-trails/ai-systems-in-scientific-discovery/",
] as const;
const REPRESENTATIVE_ROUTES = [
  ["Homepage", "/", "Versioned Evidence for Frontier Claims"],
  ["Entry", ENTRY_PATHS[0], "Dreamer 4 becomes first reported agent"],
  ["Topic Trail", TOPIC_TRAIL_PATHS[0], "World models for agent training"],
  ["Methodology current", "/methodology/", "Methodology"],
  ["Methodology version", "/methodology/1.0.0/", "Methodology"],
  ["About", "/about/", "About VyDex"],
  ["Changelog", "/changelog/", "Changelog"],
  ["Export", "/export/", "Export JSON"],
] as const;
const ACTIVE_NAVIGATION = new Map([
  ["/methodology/", "Methodology"],
  ["/methodology/1.0.0/", "Methodology"],
  ["/about/", "About"],
  ["/changelog/", "Changelog"],
  ["/export/", "Export JSON"],
]);
const ALIAS_PATH = "/entries/google-deepmind-gdmi-hurricane-forecasting-2025/";
const ALIAS_DESTINATION = ENTRY_PATHS[1];

async function expectPath(page: Page, pathname: string): Promise<void> {
  await expect.poll(() => new URL(page.url()).pathname).toBe(pathname);
}

async function proxyPublicOriginToLocalOutput(page: Page): Promise<void> {
  if (IS_HOSTED_BROWSER_TEST) return;
  await page.route(`${EXPECTED_SITE_ORIGIN}/**`, async (route) => {
    const publicUrl = new URL(route.request().url());
    const response = await route.fetch({
      url: `${BROWSER_TEST_URL}${publicUrl.pathname}${publicUrl.search}`,
    });
    await route.fulfill({ response });
  });
}

test("completes every required cross-page reading journey", async ({ page }) => {
  await proxyPublicOriginToLocalOutput(page);
  await page.goto("/");
  await page.locator('[data-homepage-latest] [data-entry-preview-field="title"] a').click();
  await expectPath(page, LATEST_ENTRY_PATH);

  await page.goto("/");
  await page.getByRole("link", { name: "View Methodology" }).click();
  await expectPath(page, "/methodology/");

  await page.goto("/");
  await page.getByRole("link", { name: "About VyDex" }).click();
  await expectPath(page, "/about/");

  await page.goto(ENTRY_PATHS[0]);
  await page.locator(".entry-header__trails")
    .getByRole("link", { name: "World models for agent training", exact: true })
    .click();
  await expectPath(page, TOPIC_TRAIL_PATHS[0]);

  await page.goto(ENTRY_PATHS[0]);
  await page.getByRole("link", { name: "View Methodology v1.0.0 →" }).click();
  await expectPath(page, "/methodology/1.0.0/");

  await page.goto(TOPIC_TRAIL_PATHS[0]);
  await page.locator('[data-entry-preview-field="title"] a').first().click();
  await expectPath(page, ENTRY_PATHS[0]);

  await page.goto("/changelog/");
  await page.locator('a[aria-label^="View Entry:"]').first().click();
  await expect(page.locator("[data-entry-page]")).toBeVisible();

  await page.goto("/changelog/");
  await page.getByRole("link", { name: /^View Methodology:/ }).click();
  await expectPath(page, "/methodology/1.0.0/");

  await page.goto("/export/");
  const downloadLink = page.locator("[data-export-download]");
  const [download] = await Promise.all([page.waitForEvent("download"), downloadLink.click()]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
});

test("opens every direct route and preserves real not-found behavior", async ({ page, request }) => {
  for (const [label, path, heading] of REPRESENTATIVE_ROUTES) {
    const response = await page.goto(path);
    expect(response?.status(), label).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
  }

  const unknownEntry = await page.goto("/entries/not-a-real-entry/");
  expect(unknownEntry?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");

  const latestPage = await request.get("/latest/", { maxRedirects: 0 });
  expect(latestPage.status()).toBe(404);
});

test("serves the real Entry alias as a permanent redirect", async ({ page, request }) => {
  const redirect = await request.get(ALIAS_PATH, { maxRedirects: 0 });
  expect(redirect.status()).toBe(301);
  expect(redirect.headers().location).toBe(ALIAS_DESTINATION);

  await page.goto(ALIAS_PATH);
  await expectPath(page, ALIAS_DESTINATION);
  await expect(page.locator("[data-entry-page]")).toBeVisible();
});

test("applies only the approved navigation active states", async ({ page }) => {
  for (const [, path] of REPRESENTATIVE_ROUTES) {
    await page.goto(path);
    const header = page.locator("[data-site-header]");
    const active = header.locator('[aria-current="page"]');
    const expected = ACTIVE_NAVIGATION.get(path);
    if (expected) await expect(active).toHaveText([expected, expected]);
    else await expect(active).toHaveCount(0);
    await expect(header.locator('a[href="/#latest"]')).toHaveCount(2);
    await expect(header.locator('a[href="/latest/"]')).toHaveCount(0);
  }
});

test("contains no links to routes outside the Stage 1 public contract", async ({ page }) => {
  const allowedPaths = new Set([
    "/",
    "/methodology/",
    "/methodology/1.0.0/",
    "/about/",
    "/changelog/",
    "/export/",
    ...ENTRY_PATHS,
    ...TOPIC_TRAIL_PATHS,
  ]);
  const expectedOrigin = new URL(EXPECTED_SITE_ORIGIN);

  for (const [, route] of REPRESENTATIVE_ROUTES) {
    await page.goto(route);
    const invalidInternalPaths = await page.locator("a[href]").evaluateAll(
      (links, input) => links.flatMap((link) => {
        const href = link.getAttribute("href");
        if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return [];
        const url = new URL(href, document.URL);
        const isInternal = url.origin === document.location.origin || url.origin === input.expectedOrigin;
        if (!isInternal || input.allowedPaths.includes(url.pathname)) return [];
        if (
          url.pathname.startsWith("/datasets/releases/") ||
          url.pathname === "/schemas/vydex-dataset/1.0.0.json"
        ) return [];
        return [url.pathname];
      }),
      { allowedPaths: [...allowedPaths], expectedOrigin: expectedOrigin.origin },
    );
    expect(invalidInternalPaths, route).toEqual([]);
  }
});
