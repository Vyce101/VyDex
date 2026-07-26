// Verifies hosted Release ID discovery and archived byte/header verification.
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { discoverHostedReleaseId, runArchivedHostedVerification } from "../../scripts/deployment/hosted-verification-support";
import { serializeImmutablePublicContract, serializeReleaseHistory } from "../../src/domain";
import { serializeReleaseManifest } from "../../src/release/release-publication";
import type { ReleaseLogger } from "../../src/shared/release-logger";

const FIRST = "019f9b40-a3a8-75ad-b2b2-05a7100bcc34";
const SECOND = "019f9b40-a3a8-75ad-b2b2-05a7100bcc35";

function hash(contents: Uint8Array): string {
  return createHash("sha256").update(contents).digest("hex");
}

describe("hosted release selection", () => {
  test("identifies exactly one known Release ID from the hosted Export page", async () => {
    await expect(discoverHostedReleaseId({
      request_origin: "https://vydex.pages.dev",
      known_release_ids: [FIRST, SECOND],
      fetch: async () => new Response(`<main><dd>${SECOND}</dd></main>`),
    })).resolves.toBe(SECOND);
  });

  test.each([
    ["unknown", "<main>unknown</main>"],
    ["ambiguous", `<main>${FIRST} ${SECOND}</main>`],
  ])("rejects %s hosted identity", async (_label, body) => {
    await expect(discoverHostedReleaseId({
      request_origin: "https://vydex.pages.dev",
      known_release_ids: [FIRST, SECOND],
      fetch: async () => new Response(body),
    })).rejects.toThrow("exactly one known Release ID");
  });

  test("verifies an archived deployment against its complete manifest and immutable headers", async () => {
    const root = await mkdtemp(join(tmpdir(), "vydex-archived-hosted-"));
    const archiveRoot = resolve(root, "generated/release-data/releases", FIRST);
    const datasetPath = `/datasets/releases/${FIRST}/dataset.json`;
    const schemaPath = "/schemas/dataset.json";
    const bodies = new Map<string, Uint8Array>([
      ["/", Buffer.from("<main>archived release</main>")],
      ["/__vydex-hosted-verification-not-found__/", Buffer.from("not found")],
      [datasetPath, Buffer.from('{"entry_count":1}\n')],
      [schemaPath, Buffer.from('{"type":"object"}\n')],
    ]);
    const descriptorRaw = `${JSON.stringify({ release_id: FIRST, generated_at: "2026-07-25T21:48:52.520Z" }, null, 2)}\n`;
    const contract = {
      contract_version: "1.0.0" as const,
      release_id: FIRST as never,
      routes: [
        {
          public_path: datasetPath,
          archive_path: datasetPath.slice(1),
          bytes: bodies.get(datasetPath)!.byteLength,
          sha256: hash(bodies.get(datasetPath)!),
          content_type: "application/json; charset=utf-8",
          cache_control: "public, max-age=31536000, immutable",
          content_disposition: "attachment; filename=\"dataset.json\"",
        },
        {
          public_path: schemaPath,
          archive_path: schemaPath.slice(1),
          bytes: bodies.get(schemaPath)!.byteLength,
          sha256: hash(bodies.get(schemaPath)!),
          content_type: "application/schema+json; charset=utf-8",
          cache_control: "public, max-age=31536000, immutable",
        },
      ],
    };
    const files = [
      { path: "404.html", bytes: bodies.get("/__vydex-hosted-verification-not-found__/")!.byteLength, sha256: hash(bodies.get("/__vydex-hosted-verification-not-found__/")!) },
      { path: datasetPath.slice(1), bytes: bodies.get(datasetPath)!.byteLength, sha256: hash(bodies.get(datasetPath)!) },
      { path: "index.html", bytes: bodies.get("/")!.byteLength, sha256: hash(bodies.get("/")!) },
      { path: schemaPath.slice(1), bytes: bodies.get(schemaPath)!.byteLength, sha256: hash(bodies.get(schemaPath)!) },
    ].sort((left, right) => left.path.localeCompare(right.path, "en"));
    const routes = ["/", datasetPath, schemaPath].sort((left, right) => left.localeCompare(right, "en"));
    const manifestRaw = serializeReleaseManifest({
      manifest_version: "2.0.0",
      release_id: FIRST as never,
      generated_at: "2026-07-25T21:48:52.520Z" as never,
      source_commit: "655b7c8bf4a8b5cbb88bbc9427735084c5f19973",
      previous_release_id: null,
      retained_release_ids: [],
      site_origin: "https://vydex.pages.dev",
      entry_count: 1,
      topic_trail_count: 1,
      methodology_versions: ["1.0.0"],
      generated_routes: routes,
      current_release_routes: routes,
      retained_immutable_routes: [],
      export_filename: "dataset.json",
      json_schema_url: "https://vydex.pages.dev/schemas/dataset.json",
      redirects: [{ source: "/datasets/latest.json", destination: datasetPath, status: 302 }],
      files,
    });
    const historyRaw = serializeReleaseHistory({
      history_version: "1.0.0",
      releases: [{
        release_id: FIRST as never,
        generated_at: "2026-07-25T21:48:52.520Z" as never,
        source_commit: "655b7c8bf4a8b5cbb88bbc9427735084c5f19973",
        descriptor_path: `generated/release-data/releases/${FIRST}/release.json`,
        manifest_path: `generated/release-data/releases/${FIRST}/release-manifest.json`,
        dataset_public_path: datasetPath,
        previous_release_id: null,
      }],
    });
    await mkdir(resolve(archiveRoot, "immutable-public", datasetPath.slice(1, datasetPath.lastIndexOf("/"))), { recursive: true });
    await mkdir(resolve(archiveRoot, "immutable-public", schemaPath.slice(1, schemaPath.lastIndexOf("/"))), { recursive: true });
    await writeFile(resolve(root, "generated/release-data/release.json"), descriptorRaw);
    await writeFile(resolve(root, "generated/release-data/release-manifest.json"), manifestRaw);
    await writeFile(resolve(root, "generated/release-data/release-history.json"), historyRaw);
    await writeFile(resolve(archiveRoot, "release.json"), descriptorRaw);
    await writeFile(resolve(archiveRoot, "release-manifest.json"), manifestRaw);
    await writeFile(resolve(archiveRoot, "immutable-public-contract.json"), serializeImmutablePublicContract(contract));
    await writeFile(resolve(archiveRoot, "immutable-public", datasetPath.slice(1)), bodies.get(datasetPath)!);
    await writeFile(resolve(archiveRoot, "immutable-public", schemaPath.slice(1)), bodies.get(schemaPath)!);
    const request = vi.fn(async (requestUrl: string | URL | Request) => {
      const path = new URL(String(requestUrl)).pathname;
      if (path === "/datasets/latest.json") return new Response(null, { status: 302, headers: { location: datasetPath } });
      const headers = new Headers();
      if (path.includes("/datasets/releases/")) {
        headers.set("content-type", "application/json; charset=utf-8");
        headers.set("cache-control", "public, max-age=31536000, immutable");
        headers.set("content-disposition", "attachment");
      }
      if (path.startsWith("/schemas/")) {
        headers.set("content-type", "application/schema+json; charset=utf-8");
        headers.set("cache-control", "public, max-age=31536000, immutable");
      }
      return new Response(new TextDecoder().decode(bodies.get(path)!), {
        status: path === "/__vydex-hosted-verification-not-found__/" ? 404 : 200,
        headers,
      });
    }) as typeof fetch;
    const logger = {
      filename: "",
      log: vi.fn(async () => {}),
      debug: vi.fn(async () => {}),
      info: vi.fn(async () => {}),
      warning: vi.fn(async () => {}),
      error: vi.fn(async () => {}),
      critical: vi.fn(async () => {}),
    } satisfies ReleaseLogger;

    const verification = await runArchivedHostedVerification({
      filesystem_root: root,
      canonical_origin: "https://vydex.pages.dev",
      request_origin: "https://vydex.pages.dev",
      deployment_id: "archived-deployment",
      release_id: FIRST,
      phase: "archived-contract-test",
      logger,
      fetch: request,
      environment: {},
    });

    expect(verification.report.success).toBe(true);
    expect(verification.report.source_commit).toBe("655b7c8bf4a8b5cbb88bbc9427735084c5f19973");
    expect(verification.report.checks.some(({ name }) => name.startsWith("archived immutable metadata"))).toBe(true);
  });
});
