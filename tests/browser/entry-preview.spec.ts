// Verifies the reusable Entry preview across its three responsive conformance hosts.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const ENTRY_TITLE =
  "Dreamer 4 becomes first reported agent to obtain Minecraft diamonds using only offline training data";
const ENTRY_PATH = "/entries/dreamer-4-offline-minecraft-diamonds/";
const TRAIL_NAME = "World models for agent training";
const TRAIL_PATH = "/topic-trails/world-models-for-agent-training/";
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

function previews(page: Page): Locator {
  return page.locator("[data-entry-preview]");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("renders one identical component beneath each external host heading", async ({ page }) => {
  const hosts = page.locator("[data-entry-preview-host]");
  await expect(hosts).toHaveCount(3);
  await expect(hosts.locator(":scope > h2")).toHaveText([
    "Latest Update",
    "Recent Entries and Evidence Updates",
    "Topic Trail list",
  ]);

  const entries = previews(page);
  await expect(entries).toHaveCount(3);
  for (const entry of await entries.all()) {
    await expect(entry).toHaveAttribute("class", "entry-preview atlas-sheet");
    await expect(entry.locator(":scope > [data-entry-preview-section]")).toHaveCount(3);
    expect(
      await entry.locator(":scope > [data-entry-preview-section]").evaluateAll((sections) =>
        sections.map((section) => section.getAttribute("data-entry-preview-section")),
      ),
    ).toEqual(["metadata", "body", "footer"]);
    expect(
      await entry.locator("[data-entry-preview-field]").evaluateAll((fields) =>
        fields.map((field) => field.getAttribute("data-entry-preview-field")),
      ),
    ).toEqual(FIELD_SEQUENCE);
  }

  const renderedMarkup = await entries.evaluateAll((articles) =>
    articles.map((article) => article.innerHTML),
  );
  expect(new Set(renderedMarkup).size).toBe(1);
});

test("shows the required fields, canonical links, and contextual accessible names", async ({ page }) => {
  for (const entry of await previews(page).all()) {
    await expect(entry.locator('[data-entry-preview-field="domain"]')).toHaveText("AI Capabilities");
    const date = entry.locator('[data-entry-preview-field="date-updated"]');
    await expect(date).toHaveAttribute("datetime", "2026-07-24");
    await expect(date).toHaveText("Date Updated: 2026-07-24");

    const titleLink = entry.getByRole("link", { name: ENTRY_TITLE, exact: true });
    await expect(titleLink).toHaveAttribute("href", new RegExp(`${ENTRY_PATH}$`));
    await expect(entry.locator('[data-entry-preview-field="claim-status"]')).toHaveText(
      "Claim: Reported But Unverified",
    );
    await expect(entry.locator('[data-entry-preview-field="evidence-strength"]')).toHaveText(
      "Evidence: Strong",
    );
    await expect(entry.locator('[data-entry-preview-field="review-status"]')).toHaveText(
      "Review: Follow-Up Needed",
    );

    const trailLink = entry.getByRole("link", { name: `Topic Trail: ${TRAIL_NAME}`, exact: true });
    await expect(trailLink).toHaveAttribute("href", new RegExp(`${TRAIL_PATH}$`));
    const readLink = entry.getByRole("link", { name: `Read Entry: ${ENTRY_TITLE}`, exact: true });
    await expect(readLink).toHaveAttribute("href", new RegExp(`${ENTRY_PATH}$`));
    await expect(readLink).toHaveText("Read Entry →");
  }
});

test("keeps only Claim Status exceptional and preserves the neutral sheet treatment", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  const entry = previews(page).first();
  await expect(entry).toHaveCSS("background-color", "rgb(252, 252, 250)");
  await expect(entry).toHaveCSS("border-top-width", "1px");
  await expect(entry).toHaveCSS("border-right-width", "1px");
  await expect(entry).toHaveCSS("border-bottom-width", "1px");
  await expect(entry).toHaveCSS("border-left-width", "1px");
  await expect(entry).toHaveCSS("border-radius", "2px");
  await expect(entry).toHaveCSS("box-shadow", "none");
  await expect(entry).toHaveCSS("transform", "none");

  const metadata = entry.locator('[data-entry-preview-section="metadata"]');
  const body = entry.locator('[data-entry-preview-section="body"]');
  const footer = entry.locator('[data-entry-preview-section="footer"]');
  await expect(metadata).toHaveCSS("padding", "16px 24px");
  await expect(body).toHaveCSS("padding", "24px");
  await expect(footer).toHaveCSS("padding", "16px 24px 20px");

  const claimStatus = entry.locator('[data-entry-preview-field="claim-status"]');
  await expect(claimStatus).toHaveAttribute("data-status", "reported_but_unverified");
  await expect(claimStatus).toHaveCSS("color", "rgb(122, 90, 0)");
  await expect(claimStatus).toHaveCSS("background-color", "rgb(255, 248, 225)");
  await expect(claimStatus).toHaveCSS("border-top-color", "rgb(215, 184, 90)");

  for (const field of ["evidence-strength", "review-status"]) {
    const neutralStatus = entry.locator(`[data-entry-preview-field="${field}"]`);
    await expect(neutralStatus).not.toHaveAttribute("data-status", /.+/);
    await expect(neutralStatus).toHaveCSS("color", "rgb(53, 67, 78)");
    await expect(neutralStatus).toHaveCSS("background-color", "rgb(245, 246, 244)");
    await expect(neutralStatus).toHaveCSS("border-top-color", "rgb(185, 196, 203)");
  }

  const boundsBeforeHover = await entry.boundingBox();
  await entry.hover();
  const boundsAfterHover = await entry.boundingBox();
  expect(boundsAfterHover?.width).toBe(boundsBeforeHover?.width);
  expect(boundsAfterHover?.height).toBe(boundsBeforeHover?.height);
  await expect(entry).toHaveCSS("box-shadow", "none");
  await expect(entry).toHaveCSS("transform", "none");

  await expect(entry.locator("img, svg, canvas, figure, progress")).toHaveCount(0);
  await expect(entry).not.toContainText(/featured|trending|confidence/i);
  await expect(entry).not.toHaveAttribute("href", /.+/);
  await expect(entry).not.toHaveAttribute("role", "link");
});

