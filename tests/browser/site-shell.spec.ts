// Verifies the shared Stage 1 shell structure, responsive navigation, and keyboard behavior.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const HEADER_LINKS = [
  ["Latest", "/#latest"],
  ["Methodology", "/methodology/"],
  ["About", "/about/"],
  ["Changelog", "/changelog/"],
  ["Export JSON", "/export/"],
] as const;

const FOOTER_LINKS = [
  ["About", "/about/"],
  ["Methodology", "/methodology/"],
  ["Changelog", "/changelog/"],
  ["Export JSON", "/export/"],
] as const;

async function expectOrderedLinks(navigation: Locator, expectedLinks: readonly (readonly [string, string])[]) {
  const links = await navigation.locator("a").evaluateAll((elements) =>
    elements.map((element) => ({
      href: element.getAttribute("href"),
      label: element.textContent?.trim(),
    })),
  );
  expect(links).toEqual(expectedLinks.map(([label, href]) => ({ href, label })));
}

async function setViewport(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
}

async function getDisclosureExpandedState(page: Page): Promise<boolean | undefined> {
  const session = await page.context().newCDPSession(page);
  const { root } = await session.send("DOM.getDocument");
  const { nodeId } = await session.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: "[data-site-navigation-disclosure] > summary",
  });
  const { node } = await session.send("DOM.describeNode", { nodeId });
  const tree = await session.send("Accessibility.getPartialAXTree", {
    backendNodeId: node.backendNodeId,
    fetchRelatives: false,
  });
  return tree.nodes[0]?.properties?.find(({ name }) => name === "expanded")?.value.value as
    | boolean
    | undefined;
}

test("renders the desktop shell with canonical links and shared alignment", async ({ page }) => {
  await setViewport(page, 1440);
  await page.goto("/");

  const header = page.getByRole("banner");
  const primaryNavigation = page.getByRole("navigation", { name: "Primary navigation" });
  const footer = page.getByRole("contentinfo");
  const footerNavigation = page.getByRole("navigation", { name: "Footer navigation" });

  await expect(header).toHaveCSS("background-color", "rgb(242, 244, 243)");
  await expect(header).toHaveCSS("border-bottom-width", "1px");
  expect((await header.boundingBox())?.height).toBe(72);
  await expect(primaryNavigation).toBeVisible();
  await expect(header.locator("summary", { hasText: "Menu" })).toBeHidden();
  await expectOrderedLinks(primaryNavigation, HEADER_LINKS);
  await expect(header.locator('[aria-current="page"]')).toHaveCount(0);
  await expect(header.locator(".site-header__desktop-links")).toHaveCSS("column-gap", "28px");

  const wordmark = header.getByRole("link", { name: "VyDex home" });
  await expect(wordmark).toHaveAttribute("href", "/");
  await expect(wordmark).toHaveCSS("font-family", /Source Serif 4 Variable/);
  await expect(wordmark).toHaveCSS("font-size", "24px");
  await expect(wordmark).toHaveCSS("font-weight", "650");
  await expect(wordmark).toHaveCSS("line-height", "28px");
  await expect(primaryNavigation.getByRole("link", { name: "Latest" })).toHaveCSS("font-size", "15px");
  await expect(primaryNavigation.getByRole("link", { name: "Latest" })).toHaveCSS("line-height", "20px");
  const methodologyLink = primaryNavigation.getByRole("link", { name: "Methodology" });
  await methodologyLink.evaluate((element) => element.setAttribute("aria-current", "page"));
  await expect(methodologyLink).toHaveCSS("color", "rgb(0, 109, 156)");
  await expect(methodologyLink).toHaveCSS("text-decoration-thickness", "2px");
  await expect(methodologyLink).toHaveCSS("text-underline-offset", "8px");

  const alignment = await page.evaluate(() => {
    const headerBoundary = document.querySelector(".site-header__boundary")!.getBoundingClientRect();
    const main = document.querySelector("main")!.getBoundingClientRect();
    const footerBoundary = document.querySelector(".site-footer__inner")!.getBoundingClientRect();
    return {
      footer: [footerBoundary.left, footerBoundary.right],
      header: [headerBoundary.left, headerBoundary.right],
      main: [main.left, main.right],
    };
  });
  expect(alignment.header).toEqual(alignment.main);
  expect(alignment.footer).toEqual(alignment.main);

  await expect(footer).toHaveCSS("background-color", "rgb(242, 244, 243)");
  await expect(footer).toHaveCSS("border-top-width", "1px");
  await expect(footer).toContainText("VyDex is a curated evidence ledger for frontier claims.");
  await expectOrderedLinks(footerNavigation, FOOTER_LINKS);
  await expect(
    footerNavigation.getByRole("link", { name: "About in footer navigation" }),
  ).toBeVisible();

  const structuralOrder = await page.locator("body > header, body > main, body > footer").evaluateAll((elements) =>
    elements.map((element) => element.tagName.toLowerCase()),
  );
  expect(structuralOrder).toEqual(["header", "main", "footer"]);
});

