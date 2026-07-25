// Verifies cross-page Stage 1 semantics, accessibility, responsive safety, and progressive enhancement.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const ENTRY_PATH = "/entries/dreamer-4-offline-minecraft-diamonds/";
const TOPIC_TRAIL_PATH = "/topic-trails/world-models-for-agent-training/";
const REQUIRED_SURFACES = [
  ["Homepage", "/"],
  ["Entry", ENTRY_PATH],
  ["Methodology", "/methodology/"],
  ["About", "/about/"],
  ["Topic Trail", TOPIC_TRAIL_PATH],
  ["Changelog", "/changelog/"],
  ["Export", "/export/"],
] as const;
const SUPPORTED_WIDTHS = [320, 375, 768, 1024, 1440] as const;

async function expectNoHeadingLevelSkips(page: Page): Promise<void> {
  const levels = await page.locator("main h1, main h2, main h3, main h4, main h5, main h6")
    .evaluateAll((headings) => headings.map(({ tagName }) => Number(tagName.slice(1))));
  expect(levels[0]).toBe(1);
  for (let index = 1; index < levels.length; index += 1) {
    expect(levels[index]!, `heading ${index + 1} follows level ${levels[index - 1]}`).toBeLessThanOrEqual(
      levels[index - 1]! + 1,
    );
  }
}

async function expectVisibleFocus(locator: Locator): Promise<void> {
  await locator.focus();
  await expect(locator).toHaveCSS("outline-style", "solid");
  await expect(locator).toHaveCSS("outline-width", "3px");
}

test("keeps one H1, valid heading order, visible focus, and Axe conformance on every surface", async ({ page }) => {
  for (const [label, path] of REQUIRED_SURFACES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }), label).toHaveCount(1);
    await expectNoHeadingLevelSkips(page);
    await expectVisibleFocus(page.locator("main a[href]").first());
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(scan.violations, label).toEqual([]);
  }
});

test("keeps status meaning and repeated Entry links understandable without color", async ({ page }) => {
  await page.goto(ENTRY_PATH);
  await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
  await expect(page.locator(".entry-status-summary__tabs .atlas-status-tab")).toHaveText([
    /^Claim:/,
    /^Evidence:/,
    /^Review:/,
    /^State:/,
  ]);

  await page.goto("/");
  for (const preview of await page.locator("[data-entry-preview]").all()) {
    const title = (await preview.locator('[data-entry-preview-field="title"]').innerText()).trim();
    await expect(preview.locator('[data-entry-preview-field="read-entry"]')).toHaveAttribute(
      "aria-label",
      `Read Entry: ${title}`,
    );
  }
});

test("keeps tables headed and preserves every mobile field label", async ({ page }) => {
  for (const path of ["/methodology/", "/export/"]) {
    await page.goto(path);
    for (const table of await page.locator("main table").all()) {
      const headings = await table.locator("thead th").allTextContents();
      await expect(table.locator('thead th[scope="col"]')).toHaveCount(headings.length);
      await page.setViewportSize({ width: 375, height: 900 });
      const mobileLabels = await table.locator("tbody tr").evaluateAll((rows) =>
        rows.map((row) => [...row.querySelectorAll("td")].map((cell) => ({
          attribute: cell.getAttribute("data-label"),
          rendered: getComputedStyle(cell, "::before").content.replaceAll('"', ""),
        }))),
      );
      for (const row of mobileLabels) {
        expect(row.map(({ attribute }) => attribute)).toEqual(headings);
        expect(row.map(({ rendered }) => rendered)).toEqual(headings);
      }
    }
  }
});

test("uses descriptive source and download link names", async ({ page }) => {
  await page.goto("/entries/metr-software-task-horizons-doubling-seven-months/");
  for (const source of await page.locator(".entry-source").all()) {
    const title = (await source.getByRole("heading", { level: 3 }).innerText()).trim();
    await expect(source.getByRole("link", { name: `Open source: ${title} →` })).toBeVisible();
  }

  await page.goto("/export/");
  await expect(page.locator("[data-export-download]")).toHaveAccessibleName("Download Latest JSON");
});

test("prevents horizontal overflow across every supported surface and width", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One Chromium project covers the explicit viewport matrix.");
  for (const [, path] of REQUIRED_SURFACES) {
    await page.goto(path);
    for (const width of SUPPORTED_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scroll, `${path} at ${width}px`).toBeLessThanOrEqual(dimensions.client);
    }
  }
});

test("removes non-essential motion without making the mobile menu depend on movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const motionTokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return [
      styles.getPropertyValue("--atlas-motion-interface").trim(),
      styles.getPropertyValue("--atlas-motion-disclosure").trim(),
    ];
  });
  expect(motionTokens).toEqual(["0s", "0s"]);
  await expect(page.getByRole("link", { name: "Read Latest Entries" })).toHaveCSS(
    "transition-duration",
    "0s, 0s, 0s",
  );
  const disclosure = page.locator("[data-site-navigation-disclosure]");
  await disclosure.locator("summary").press("Space");
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(page.getByRole("navigation", { name: "Mobile primary navigation" })).toBeVisible();
});

test.describe("without browser JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps every core surface and normal page navigation available", async ({ page }) => {
    for (const [, path] of REQUIRED_SURFACES) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }

    await page.goto("/");
    await page.getByRole("link", { name: "View Methodology" }).click();
    await expect(page).toHaveURL(/\/methodology\/$/);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const disclosure = page.locator("[data-site-navigation-disclosure]");
    await disclosure.locator("summary").press("Enter");
    await expect(disclosure).toHaveAttribute("open", "");
    await page.getByRole("navigation", { name: "Mobile primary navigation" })
      .getByRole("link", { name: "About" })
      .click();
    await expect(page).toHaveURL(/\/about\/$/);
  });

  test("downloads the JSON artifact without JavaScript", async ({ page }) => {
    await page.goto("/export/");
    const downloadLink = page.locator("[data-export-download]");
    const [download] = await Promise.all([page.waitForEvent("download"), downloadLink.click()]);
    expect(download.suggestedFilename()).toMatch(/^vydex-latest-entry-versions-v1-0-0-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