test("clamps preview prose and stacks safely on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  const entry = previews(page).first();
  const metadata = entry.locator('[data-entry-preview-section="metadata"]');
  const footer = entry.locator('[data-entry-preview-section="footer"]');
  await expect(metadata).toHaveCSS("flex-direction", "column");
  await expect(footer).toHaveCSS("flex-direction", "column");
  await expect(metadata).toHaveCSS("font-size", "12px");
  await expect(metadata).toHaveCSS("line-height", "16px");
  await expect(entry.locator(".entry-preview__statuses")).toHaveCSS("flex-wrap", "wrap");
  await expect(entry.locator(".entry-preview__statuses")).toHaveCSS("gap", "8px");

  const clampMetrics = await entry.evaluate((article) => {
    const measure = (selector: string) => {
      const element = article.querySelector<HTMLElement>(selector)!;
      const styles = getComputedStyle(element);
      return {
        clientHeight: element.clientHeight,
        lineClamp: styles.webkitLineClamp,
        lineHeight: Number.parseFloat(styles.lineHeight),
        scrollHeight: element.scrollHeight,
      };
    };
    return {
      claim: measure(".entry-preview__claim"),
      title: measure(".entry-preview__title a"),
    };
  });
  expect(clampMetrics.title.lineClamp).toBe("2");
  expect(clampMetrics.title.clientHeight).toBeLessThanOrEqual(clampMetrics.title.lineHeight * 2 + 1);
  expect(clampMetrics.title.scrollHeight).toBeGreaterThan(clampMetrics.title.clientHeight);
  expect(clampMetrics.claim.lineClamp).toBe("3");
  expect(clampMetrics.claim.clientHeight).toBeLessThanOrEqual(clampMetrics.claim.lineHeight * 3 + 1);
  expect(clampMetrics.claim.scrollHeight).toBeGreaterThan(clampMetrics.claim.clientHeight);

  for (const width of [320, 375, 767, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const documentWidths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(documentWidths.scroll).toBeLessThanOrEqual(documentWidths.client);
  }

  await page.setViewportSize({ width: 768, height: 900 });
  await expect(metadata).toHaveCSS("flex-direction", "row");
  await expect(footer).toHaveCSS("flex-direction", "row");
});

test("keeps every Entry link keyboard accessible with visible focus", async ({ page }) => {
  const entry = previews(page).first();
  const titleLink = entry.getByRole("link", { name: ENTRY_TITLE, exact: true });
  const claimLink = entry.getByRole("link", { name: "Dreamer 4", exact: true });
  const trailLink = entry.getByRole("link", { name: `Topic Trail: ${TRAIL_NAME}`, exact: true });
  const readLink = entry.getByRole("link", { name: `Read Entry: ${ENTRY_TITLE}`, exact: true });

  await titleLink.focus();
  await expect(titleLink).toBeFocused();
  await expect(titleLink).toHaveCSS("outline-width", "3px");
  await page.keyboard.press("Tab");
  await expect(claimLink).toBeFocused();
  await expect(claimLink).toHaveCSS("outline-width", "3px");
  await expect(entry.locator(".entry-preview__claim")).toHaveCSS("-webkit-line-clamp", "none");
  await page.keyboard.press("Tab");
  await expect(trailLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(readLink).toBeFocused();
  await expect(readLink).toHaveCSS("outline-width", "3px");
});

test("has no automatically detectable accessibility violations", async ({ page }) => {
  const scan = await new AxeBuilder({ page })
    .include("[data-entry-preview-host]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
});
