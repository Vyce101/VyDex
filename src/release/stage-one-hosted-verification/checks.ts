// Verifies hosted HTTP surfaces against one committed Stage 1 release.
import { createHash } from "node:crypto";
import type { ExportEntryV1 } from "../../domain";
import {
  attribute,
  descendants,
  findFirst,
  parseHtml,
  textContent,
} from "../stage-one-release/static-html";
import type { HostedVerificationCheck, HostedVerificationInput } from "./types";

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const UNKNOWN_ROUTE = "/__vydex-hosted-verification-not-found__/";
const SITEMAP_ROUTES = ["/sitemap-index.xml", "/sitemap-0.xml"] as const;
const FORBIDDEN_PUBLIC_MARKERS = [
  "Missing Required Field",
  "data-private-preview=\"true\"",
  "data-private-preview=\"\"",
  "non-promotable",
  "diagnostic preview",
] as const;
const DEFERRED_ROUTES = ["/search/"] as const;

type CachedResponse = {
  status: number;
  headers: Headers;
  bytes: Uint8Array;
  text: string;
};

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function publicFilePath(path: string): string | undefined {
  if (path === "_headers" || path === "_redirects") return undefined;
  if (path === "index.html") return "/";
  if (path === "404.html") return UNKNOWN_ROUTE;
  if (path.endsWith("/index.html")) return `/${path.slice(0, -"index.html".length)}`;
  return `/${path}`;
}

function expectedCanonicalByRoute(input: HostedVerificationInput): Map<string, string> {
  const release = input.release;
  const values = new Map<string, string>([
    [String(release.routes.methodology_current), String(release.methodology.current_url)],
    [String(release.routes.methodology_version), String(release.methodology.version_url)],
    [String(release.routes.about), `${input.canonical_origin}${release.routes.about}`],
    [String(release.routes.changelog), `${input.canonical_origin}${release.routes.changelog}`],
    [String(release.routes.export), `${input.canonical_origin}${release.routes.export}`],
  ]);
  for (const entry of release.current_entries) {
    values.set(String(release.routes.entries[entry.entry.id]), String(entry.canonical_url));
  }
  for (const trail of release.topic_trails) {
    values.set(String(release.routes.topic_trails[trail.topic_trail.id]), String(trail.canonical_url));
  }
  return values;
}

function datasetRelationshipsResolve(
  entries: readonly ExportEntryV1[],
  input: HostedVerificationInput,
): boolean {
  const generatedRoutes = new Set(input.manifest.generated_routes);
  const releaseEntries = new Map(input.release.current_entries.map((entry) => [entry.entry.id, entry]));
  const releaseTrails = new Map(input.release.topic_trails.map((trail) => [trail.topic_trail.id, trail]));
  return entries.every((entry) => {
    const resolvedEntry = releaseEntries.get(entry.id);
    const trails = [entry.primary_topic_trail, ...entry.secondary_topic_trails];
    return resolvedEntry !== undefined &&
      generatedRoutes.has(new URL(entry.canonical_url).pathname) &&
      entry.methodology.id === resolvedEntry.methodology.id &&
      entry.methodology.version === resolvedEntry.methodology.public_version &&
      generatedRoutes.has(new URL(entry.methodology.canonical_url).pathname) &&
      trails.every((trail) =>
        releaseTrails.has(trail.id) && generatedRoutes.has(new URL(trail.canonical_url).pathname)
      );
  });
}

export function hostedEvidenceChecksums(input: HostedVerificationInput): {
  manifest_sha256: string;
  dataset_sha256: string;
  artifact_inventory_sha256: string;
} {
  return {
    manifest_sha256: sha256(input.manifest_serialized_json),
    dataset_sha256: sha256(input.prepared_export.artifact.serialized_json),
    artifact_inventory_sha256: sha256(`${JSON.stringify(input.manifest.files)}\n`),
  };
}

