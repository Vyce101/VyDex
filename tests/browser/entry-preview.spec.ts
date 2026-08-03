// Verifies reusable Entry previews in the real Homepage Latest and recent hosts.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const LATEST_ENTRY_TITLE =
  "Epoch estimates frontier AI benchmark progress nearly doubled in pace around April 2024";
const LATEST_ENTRY_PATH = "/entries/epoch-frontier-ai-benchmark-progress-acceleration-2024/";
const LATEST_TRAIL_NAME = "Frontier AI capability progress over time";
const LATEST_TRAIL_PATH = "/topic-trails/frontier-ai-capability-progress-over-time/";
const FIELD_SEQUENCE = [
  "domain",
  "date-updated",
  "title",
  "claim",
  "claim-status",
  "evidence-strength",
  "review-status",
  "topic-trail",
  "read-entry",
];

function latestPreview(page: Page): Locator {
  return page.locator("[data-homepage-latest] [data-entry-preview]");
}

function recentPreviews(page: Page): Locator {
  return page.locator("[data-homepage-recent-list] [data-entry-preview]");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("renders one featured Latest preview and four quieter distinct recent previews", async ({ page }) => {
  await expect(latestPreview(page)).toHaveCount(1);
  await expect(recentPreviews(page)).toHaveCount(4);
  expect(await recentPreviews(page).allTextContents()).not.toContainEqual(
    expect.stringContaining(LATEST_ENTRY_TITLE),
  );
  await expect(latestPreview(page)).toHaveAttribute("data-entry-preview-treatment", "default");
  await expect(latestPreview(page)).toHaveAttribute("class", "entry-preview atlas-sheet");

  const entries = page.locator("[data-entry-preview]");
  await expect(entries).toHaveCount(5);
  for (const entry of await entries.all()) {
    expect(
      await entry.locator("[data-entry-preview-field]").evaluateAll((fields) =>
        fields.map((field) => field.getAttribute("data-entry-preview-field")),
      ),
    ).toEqual(FIELD_SEQUENCE);
  }
  for (const entry of await recentPreviews(page).all()) {
    await expect(entry).toHaveAttribute("data-entry-preview-treatment", "quiet");
    await expect(entry).toHaveAttribute(
      "class",
      "entry-preview atlas-sheet entry-preview--quiet",
    );
  }
});

test("shows resolved fields, canonical links, and contextual accessible names", async ({ page }) => {
  const entry = latestPreview(page);
  await expect(entry.locator('[data-entry-preview-field="domain"]')).toHaveText("AI Capabilities");
  const date = entry.locator('[data-entry-preview-field="date-updated"]');
  await expect(date).toHaveAttribute("datetime", "2026-08-03");
  await expect(date).toHaveText("Date Updated: 2026-08-03");

  await expect(entry.getByRole("link", { name: LATEST_ENTRY_TITLE, exact: true })).toHaveAttribute(
    "href",
    new RegExp(`${LATEST_ENTRY_PATH}$`),
  );
  await expect(entry.locator('[data-entry-preview-field="claim-status"]')).toHaveText(
    "Claim: Supported",
  );
  await expect(entry.locator('[data-entry-preview-field="evidence-strength"]')).toHaveText(
    "Evidence: Strong",
  );
  await expect(entry.locator('[data-entry-preview-field="review-status"]')).toHaveText(
    "Review: Stable",
  );
  await expect(
    entry.getByRole("link", { name: `Topic Trail: ${LATEST_TRAIL_NAME}`, exact: true }),
  ).toHaveAttribute("href", new RegExp(`${LATEST_TRAIL_PATH}$`));
  await expect(
    entry.getByRole("link", { name: `Read Entry: ${LATEST_ENTRY_TITLE}`, exact: true }),
  ).toHaveAttribute("href", new RegExp(`${LATEST_ENTRY_PATH}$`));
});

test("preserves neutral evidence treatment without card-wide interaction", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  const entry = latestPreview(page);
  await expect(entry).toHaveCSS("background-color", "rgb(252, 252, 250)");
  await expect(entry).toHaveCSS("border-radius", "2px");
  await expect(entry).toHaveCSS("box-shadow", "none");
  await expect(entry).toHaveCSS("transform", "none");

  const claimStatus = entry.locator('[data-entry-preview-field="claim-status"]');
  await expect(claimStatus).toHaveAttribute("data-status", "supported");
  for (const field of ["claim-status", "evidence-strength", "review-status"]) {
    const status = entry.locator(`[data-entry-preview-field="${field}"]`);
    await expect(status).toHaveCSS("color", "rgb(53, 67, 78)");
    await expect(status).toHaveCSS("background-color", "rgb(245, 246, 244)");
    await expect(status).toHaveCSS(
      "border-top-color",
      field === "claim-status" ? "rgb(124, 140, 151)" : "rgb(185, 196, 203)",
    );
  }

  await expect(entry.locator("img, svg, canvas, figure, progress")).toHaveCount(0);
  await expect(entry).not.toContainText(/featured|trending|confidence/i);
  await expect(entry).not.toHaveAttribute("href", /.+/);
  await expect(entry).not.toHaveAttribute("role", "link");
});

test("clamps preview prose and stacks safely on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  const entry = latestPreview(page);
  await expect(entry.locator('[data-entry-preview-section="metadata"]')).toHaveCSS(
    "flex-direction",
    "column",
  );
  await expect(entry.locator('[data-entry-preview-section="footer"]')).toHaveCSS(
    "flex-direction",
    "column",
  );
  await expect(entry.locator('[data-entry-preview-section="metadata"]')).toHaveCSS(
    "font-size",
    "12px",
  );
  await expect(entry.locator(".entry-preview__statuses")).toHaveCSS("flex-wrap", "wrap");

  for (const width of [320, 375, 767, 768, 1024, 1099, 1100, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  }
});

test("keeps every Latest Entry link keyboard accessible with visible focus", async ({ page }) => {
  const entry = latestPreview(page);
  const links = [
    entry.getByRole("link", { name: LATEST_ENTRY_TITLE, exact: true }),
    entry.getByRole("link", { name: `Topic Trail: ${LATEST_TRAIL_NAME}`, exact: true }),
    entry.getByRole("link", { name: `Read Entry: ${LATEST_ENTRY_TITLE}`, exact: true }),
  ];

  for (const link of links) {
    await link.focus();
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS("outline-width", "3px");
  }
});

test("has no automatically detectable accessibility violations", async ({ page }) => {
  const scan = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
});
