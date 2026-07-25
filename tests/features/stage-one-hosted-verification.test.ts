// Verifies hosted Stage 1 routes, metadata, artifacts, relationships, and failure diagnostics.
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prepareApplicationExport } from "../../src/adapters/application-export";
import {
  constructReleaseModel,
  generateVyDexDatasetSchemaV1,
  type ReleaseModel,
} from "../../src/domain";
import {
  serializeStageOneReleaseManifest,
  type StageOneReleaseManifest,
} from "../../src/release/stage-one-release";
import { verifyHostedStageOneRelease } from "../../src/release/stage-one-hosted-verification";
import {
  createLoadedCanonicalRecords,
  createValidReleaseMetadata,
} from "../domain/fixtures";

const ORIGIN = "https://vydex.pages.dev";
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

type HostedFixture = {
  input: Parameters<typeof verifyHostedStageOneRelease>[0];
  responses: Map<string, { body: string; status: number; headers?: Record<string, string> }>;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function routeFile(route: string): string {
  if (route === "/") return "index.html";
  return route.endsWith("/") ? `${route.slice(1)}index.html` : route.slice(1);
}

function createRelease(): ReleaseModel {
  const result = constructReleaseModel({
    records: createLoadedCanonicalRecords(),
    release_metadata: createValidReleaseMetadata(),
    site_origin: ORIGIN,
    mode: "production",
  });
  if (result.mode !== "production" || !result.success) throw new Error("Hosted fixture release failed.");
  return result.release;
}

function createHostedFixture(): HostedFixture {
  const release = createRelease();
  const prepared = prepareApplicationExport(release);
  if (!prepared.success) throw new Error("Hosted fixture Dataset failed.");
  const schema = generateVyDexDatasetSchemaV1({ site_origin: ORIGIN });
  if (!schema.success) throw new Error("Hosted fixture Schema failed.");
  const generatedRoutes = [
    release.routes.home,
    release.routes.methodology_current,
    release.routes.methodology_version,
    release.routes.about,
    release.routes.changelog,
    release.routes.export,
    release.routes.dataset_schema,
    release.routes.dataset_artifact!,
    ...Object.values(release.routes.entries),
    ...Object.values(release.routes.topic_trails),
  ].map(String).sort();
  const canonical = new Map<string, string>([
    [String(release.routes.home), `${ORIGIN}/`],
    [String(release.routes.methodology_current), String(release.methodology.current_url)],
    [String(release.routes.methodology_version), String(release.methodology.version_url)],
    [String(release.routes.about), `${ORIGIN}${release.routes.about}`],
    [String(release.routes.changelog), `${ORIGIN}${release.routes.changelog}`],
    [String(release.routes.export), `${ORIGIN}${release.routes.export}`],
  ]);
  for (const entry of release.current_entries) canonical.set(String(release.routes.entries[entry.entry.id]), String(entry.canonical_url));
  for (const trail of release.topic_trails) canonical.set(String(release.routes.topic_trails[trail.topic_trail.id]), String(trail.canonical_url));
  const responses = new Map<string, { body: string; status: number; headers?: Record<string, string> }>();
  const exportedEntry = prepared.data.artifact.dataset.entries[0]!;
  for (const route of generatedRoutes.filter((value) => value.endsWith("/"))) {
    const isHomepage = route === "/";
    const entry = release.current_entries.find((candidate) => String(release.routes.entries[candidate.entry.id]) === route);
    const body = `<!doctype html><html><head><link rel="canonical" href="${canonical.get(route)}"></head><body><main><h1>${isHomepage ? "Versioned Evidence for Frontier Claims" : entry?.entry.title ?? "Stage 1"}</h1><p>${entry ? exportedEntry.claim : exportedEntry.title}</p></main></body></html>`;
    responses.set(route, { body, status: 200, headers: { "Content-Type": "text/html" } });
  }
  responses.set(String(prepared.data.artifact.public_path), {
    body: prepared.data.artifact.serialized_json,
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": IMMUTABLE_CACHE_CONTROL,
      "Content-Disposition": "attachment",
    },
  });
  responses.set(String(prepared.data.artifact.schema_public_path), {
    body: schema.data.serialized_json,
    status: 200,
    headers: { "Content-Type": "application/schema+json; charset=utf-8", "Cache-Control": IMMUTABLE_CACHE_CONTROL },
  });
  const notFound = "<!doctype html><main><h1>Page not found</h1></main>";
  responses.set("/__vydex-hosted-verification-not-found__/", { body: notFound, status: 404 });
  responses.set("/search/", { body: notFound, status: 404 });
  for (const entry of release.current_entries) {
    responses.set(`${release.routes.entries[entry.entry.id]}history/`, { body: notFound, status: 404 });
  }
  const redirects = [
    ...release.redirects,
    prepared.data.artifact.latest_dataset_redirect,
  ].map(({ source, destination, status }) => ({ source, destination, status })).sort((left, right) => left.source.localeCompare(right.source));
  for (const redirect of redirects) {
    responses.set(redirect.source, { body: "", status: redirect.status, headers: { Location: redirect.destination } });
  }
  const files = [
    ...generatedRoutes.map((route) => {
      const body = responses.get(route)!.body;
      return { path: routeFile(route), bytes: Buffer.byteLength(body), sha256: sha256(body) };
    }),
    { path: "404.html", bytes: Buffer.byteLength(notFound), sha256: sha256(notFound) },
    { path: "_headers", bytes: 1, sha256: sha256("x") },
    { path: "_redirects", bytes: 1, sha256: sha256("x") },
  ].sort((left, right) => left.path.localeCompare(right.path));
  const manifest: StageOneReleaseManifest = {
    manifest_version: "1.0.0",
    release_id: release.release_metadata.release_id,
    generated_at: release.release_metadata.generated_at,
    site_origin: ORIGIN,
    entry_count: release.current_entries.length,
    topic_trail_count: release.topic_trails.length,
    methodology_versions: ["1.0.0"],
    generated_routes: generatedRoutes,
    export_filename: prepared.data.presentation.download_filename,
    json_schema_url: `${ORIGIN}${prepared.data.artifact.schema_public_path}`,
    redirects,
    files,
  };
  const manifestRaw = serializeStageOneReleaseManifest(manifest);
  return {
    responses,
    input: {
      phase: "test",
      request_origin: ORIGIN,
      canonical_origin: ORIGIN,
      deployment_id: "deployment",
      release,
      prepared_export: prepared.data,
      schema_serialized_json: schema.data.serialized_json,
      manifest,
      manifest_serialized_json: manifestRaw,
      fetch: async (url) => {
        const response = responses.get(new URL(String(url)).pathname);
        return response
          ? new Response(response.body, { status: response.status, headers: response.headers })
          : new Response(notFound, { status: 404 });
      },
    },
  };
}