export async function runHostedHttpChecks(input: HostedVerificationInput): Promise<HostedVerificationCheck[]> {
  const checks: HostedVerificationCheck[] = [];
  const request = input.fetch ?? fetch;
  const responseCache = new Map<string, Promise<CachedResponse>>();

  const add = (name: string, passed: boolean, detail?: string): void => {
    checks.push({ name, passed, ...(!passed && detail ? { detail } : {}) });
  };
  const get = (path: string): Promise<CachedResponse> => {
    const existing = responseCache.get(path);
    if (existing) return existing;
    const loading = (async () => {
      const response = await request(`${input.request_origin}${path}`, {
        headers: { "Accept-Encoding": "identity" },
        redirect: "manual",
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {
        status: response.status,
        headers: response.headers,
        bytes,
        text: new TextDecoder().decode(bytes),
      };
    })();
    responseCache.set(path, loading);
    return loading;
  };

  add("canonical production origin", input.canonical_origin === input.manifest.site_origin,
    `Expected manifest origin ${input.manifest.site_origin}, received ${input.canonical_origin}.`);

  for (const route of SITEMAP_ROUTES) {
    try {
      const response = await get(route);
      add(`sitemap HTTP 200 ${route}`, response.status === 200,
        `Expected HTTP 200, received ${response.status}.`);
    } catch (error) {
      add(`sitemap HTTP 200 ${route}`, false, error instanceof Error ? error.message : String(error));
    }
  }

  for (const route of input.manifest.generated_routes) {
    try {
      const response = await get(route);
      add(`route ${route}`, response.status === 200, `Expected HTTP 200, received ${response.status}.`);
    } catch (error) {
      add(`route ${route}`, false, error instanceof Error ? error.message : String(error));
    }
  }

  for (const redirect of input.manifest.redirects) {
    try {
      const response = await get(redirect.source);
      const location = response.headers.get("location");
      add(
        `redirect ${redirect.source}`,
        response.status === redirect.status && location === redirect.destination,
        `Expected ${redirect.status} to ${redirect.destination}, received ${response.status} to ${location ?? "no location"}.`,
      );
    } catch (error) {
      add(`redirect ${redirect.source}`, false, error instanceof Error ? error.message : String(error));
    }
  }

  try {
    const response = await get(UNKNOWN_ROUTE);
    add("genuine unknown-route 404", response.status === 404 && response.text.includes("Page not found"),
      `Expected the static not-found response, received HTTP ${response.status}.`);
  } catch (error) {
    add("genuine unknown-route 404", false, error instanceof Error ? error.message : String(error));
  }

  for (const route of DEFERRED_ROUTES) {
    try {
      const response = await get(route);
      add(`deferred route absent ${route}`, response.status === 404, `Expected HTTP 404, received ${response.status}.`);
    } catch (error) {
      add(`deferred route absent ${route}`, false, error instanceof Error ? error.message : String(error));
    }
  }
  for (const entry of input.release.current_entries) {
    const route = `${input.release.routes.entries[entry.entry.id]}history/`;
    try {
      const response = await get(route);
      add(`deferred revision route absent ${route}`, response.status === 404,
        `Expected HTTP 404, received ${response.status}.`);
    } catch (error) {
      add(`deferred revision route absent ${route}`, false, error instanceof Error ? error.message : String(error));
    }
  }

  const canonicalByRoute = expectedCanonicalByRoute(input);
  for (const route of input.manifest.generated_routes.filter((value) => value.endsWith("/"))) {
    try {
      const response = await get(route);
      const document = parseHtml(response.text);
      const canonicalLinks = descendants(
        document,
        (node) => node.tagName === "link" && attribute(node, "rel") === "canonical",
      ).map((node) => attribute(node, "href"));
      const expectedCanonical = canonicalByRoute.get(route);
      if (expectedCanonical) {
        add(`canonical ${route}`, canonicalLinks.length === 1 && canonicalLinks[0] === expectedCanonical,
          `Expected ${expectedCanonical}, received ${JSON.stringify(canonicalLinks)}.`);
      } else {
        add(`canonical origin safety ${route}`, canonicalLinks.every((url) => url?.startsWith(`${input.canonical_origin}/`)),
          `Canonical metadata must use ${input.canonical_origin}.`);
      }
      const forbiddenMarker = FORBIDDEN_PUBLIC_MARKERS.find((marker) => response.text.toLowerCase().includes(marker.toLowerCase()));
      add(`production-only content ${route}`, forbiddenMarker === undefined,
        `Found forbidden production marker ${JSON.stringify(forbiddenMarker)}.`);
      const deferredLink = descendants(document, (node) => node.tagName === "a")
        .map((node) => attribute(node, "href") ?? "")
        .find((href) => href.startsWith("/search/") || /\/entries\/[^/]+\/history\//.test(href));
      add(`deferred controls absent ${route}`, deferredLink === undefined,
        `Found deferred Stage 2 destination ${deferredLink}.`);
    } catch (error) {
      add(`HTML contract ${route}`, false, error instanceof Error ? error.message : String(error));
    }
  }

  try {
    const homepage = await get("/");
    const document = parseHtml(homepage.text);
    const heading = findFirst(document, (node) => node.tagName === "h1");
    const latestTitle = input.release.current_entries[0]?.entry.title ?? "";
    const pageText = textContent(document);
    add(
      "homepage release content",
      textContent(heading ?? {}) === "Versioned Evidence for Frontier Claims" && pageText.includes(latestTitle),
      "Homepage heading or latest release Entry content is missing from delivered HTML.",
    );
    if (input.request_origin !== input.canonical_origin) {
      const robotsHeader = homepage.headers.get("x-robots-tag")?.toLowerCase() ?? "";
      add(
        "non-canonical deployment is not indexable",
        robotsHeader.split(",").some((directive) => directive.trim() === "noindex"),
        `Expected X-Robots-Tag to include noindex, received ${robotsHeader || "no header"}.`,
      );
    }
  } catch (error) {
    add("homepage release content", false, error instanceof Error ? error.message : String(error));
  }

  for (const entry of input.release.current_entries) {
    const route = String(input.release.routes.entries[entry.entry.id]);
    try {
      const response = await get(route);
      const pageText = textContent(parseHtml(response.text));
      const exportedEntry = input.prepared_export.artifact.dataset.entries.find(({ id }) => id === entry.entry.id);
      add(`core Entry HTML ${route}`, exportedEntry !== undefined && pageText.includes(exportedEntry.title) && pageText.includes(exportedEntry.claim),
        "Core Entry title or claim is absent from delivered HTML.");
    } catch (error) {
      add(`core Entry HTML ${route}`, false, error instanceof Error ? error.message : String(error));
    }
  }

  const datasetPath = String(input.prepared_export.artifact.public_path);
  const schemaPath = String(input.prepared_export.artifact.schema_public_path);
  try {
    const datasetResponse = await get(datasetPath);
    const contentType = datasetResponse.headers.get("content-type") ?? "";
    add("Dataset JSON content type", contentType.toLowerCase().startsWith("application/json"),
      `Received ${contentType || "no content type"}.`);
    add("Dataset immutable caching", datasetResponse.headers.get("cache-control") === IMMUTABLE_CACHE_CONTROL,
      `Received ${datasetResponse.headers.get("cache-control") ?? "no cache policy"}.`);
    add("Dataset attachment delivery", datasetResponse.headers.get("content-disposition")?.toLowerCase() === "attachment",
      `Received ${datasetResponse.headers.get("content-disposition") ?? "no content disposition"}.`);
    add("Dataset immutable bytes", datasetResponse.text === input.prepared_export.artifact.serialized_json,
      "Hosted Dataset bytes differ from the deterministic release artifact.");
    const dataset = JSON.parse(datasetResponse.text) as typeof input.prepared_export.artifact.dataset;
    add("Dataset release identity", dataset.release_id === input.manifest.release_id,
      `Expected ${input.manifest.release_id}, received ${dataset.release_id}.`);
    add("Dataset Entry count", dataset.entry_count === input.manifest.entry_count && dataset.entries.length === input.manifest.entry_count,
      `Expected ${input.manifest.entry_count}, received metadata ${dataset.entry_count} and ${dataset.entries.length} records.`);
    add("Dataset relationships", datasetRelationshipsResolve(dataset.entries, input),
      "One or more Dataset Entry, Topic Trail, or Methodology relationships do not resolve to published records.");
  } catch (error) {
    add("Dataset contract", false, error instanceof Error ? error.message : String(error));
  }

  try {
    const schemaResponse = await get(schemaPath);
    const contentType = schemaResponse.headers.get("content-type") ?? "";
    add("Schema JSON content type", contentType.toLowerCase().startsWith("application/schema+json"),
      `Received ${contentType || "no content type"}.`);
    add("Schema immutable caching", schemaResponse.headers.get("cache-control") === IMMUTABLE_CACHE_CONTROL,
      `Received ${schemaResponse.headers.get("cache-control") ?? "no cache policy"}.`);
    add("Schema immutable bytes", schemaResponse.text === input.schema_serialized_json,
      "Hosted Schema bytes differ from the immutable generated Schema.");
    const schema = JSON.parse(schemaResponse.text) as { $id?: string };
    add("Schema immutable URL", schema.$id === input.manifest.json_schema_url,
      `Expected ${input.manifest.json_schema_url}, received ${schema.$id ?? "no $id"}.`);
  } catch (error) {
    add("Schema contract", false, error instanceof Error ? error.message : String(error));
  }

  for (const file of input.manifest.files) {
    const path = publicFilePath(file.path);
    if (!path) continue;
    try {
      const response = await get(path);
      const expectedStatus = file.path === "404.html" ? 404 : 200;
      const actualHash = sha256(response.bytes);
      add(`hosted file ${file.path}`, response.status === expectedStatus && actualHash === file.sha256,
        `Expected HTTP ${expectedStatus} and SHA-256 ${file.sha256}, received HTTP ${response.status} and ${actualHash}.`);
    } catch (error) {
      add(`hosted file ${file.path}`, false, error instanceof Error ? error.message : String(error));
    }
  }

  return checks;
}
