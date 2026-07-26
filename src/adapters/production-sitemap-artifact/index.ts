// Verifies production sitemap files against the generated public HTML artifact.
import { readdir, readFile } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";

const SITEMAP_INDEX_FILENAME = "sitemap-index.xml";
const SITEMAP_CHILD_FILENAME = "sitemap-0.xml";
const ROBOTS_FILENAME = "robots.txt";
const ERROR_PAGE_FILENAME_PATTERN = /^(?:404|500)\.html$/;

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const filename = resolve(directory, entry.name);
    if (entry.isDirectory()) return listFiles(filename);
    return entry.isFile() ? [filename] : [];
  }));
  return nestedFiles.flat();
}

function htmlFilenameToUrl(outputRoot: string, filename: string, siteOrigin: string): string {
  const outputPath = relative(outputRoot, filename).split(sep).join("/");
  const pathname = outputPath === "index.html"
    ? "/"
    : outputPath.endsWith("/index.html")
      ? `/${outputPath.slice(0, -"index.html".length)}`
      : `/${outputPath}`;
  return new URL(pathname, siteOrigin).href;
}

function sitemapLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!.trim());
}

function requireExactValues(actual: readonly string[], expected: readonly string[], subject: string): void {
  const sortedActual = [...actual].sort((left, right) => left.localeCompare(right, "en"));
  const sortedExpected = [...expected].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(sortedActual) !== JSON.stringify(sortedExpected)) {
    throw new Error(`${subject} must match exactly. Expected ${JSON.stringify(sortedExpected)}, received ${JSON.stringify(sortedActual)}.`);
  }
}

export async function verifyProductionSitemapArtifact(input: {
  output_root: string;
  site_origin: string;
}): Promise<{ public_page_count: number; sitemap_file_count: number }> {
  const outputRoot = resolve(input.output_root);
  const siteOrigin = new URL(input.site_origin).origin;
  const files = await listFiles(outputRoot);
  const publicHtmlFiles = files.filter((filename) =>
    filename.endsWith(".html") && !ERROR_PAGE_FILENAME_PATTERN.test(basename(filename))
  );
  const expectedPageUrls = publicHtmlFiles.map((filename) =>
    htmlFilenameToUrl(outputRoot, filename, siteOrigin)
  );

  const indexPath = resolve(outputRoot, SITEMAP_INDEX_FILENAME);
  const childPath = resolve(outputRoot, SITEMAP_CHILD_FILENAME);
  const robotsPath = resolve(outputRoot, ROBOTS_FILENAME);
  const [indexXml, childXml, robots] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(childPath, "utf8"),
    readFile(robotsPath, "utf8"),
  ]);
  const expectedChildUrl = new URL(`/${SITEMAP_CHILD_FILENAME}`, siteOrigin).href;
  requireExactValues(sitemapLocations(indexXml), [expectedChildUrl], "Sitemap index locations");

  const listedPageUrls = sitemapLocations(childXml);
  for (const listedUrl of listedPageUrls) {
    if (new URL(listedUrl).origin !== siteOrigin) {
      throw new Error(`Sitemap URL must use ${siteOrigin}, received ${listedUrl}.`);
    }
  }
  requireExactValues(listedPageUrls, expectedPageUrls, "Sitemap public page URLs");

  const expectedRobotsDirective = `Sitemap: ${new URL(`/${SITEMAP_INDEX_FILENAME}`, siteOrigin).href}`;
  if (!robots.split(/\r?\n/).includes(expectedRobotsDirective)) {
    throw new Error(`robots.txt must contain ${expectedRobotsDirective}.`);
  }

  return { public_page_count: expectedPageUrls.length, sitemap_file_count: 2 };
}
