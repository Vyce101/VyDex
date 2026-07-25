// Verifies deterministic Stage 1 manifests, redirects, diagnostics, and immutable export guards.
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { prepareApplicationExport } from "../../src/adapters/application-export";
import {
  buildStageOneReleaseManifest,
  collectStageOneRedirects,
  expectedStageOneGeneratedRoutes,
  formatReleaseDiagnostics,
  serializeStageOneRedirects,
  serializeStageOneReleaseManifest,
  validateCommittedStageOneReleaseState,
  validateImmutableDatasetAgainstPreviousManifest,
  validateReproducedStageOneReleaseManifest,
  verifyStageOneReleaseInventory,
} from "../../src/release/stage-one-release";
import { createDatasetFixtureRelease } from "../domain/dataset-fixtures";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createManifestFixture() {
  const root = await mkdtemp(join(tmpdir(), "vydex-release-manifest-"));
  roots.push(root);
  const release = createDatasetFixtureRelease();
  const preparedResult = prepareApplicationExport(release);
  if (!preparedResult.success) throw new Error("Expected the application export fixture to succeed.");
  const artifactPath = preparedResult.data.artifact.public_path.replace(/^\/+/, "");
  await mkdir(resolve(root, "_astro"), { recursive: true });
  await mkdir(resolve(root, artifactPath, ".."), { recursive: true });
  await writeFile(resolve(root, "index.html"), "<html>verified</html>", "utf8");
  await writeFile(resolve(root, "_astro/app.css"), "body{}", "utf8");
  await writeFile(resolve(root, artifactPath), preparedResult.data.artifact.serialized_json, "utf8");
  await writeFile(
    resolve(root, "_redirects"),
    serializeStageOneRedirects(collectStageOneRedirects(release, preparedResult.data)),
    "utf8",
  );
  const manifest = await buildStageOneReleaseManifest({
    output_root: root,
    release,
    prepared_export: preparedResult.data,
    generated_routes: expectedStageOneGeneratedRoutes(release),
  });
  return { root, release, prepared: preparedResult.data, manifest, artifactPath };
}

describe("Stage 1 release manifest", () => {
  test("describes exact output with sorted routes, redirects, and file hashes", async () => {
    const fixture = await createManifestFixture();
    const serialized = serializeStageOneReleaseManifest(fixture.manifest);

    expect(fixture.manifest.release_id).toBe(fixture.release.release_metadata.release_id);
    expect(fixture.manifest.generated_routes).toEqual(
      [...fixture.manifest.generated_routes].sort((left, right) => left.localeCompare(right, "en")),
    );
    expect(fixture.manifest.redirects.map(({ status }) => status)).toContain(302);
    expect(fixture.manifest.files.map(({ path }) => path)).toEqual(
      [...fixture.manifest.files.map(({ path }) => path)].sort((left, right) => left.localeCompare(right, "en")),
    );
    expect(fixture.manifest.files.find(({ path }) => path === fixture.artifactPath)?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(serialized.endsWith("\n")).toBe(true);
  });

  test("blocks different immutable dataset bytes for the persisted release ID", async () => {
    const fixture = await createManifestFixture();
    const nextManifest = structuredClone(fixture.manifest);
    const nextArtifact = nextManifest.files.find(({ path }) => path === fixture.artifactPath)!;
    nextArtifact.sha256 = "0".repeat(64);

    const diagnostics = validateImmutableDatasetAgainstPreviousManifest({
      previous_manifest: fixture.manifest,
      next_manifest: nextManifest,
      export_public_path: fixture.prepared.artifact.public_path,
    });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: "immutable_dataset_manifest_collision" }),
    );
    expect(formatReleaseDiagnostics(diagnostics)).toContain("Generated surfaces affected: JSON export, Release manifest");
  });

  test("emits direct sorted Cloudflare aliases plus the stable export redirect", async () => {
    const fixture = await createManifestFixture();
    const redirects = collectStageOneRedirects(fixture.release, fixture.prepared);
    const serialized = serializeStageOneRedirects(redirects);

    expect(redirects).toEqual(
      [...redirects].sort((left, right) => left.source.localeCompare(right.source, "en")),
    );
    expect(serialized).toContain("/datasets/vydex-latest-entry-versions-v1-0-0.json");
    expect(serialized).toContain(" 302\n");
  });

  test("requires committed release identity and origin to agree", async () => {
    const fixture = await createManifestFixture();
    expect(
      validateCommittedStageOneReleaseState({
        descriptor: fixture.release.release_metadata,
        manifest: fixture.manifest,
        site_origin: fixture.release.site_origin,
      }),
    ).toEqual([]);

    const wrongIdentity = structuredClone(fixture.manifest);
    wrongIdentity.generated_at = "2030-01-01T00:00:00.000Z";
    const wrongOrigin = structuredClone(fixture.manifest);
    wrongOrigin.site_origin = "https://different.pages.dev";
    expect(
      validateCommittedStageOneReleaseState({
        descriptor: fixture.release.release_metadata,
        manifest: wrongIdentity,
        site_origin: fixture.release.site_origin,
      }).map(({ code }) => code),
    ).toContain("release_state_identity_mismatch");
    expect(
      validateCommittedStageOneReleaseState({
        descriptor: fixture.release.release_metadata,
        manifest: wrongOrigin,
        site_origin: fixture.release.site_origin,
      }).map(({ code }) => code),
    ).toContain("release_state_origin_mismatch");
  });

  test("detects regenerated manifest and downloaded artifact drift", async () => {
    const fixture = await createManifestFixture();
    expect(
      validateReproducedStageOneReleaseManifest({
        committed_manifest: fixture.manifest,
        reproduced_manifest: structuredClone(fixture.manifest),
      }),
    ).toEqual([]);
    expect(await verifyStageOneReleaseInventory({ output_root: fixture.root, manifest: fixture.manifest })).toEqual([]);

    await writeFile(resolve(fixture.root, "_astro/app.css"), "body{color:red}", "utf8");
    expect(
      validateReproducedStageOneReleaseManifest({
        committed_manifest: fixture.manifest,
        reproduced_manifest: { ...fixture.manifest, entry_count: fixture.manifest.entry_count + 1 },
      }).map(({ code }) => code),
    ).toContain("release_manifest_reproduction_mismatch");
    expect(
      (await verifyStageOneReleaseInventory({ output_root: fixture.root, manifest: fixture.manifest })).map(
        ({ code }) => code,
      ),
    ).toContain("release_artifact_inventory_mismatch");
  });
});