describe("hosted Stage 1 verification", () => {
  test("accepts one complete internally consistent hosted release", async () => {
    const fixture = createHostedFixture();
    const report = await verifyHostedStageOneRelease(fixture.input);
    expect(report.success).toBe(true);
    expect(report.checks.filter(({ passed }) => !passed)).toEqual([]);
    expect(report.release_id).toBe(fixture.input.manifest.release_id);
    expect(report.manifest_sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test.each([
    ["wrong redirect", "/entries/earlier-frontier-result/", { status: 302 }],
    ["false not found", "/__vydex-hosted-verification-not-found__/", { status: 200 }],
    ["published deferred route", "/search/", { status: 200 }],
    ["preview marker", "/", { body: "Missing Required Field" }],
  ])("rejects %s", async (_label, path, override) => {
    const fixture = createHostedFixture();
    const current = fixture.responses.get(path as string)!;
    fixture.responses.set(path as string, { ...current, ...override });
    const report = await verifyHostedStageOneRelease(fixture.input);
    expect(report.success).toBe(false);
  });

  test("rejects changed Dataset bytes and response metadata", async () => {
    const fixture = createHostedFixture();
    const path = String(fixture.input.prepared_export.artifact.public_path);
    fixture.responses.set(path, {
      body: `${fixture.input.prepared_export.artifact.serialized_json} `,
      status: 200,
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
    const report = await verifyHostedStageOneRelease(fixture.input);
    expect(report.success).toBe(false);
    expect(report.checks.filter(({ passed }) => !passed).map(({ name }) => name)).toEqual(
      expect.arrayContaining(["Dataset JSON content type", "Dataset immutable caching", "Dataset immutable bytes"]),
    );
  });

  test("requires deployment-specific production URLs to remain non-indexable", async () => {
    const fixture = createHostedFixture();
    fixture.input.request_origin = "https://deployment.vydex.pages.dev";
    const homepage = fixture.responses.get("/")!;
    fixture.responses.set("/", {
      ...homepage,
      headers: { ...homepage.headers, "X-Robots-Tag": "noindex" },
    });

    await expect(verifyHostedStageOneRelease(fixture.input)).resolves.toMatchObject({ success: true });

    fixture.responses.set("/", homepage);
    const indexableReport = await verifyHostedStageOneRelease(fixture.input);
    expect(indexableReport.success).toBe(false);
    expect(indexableReport.checks).toContainEqual(expect.objectContaining({
      name: "non-canonical deployment is not indexable",
      passed: false,
    }));
  });
});
