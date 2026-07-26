// Verifies deployment-shaped sitemap files against their generated HTML pages.
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { verifyProductionSitemapArtifact } from "../../src/adapters/production-sitemap-artifact";

const ORIGIN = "https://vydex.pages.dev";
const PUBLIC_PAGES = [
  "/",
  "/about/",
  "/entries/example-entry/",
  "/methodology/",
  "/topic-trails/example-topic/",
] as const;
const temporaryRoots: string[] = [];

function pageFilename(outputRoot: string, pathname: string): string {
  return pathname === "/"
    ? resolve(outputRoot, "index.html")
    : resolve(outputRoot, pathname.slice(1), "index.html");
}

function sitemapIndex(locations: readonly string[]): string {
  return `<?xml version="1.0"?><sitemapindex>${locations.map((url) => `<sitemap><loc>${url}</loc></sitemap>`).join("")}</sitemapindex>`;
}

function sitemapChild(locations: readonly string[]): string {
  return `<?xml version="1.0"?><urlset>${locations.map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>`;
}

async function writeArtifact(input: {
  index_locations?: readonly string[];
  child_locations?: readonly string[];
  omit_index?: boolean;
  omit_child?: boolean;
  robots?: string;
} = {}): Promise<string> {
  const outputRoot = await mkdtemp(join(tmpdir(), "vydex-sitemap-"));
  temporaryRoots.push(outputRoot);
  for (const pathname of PUBLIC_PAGES) {
    const filename = pageFilename(outputRoot, pathname);
    await mkdir(dirname(filename), { recursive: true });
    await writeFile(
      filename,
      `<!doctype html><html><head><link href="${ORIGIN}${pathname}" rel="canonical"></head><body></body></html>`,
      "utf8",
    );
  }
  await writeFile(resolve(outputRoot, "404.html"), "<h1>Page not found</h1>", "utf8");
  await mkdir(resolve(outputRoot, "datasets"), { recursive: true });
  await writeFile(resolve(outputRoot, "datasets", "release.json"), "{}", "utf8");
  if (!input.omit_index) {
    await writeFile(
      resolve(outputRoot, "sitemap-index.xml"),
      sitemapIndex(input.index_locations ?? [`${ORIGIN}/sitemap-0.xml`]),
      "utf8",
    );
  }
  if (!input.omit_child) {
    await writeFile(
      resolve(outputRoot, "sitemap-0.xml"),
      sitemapChild(input.child_locations ?? PUBLIC_PAGES.map((pathname) => `${ORIGIN}${pathname}`)),
      "utf8",
    );
  }
  await writeFile(
    resolve(outputRoot, "robots.txt"),
    input.robots ?? `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap-index.xml\n`,
    "utf8",
  );
  return outputRoot;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("production sitemap artifact", () => {
  test("accepts every generated public HTML page and excludes errors and non-page artifacts", async () => {
    const outputRoot = await writeArtifact();

    await expect(verifyProductionSitemapArtifact({
      output_root: outputRoot,
      site_origin: ORIGIN,
    })).resolves.toEqual({ public_page_count: PUBLIC_PAGES.length, sitemap_file_count: 2 });
  });

  test.each([
    [{ omit_index: true }, "sitemap-index.xml"],
    [{ omit_child: true }, "sitemap-0.xml"],
  ] as const)("rejects a missing sitemap file", async (options, missingFilename) => {
    const outputRoot = await writeArtifact(options);

    await expect(verifyProductionSitemapArtifact({
      output_root: outputRoot,
      site_origin: ORIGIN,
    })).rejects.toThrow(missingFilename);
  });

  test("requires the index to reference the production child sitemap", async () => {
    const outputRoot = await writeArtifact({ index_locations: [`${ORIGIN}/different.xml`] });

    await expect(verifyProductionSitemapArtifact({
      output_root: outputRoot,
      site_origin: ORIGIN,
    })).rejects.toThrow("Sitemap index locations must match exactly");
  });

  test.each([
    ["foreign origin", [`${ORIGIN}/`, "https://example.com/about/"]],
    ["missing generated page", PUBLIC_PAGES.slice(0, -1).map((pathname) => `${ORIGIN}${pathname}`)],
    ["non-page artifact", [...PUBLIC_PAGES.map((pathname) => `${ORIGIN}${pathname}`), `${ORIGIN}/datasets/release.json`]],
    ["error page", [...PUBLIC_PAGES.map((pathname) => `${ORIGIN}${pathname}`), `${ORIGIN}/404/`]],
  ])("rejects a %s in the child sitemap", async (_label, childLocations) => {
    const outputRoot = await writeArtifact({ child_locations: childLocations });

    await expect(verifyProductionSitemapArtifact({
      output_root: outputRoot,
      site_origin: ORIGIN,
    })).rejects.toThrow(/Sitemap URL must use|Sitemap public page URLs must match exactly/);
  });

  test("requires robots.txt to advertise the production sitemap index", async () => {
    const outputRoot = await writeArtifact({ robots: "User-agent: *\nAllow: /\n" });

    await expect(verifyProductionSitemapArtifact({
      output_root: outputRoot,
      site_origin: ORIGIN,
    })).rejects.toThrow(`robots.txt must contain Sitemap: ${ORIGIN}/sitemap-index.xml`);
  });
});