test("opens the mobile disclosure from the keyboard and restores focus on Escape", async ({ page }) => {
  await setViewport(page, 375);
  await page.goto("/");

  const header = page.getByRole("banner");
  const disclosure = header.locator("[data-site-navigation-disclosure]");
  const menu = header.locator("summary", { hasText: "Menu" });
  const mobileNavigation = page.getByRole("navigation", { name: "Mobile primary navigation" });

  expect((await header.boundingBox())?.height).toBe(60);
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeHidden();
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(mobileNavigation).toBeHidden();
  expect(await getDisclosureExpandedState(page)).toBe(false);
  const menuBox = await menu.boundingBox();
  expect(menuBox?.height).toBeGreaterThanOrEqual(44);
  expect(menuBox?.width).toBeGreaterThanOrEqual(44);
  expect(menuBox?.width).toBeLessThan((await header.boundingBox())?.width ?? 0);
  await expect(disclosure.locator(".site-header__mobile-disclosure-state-closed")).toBeVisible();
  await expect(disclosure.locator(".site-header__mobile-disclosure-state-open")).toBeHidden();

  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(disclosure.locator(".site-header__mobile-disclosure-state-closed")).toBeHidden();
  await expect(disclosure.locator(".site-header__mobile-disclosure-state-open")).toBeVisible();
  expect(await getDisclosureExpandedState(page)).toBe(true);
  await expect(mobileNavigation).toBeVisible();
  await expectOrderedLinks(mobileNavigation, HEADER_LINKS);
  await expect(mobileNavigation).toHaveCSS("border-top-width", "1px");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("menubar")).toHaveCount(0);

  const firstLink = mobileNavigation.getByRole("link", { name: "Latest" });
  await firstLink.focus();
  await page.keyboard.press("Escape");
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(menu).toBeFocused();
  expect(await getDisclosureExpandedState(page)).toBe(false);

  await page.keyboard.press("Space");
  await expect(disclosure).toHaveAttribute("open", "");
  expect(await getDisclosureExpandedState(page)).toBe(true);

  const lastLink = mobileNavigation.getByRole("link", { name: "Export JSON" });
  await lastLink.focus();
  await page.keyboard.press("Tab");
  const firstMainLink = page.locator("main a[href]").first();
  await expect(firstMainLink).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(lastLink).toBeFocused();
});

test("moves focus through the skip link and shell regions in document order", async ({ page }) => {
  for (const width of [375, 1440]) {
    await setViewport(page, width);
    await page.goto("/");

    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();

    await page.goto("/");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("banner").getByRole("link", { name: "VyDex home" })).toBeFocused();
    await page.keyboard.press("Tab");
    const nextHeaderControl = await page.evaluate(() => {
      const activeElement = document.activeElement;
      return activeElement?.querySelector("span")?.textContent?.trim()
        ?? activeElement?.textContent?.trim();
    });
    expect(nextHeaderControl).toBe(width < 768 ? "Menu" : "Latest");

    await page.goto("/");
    const visitedRegions: string[] = [];
    for (let index = 0; index < 50; index += 1) {
      await page.keyboard.press("Tab");
      const region = await page.evaluate(() => {
        const active = document.activeElement;
        if (active?.classList.contains("site-skip-link")) return "skip";
        if (active?.closest("header")) return "header";
        if (active?.closest("main")) return "main";
        if (active?.closest("footer")) return "footer";
        return "other";
      });
      if (visitedRegions.at(-1) !== region) visitedRegions.push(region);
      if (region === "footer") break;
    }
    expect(visitedRegions).toEqual(["skip", "header", "main", "footer"]);
  }
});

test("keeps the open mobile shell accessible and within the viewport", async ({ page }) => {
  await setViewport(page, 375);
  await page.goto("/");
  await page.locator("[data-site-navigation-disclosure] > summary", { hasText: "Menu" }).click();

  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
});

test.describe("without browser JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the native mobile navigation and page content usable", async ({ page }) => {
    await setViewport(page, 375);
    await page.goto("/");

    const disclosure = page.locator("[data-site-navigation-disclosure]");
    const mobileNavigation = page.getByRole("navigation", { name: "Mobile primary navigation" });
    await expect(disclosure).not.toHaveAttribute("open", "");
    const menu = disclosure.locator("summary", { hasText: "Menu" });
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(disclosure).toHaveAttribute("open", "");
    await expectOrderedLinks(mobileNavigation, HEADER_LINKS);
    await expect(page.getByRole("main")).toContainText("Versioned Evidence for Frontier Claims");
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });
});
