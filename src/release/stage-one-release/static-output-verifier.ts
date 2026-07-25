// Verifies that staged static files represent exactly one complete Stage 1 release.
import { readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { PreparedApplicationExport } from "../../adapters/application-export";
import {
  compareResolvedPublicEntriesByLatestMaterialActivity,
  type ReleaseModel,
} from "../../domain";
import { HEADER_NAVIGATION_ITEMS, FOOTER_NAVIGATION_ITEMS } from "../../components/site-shell/navigation";
import { collectStageOneRedirects, type StageOneRedirect } from "./redirects";
import type { StageOneReleaseDiagnostic } from "./diagnostics";
import { releaseGateDiagnostic } from "./diagnostics";
import {
  attribute,
  descendants,
  findFirst,
  hasAttribute,
  hrefPath,
  parseHtml,
  readHtml,
  routeToFilename,
  textContent,
  titleLinksWithin,
  type HtmlNode,
} from "./static-html";
import {
  expectedStageOneGeneratedRoutes,
  listStaticOutputFiles,
  staticFilenameToPublicRoute,
} from "./static-output-routes";

const PUBLIC_PREVIEW_MARKERS = [
  "Missing Required Field",
  "data-private-preview=\"true\"",
  "data-private-preview=\"\"",
  "non-promotable",
] as const;

function diagnostic(
  code: string,
  rule: string,
  generatedSurfaces: readonly string[],
  field = "staged output",
  record = "release",
): StageOneReleaseDiagnostic {
  return releaseGateDiagnostic({
    code,
    rule,
    field,
    record,
    generated_surfaces: generatedSurfaces,
  });
}


function compareExactValues(
  actual: readonly string[],
  expected: readonly string[],
  code: string,
  surface: string,
): StageOneReleaseDiagnostic[] {
  return JSON.stringify(actual) === JSON.stringify(expected)
    ? []
    : [
        diagnostic(
          code,
          `${surface} must match the resolved release exactly. Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
          [surface],
        ),
      ];
}

function verifyHomepage(document: HtmlNode, release: ReleaseModel): StageOneReleaseDiagnostic[] {
  const diagnostics: StageOneReleaseDiagnostic[] = [];
  const ordered = [...release.current_entries].sort(compareResolvedPublicEntriesByLatestMaterialActivity);
  const latestContainer = findFirst(document, (node) => hasAttribute(node, "data-homepage-latest"));
  const recentContainer = findFirst(document, (node) => hasAttribute(node, "data-homepage-recent-list"));
  const latest = latestContainer ? titleLinksWithin(latestContainer) : [];
  const recent = recentContainer ? titleLinksWithin(recentContainer) : [];
  diagnostics.push(
    ...compareExactValues(
      latest.map(({ title }) => title),
      [ordered[0]!.entry.title],
      "homepage_latest_entry_mismatch",
      "Homepage Latest Entry",
    ),
    ...compareExactValues(
      recent.map(({ title }) => title),
      ordered.slice(0, 5).map(({ entry }) => entry.title),
      "homepage_recent_order_mismatch",
      "Homepage recent ordering",
    ),
  );
  return diagnostics;
}

async function verifyEntryAndTrailRoutes(
  outputRoot: string,
  release: ReleaseModel,
): Promise<StageOneReleaseDiagnostic[]> {
  const diagnostics: StageOneReleaseDiagnostic[] = [];
  for (const entry of release.current_entries) {
    const { document } = await readHtml(outputRoot, release.routes.entries[entry.entry.id]!);
    const heading = findFirst(document, (node) => node.tagName === "h1");
    if (textContent(heading ?? {}) !== entry.entry.title) {
      diagnostics.push(
        diagnostic(
          "entry_route_content_mismatch",
          "Every Entry route must render the selected current Entry title.",
          ["Entry routes"],
          "title",
          entry.entry.id,
        ),
      );
    }
  }

  for (const trail of release.topic_trails) {
    const { document } = await readHtml(outputRoot, release.routes.topic_trails[trail.topic_trail.id]!);
    const metadata = findFirst(document, (node) => hasAttribute(node, "data-topic-trail-section", "metadata"));
    const metadataValues = metadata
      ? descendants(metadata, (node) => node.tagName === "dd").map(textContent)
      : [];
    const list = findFirst(document, (node) => hasAttribute(node, "data-topic-trail-entry-list"));
    const titles = list ? titleLinksWithin(list).map(({ title }) => title) : [];
    const expectedTitles = trail.entries.map(({ entry }) => entry.title);
    if (
      metadataValues[0] !== String(trail.entry_count) ||
      metadataValues[1] !== trail.last_activity.published_at.slice(0, 10) ||
      JSON.stringify(titles) !== JSON.stringify(expectedTitles)
    ) {
      diagnostics.push(
        diagnostic(
          "topic_trail_output_mismatch",
          "Topic Trail count, Last Activity, and ordered Entries must match release resolution.",
          ["Topic Trail routes"],
          "entry_count,last_activity,entries",
          trail.topic_trail.id,
        ),
      );
    }
  }
  return diagnostics;
}

async function verifyMethodologyAndChangelog(
  outputRoot: string,
  release: ReleaseModel,
): Promise<StageOneReleaseDiagnostic[]> {
  const diagnostics: StageOneReleaseDiagnostic[] = [];
  const methodologyPages = await Promise.all(
    [release.routes.methodology_current, release.routes.methodology_version].map((route) =>
      readHtml(outputRoot, route),
    ),
  );
  for (const [index, page] of methodologyPages.entries()) {
    const canonical = findFirst(
      page.document,
      (node) => node.tagName === "link" && attribute(node, "rel") === "canonical",
    );
    const expected = index === 0 ? release.methodology.current_url : release.methodology.version_url;
    if (attribute(canonical ?? {}, "href") !== expected) {
      diagnostics.push(
        diagnostic(
          "methodology_canonical_mismatch",
          "Current and versioned Methodology routes must retain their resolved canonical destinations.",
          ["Methodology routes"],
        ),
      );
    }
  }

  const changelog = await readHtml(outputRoot, release.routes.changelog);
  const groups = descendants(changelog.document, (node) => hasAttribute(node, "data-changelog-date-group"));
  const renderedEvents = groups.flatMap((group) => {
    const date = textContent(findFirst(group, (node) => node.tagName === "time") ?? {});
    return descendants(group, (node) => hasAttribute(node, "data-changelog-record")).map((record) => ({
      type: attribute(record, "data-change-type"),
      date,
      title: textContent(findFirst(record, (node) => node.tagName === "h4") ?? {}),
    }));
  });
  const expectedEvents = release.changelog_events.map(({ type, date, title }) => ({ type, date, title }));
  if (JSON.stringify(renderedEvents) !== JSON.stringify(expectedEvents)) {
    diagnostics.push(
      diagnostic(
        "changelog_output_mismatch",
        "Rendered Changelog events must match the complete ordered material event collection.",
        ["Changelog"],
      ),
    );
  }
  return diagnostics;
}

async function verifyExportAndSchema(
  outputRoot: string,
  release: ReleaseModel,
  preparedExport: PreparedApplicationExport,
): Promise<StageOneReleaseDiagnostic[]> {
  const diagnostics: StageOneReleaseDiagnostic[] = [];
  try {
    const datasetRaw = await readFile(routeToFilename(outputRoot, preparedExport.artifact.public_path), "utf8");
    const schemaRaw = await readFile(routeToFilename(outputRoot, preparedExport.artifact.schema_public_path), "utf8");
    const dataset: unknown = JSON.parse(datasetRaw);
    const schema: unknown = JSON.parse(schemaRaw);
    if (
      datasetRaw !== preparedExport.artifact.serialized_json ||
      JSON.stringify(dataset) !== JSON.stringify(preparedExport.artifact.dataset)
    ) {
      diagnostics.push(
        diagnostic(
          "export_bytes_mismatch",
          "The emitted immutable export must exactly equal the prepared release artifact.",
          ["JSON export"],
        ),
      );
    }
    const expectedSchemaUrl = `${release.site_origin}${preparedExport.artifact.schema_public_path}`;
    if (typeof schema !== "object" || schema === null || Reflect.get(schema, "$id") !== expectedSchemaUrl) {
      diagnostics.push(
        diagnostic(
          "schema_url_mismatch",
          "The emitted Schema $id must equal the release's canonical Schema URL.",
          ["JSON Schema", "JSON export"],
        ),
      );
    } else {
      const ajv = new Ajv2020({ allErrors: true, strict: true });
      addFormats(ajv);
      const validate = ajv.compile(schema);
      if (!validate(dataset)) {
        diagnostics.push(
          diagnostic(
            "emitted_export_schema_invalid",
            `The emitted JSON export failed its emitted Schema: ${ajv.errorsText(validate.errors)}.`,
            ["JSON Schema", "JSON export"],
          ),
        );
      }
    }

    const exportPage = await readHtml(outputRoot, release.routes.export);
    const countNode = findFirst(exportPage.document, (node) => hasAttribute(node, "data-export-entry-count"));
    const download = findFirst(exportPage.document, (node) => hasAttribute(node, "data-export-download"));
    if (
      textContent(countNode ?? {}) !== String(release.current_entries.length) ||
      hrefPath(attribute(download ?? {}, "href") ?? "", release.site_origin)?.pathname !==
        preparedExport.artifact.public_path
    ) {
      diagnostics.push(
        diagnostic(
          "export_page_metadata_mismatch",
          "The Export Page count and download must match the prepared release artifact.",
          ["Export route", "JSON export"],
        ),
      );
    }
  } catch (error) {
    diagnostics.push(
      diagnostic(
        "export_or_schema_verification_failed",
        `The generated export or Schema could not be parsed and verified: ${error instanceof Error ? error.message : String(error)}.`,
        ["JSON Schema", "JSON export"],
      ),
    );
  }
  return diagnostics;
}

function verifyShell(document: HtmlNode, route: string): StageOneReleaseDiagnostic[] {
  const expectedHeader = HEADER_NAVIGATION_ITEMS.map(({ href }) => String(href));
  const expectedFooter = FOOTER_NAVIGATION_ITEMS.map(({ href }) => String(href));
  const header = findFirst(
    document,
    (node) => node.tagName === "header" && attribute(node, "class")?.split(/\s+/).includes("site-header") === true,
  );
  const footer = findFirst(
    document,
    (node) => node.tagName === "footer" && attribute(node, "class")?.split(/\s+/).includes("site-footer") === true,
  );
  const headerNavigations = header ? descendants(header, (node) => node.tagName === "nav") : [];
  const footerNavigation = footer ? findFirst(footer, (node) => node.tagName === "nav") : undefined;
  const headerMismatch = headerNavigations.some(
    (navigation) =>
      JSON.stringify(descendants(navigation, (node) => node.tagName === "a").map((node) => attribute(node, "href"))) !==
      JSON.stringify(expectedHeader),
  );
  const footerLinks = footerNavigation
    ? descendants(footerNavigation, (node) => node.tagName === "a").map((node) => attribute(node, "href"))
    : [];
  return headerNavigations.length !== 2 || headerMismatch || JSON.stringify(footerLinks) !== JSON.stringify(expectedFooter)
    ? [
        diagnostic(
          "site_shell_destination_mismatch",
          "Every public HTML page must use the exact Stage 1 Header and Footer destinations.",
          ["Header and Footer navigation"],
          "navigation destinations",
          route,
        ),
      ]
    : [];
}

async function verifyLinks(
  outputRoot: string,
  release: ReleaseModel,
  htmlRoutes: readonly string[],
  redirects: readonly StageOneRedirect[],
): Promise<StageOneReleaseDiagnostic[]> {
  const diagnostics: StageOneReleaseDiagnostic[] = [];
  const generatedRoutes = new Set(expectedStageOneGeneratedRoutes(release));
  generatedRoutes.add("/404.html");
  const redirectSources = new Set(redirects.map(({ source }) => source));
  for (const route of htmlRoutes) {
    const { document } = await readHtml(outputRoot, route);
    diagnostics.push(...verifyShell(document, route));
    const linkNodes = descendants(document, (node) =>
      (node.tagName === "a" || node.tagName === "link" || node.tagName === "script") &&
      (attribute(node, "href") !== undefined || attribute(node, "src") !== undefined),
    );
    for (const linkNode of linkNodes) {
      const href = attribute(linkNode, "href") ?? attribute(linkNode, "src")!;
      const target = hrefPath(href, release.site_origin, route);
      if (!target) continue;
      if (target.pathname === "__invalid__") {
        diagnostics.push(diagnostic("invalid_generated_link", `Generated link is invalid: ${href}.`, [route]));
        continue;
      }
      if (target.pathname.startsWith("/_astro/")) {
        try {
          await readFile(resolve(outputRoot, target.pathname.replace(/^\/+/, "")));
        } catch {
          diagnostics.push(diagnostic("dead_asset_link", `Generated asset does not exist: ${href}.`, [route]));
        }
        continue;
      }
      const normalizedPath = target.pathname.endsWith("/") || /\.(?:html|json)$/.test(target.pathname)
        ? target.pathname
        : `${target.pathname}/`;
      if (!generatedRoutes.has(normalizedPath) && !redirectSources.has(normalizedPath)) {
        diagnostics.push(diagnostic("dead_navigation_link", `Generated destination does not exist: ${href}.`, [route]));
        continue;
      }
      if (target.hash && generatedRoutes.has(normalizedPath)) {
        const targetDocument = parseHtml(
          await readFile(routeToFilename(outputRoot, normalizedPath), "utf8"),
        );
        const fragment = decodeURIComponent(target.hash.slice(1));
        if (!findFirst(targetDocument, (node) => attribute(node, "id") === fragment)) {
          diagnostics.push(diagnostic("dead_fragment_link", `Generated fragment does not exist: ${href}.`, [route]));
        }
      }
    }
  }
  return diagnostics;
}

export async function verifyStageOneStaticOutput(input: {
  output_root: string;
  release: ReleaseModel;
  prepared_export: PreparedApplicationExport;
}): Promise<{ diagnostics: StageOneReleaseDiagnostic[]; generated_routes: string[] }> {
  const diagnostics: StageOneReleaseDiagnostic[] = [];
  const expectedRoutes = expectedStageOneGeneratedRoutes(input.release);
  const files = await listStaticOutputFiles(input.output_root);
  const actualRoutes = files
    .map((filename) => staticFilenameToPublicRoute(input.output_root, filename))
    .filter((route): route is string => route !== undefined)
    .sort((left, right) => left.localeCompare(right, "en"));
  diagnostics.push(
    ...compareExactValues(actualRoutes, expectedRoutes, "generated_route_set_mismatch", "Generated route list"),
  );

  const htmlRoutes = expectedRoutes.filter((route) => route.endsWith("/"));
  try {
    const homepage = await readHtml(input.output_root, input.release.routes.home);
    diagnostics.push(
      ...verifyHomepage(homepage.document, input.release),
      ...(await verifyEntryAndTrailRoutes(input.output_root, input.release)),
      ...(await verifyMethodologyAndChangelog(input.output_root, input.release)),
      ...(await verifyExportAndSchema(input.output_root, input.release, input.prepared_export)),
      ...(await verifyLinks(
        input.output_root,
        input.release,
        [...htmlRoutes, "/404.html"],
        collectStageOneRedirects(input.release, input.prepared_export),
      )),
    );
  } catch (error) {
    diagnostics.push(
      diagnostic(
        "staged_surface_verification_failed",
        `A required generated surface could not be read: ${error instanceof Error ? error.message : String(error)}.`,
        ["Production static output"],
      ),
    );
  }

  for (const filename of files.filter((file) => /\.(?:html|json)$/.test(file))) {
    const contents = await readFile(filename, "utf8");
    for (const marker of PUBLIC_PREVIEW_MARKERS) {
      if (contents.includes(marker)) {
        diagnostics.push(
          diagnostic(
            "private_preview_content_in_public_output",
            `Private preview marker ${JSON.stringify(marker)} must never appear publicly.`,
            ["Production static output"],
            "preview marker",
            relative(input.output_root, filename).split(sep).join("/"),
          ),
        );
      }
    }
  }

  return { diagnostics, generated_routes: expectedRoutes };
}
