// Builds and validates the deterministic internal manifest for one verified Stage 1 output.
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { PreparedApplicationExport } from "../../adapters/application-export";
import type { ReleaseMetadata, ReleaseModel, SiteOrigin } from "../../domain";
import type { StageOneReleaseDiagnostic } from "./diagnostics";
import { releaseGateDiagnostic } from "./diagnostics";

export const STAGE_ONE_RELEASE_MANIFEST_PATH = "generated/release-data/release-manifest.json";

const manifestRedirectSchema = z.strictObject({
  source: z.string().startsWith("/"),
  destination: z.string().startsWith("/"),
  status: z.union([z.literal(301), z.literal(302)]),
});
const manifestFileSchema = z.strictObject({
  path: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export const stageOneReleaseManifestSchema = z.strictObject({
  manifest_version: z.literal("1.0.0"),
  release_id: z.uuidv7(),
  generated_at: z.string().min(1),
  site_origin: z.url({ protocol: /^https$/ }),
  entry_count: z.number().int().nonnegative(),
  topic_trail_count: z.number().int().nonnegative(),
  methodology_versions: z.array(z.string()).min(1),
  generated_routes: z.array(z.string().startsWith("/")),
  export_filename: z.string().endsWith(".json"),
  json_schema_url: z.url({ protocol: /^https$/ }),
  redirects: z.array(manifestRedirectSchema),
  files: z.array(manifestFileSchema),
});
export type StageOneReleaseManifest = z.infer<typeof stageOneReleaseManifestSchema>;

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filename = resolve(directory, entry.name);
      return entry.isDirectory() ? listFiles(filename) : entry.isFile() ? [filename] : [];
    }),
  );
  return files.flat();
}

async function inventoryFiles(outputRoot: string): Promise<StageOneReleaseManifest["files"]> {
  const filenames = await listFiles(outputRoot);
  const files = await Promise.all(
    filenames.map(async (filename) => {
      const contents = await readFile(filename);
      return {
        path: relative(outputRoot, filename).split(sep).join("/"),
        bytes: contents.byteLength,
        sha256: createHash("sha256").update(contents).digest("hex"),
      };
    }),
  );
  return files.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

export async function buildStageOneReleaseManifest(input: {
  output_root: string;
  release: ReleaseModel;
  prepared_export: PreparedApplicationExport;
  generated_routes: readonly string[];
}): Promise<StageOneReleaseManifest> {
  const release = input.release;
  const artifact = input.prepared_export.artifact;
  const redirects = [
    ...release.redirects.map(({ source, destination, status }) => ({ source, destination, status })),
    artifact.latest_dataset_redirect,
  ]
    .map(({ source, destination, status }) => ({ source, destination, status }))
    .sort((left, right) => left.source.localeCompare(right.source, "en"));
  const methodologyVersions = [...artifact.dataset.methodology_versions].sort((left, right) =>
    left.localeCompare(right, "en", { numeric: true }),
  );

  return stageOneReleaseManifestSchema.parse({
    manifest_version: "1.0.0",
    release_id: release.release_metadata.release_id,
    generated_at: release.release_metadata.generated_at,
    site_origin: release.site_origin,
    entry_count: release.current_entries.length,
    topic_trail_count: release.topic_trails.length,
    methodology_versions: methodologyVersions,
    generated_routes: [...input.generated_routes].sort((left, right) => left.localeCompare(right, "en")),
    export_filename: input.prepared_export.presentation.download_filename,
    json_schema_url: `${release.site_origin}${artifact.schema_public_path}`,
    redirects,
    files: await inventoryFiles(input.output_root),
  });
}

export function serializeStageOneReleaseManifest(manifest: StageOneReleaseManifest): string {
  return `${JSON.stringify(stageOneReleaseManifestSchema.parse(manifest), null, 2)}\n`;
}

export function parseExistingStageOneReleaseManifest(rawText: string): StageOneReleaseManifest {
  return stageOneReleaseManifestSchema.parse(JSON.parse(rawText));
}

export function validateCommittedStageOneReleaseState(input: {
  descriptor: ReleaseMetadata;
  manifest: StageOneReleaseManifest;
  site_origin: SiteOrigin;
}): StageOneReleaseDiagnostic[] {
  const diagnostics: StageOneReleaseDiagnostic[] = [];
  if (
    input.manifest.release_id !== input.descriptor.release_id ||
    input.manifest.generated_at !== input.descriptor.generated_at
  ) {
    diagnostics.push(
      releaseGateDiagnostic({
        code: "release_state_identity_mismatch",
        field: "release_id/generated_at",
        rule: "The committed release descriptor and manifest must identify the same Stage 1 release.",
        generated_surfaces: ["Release manifest", "Promotable static output"],
      }),
    );
  }
  if (input.manifest.site_origin !== input.site_origin) {
    diagnostics.push(
      releaseGateDiagnostic({
        code: "release_state_origin_mismatch",
        field: "site_origin",
        rule: `PUBLIC_SITE_ORIGIN must exactly match the committed release manifest origin ${input.manifest.site_origin}.`,
        generated_surfaces: ["Canonical URLs", "JSON Schema", "JSON export"],
      }),
    );
  }
  return diagnostics;
}

export function validateReproducedStageOneReleaseManifest(input: {
  committed_manifest: StageOneReleaseManifest;
  reproduced_manifest: StageOneReleaseManifest;
}): StageOneReleaseDiagnostic[] {
  if (isDeepStrictEqual(input.committed_manifest, input.reproduced_manifest)) return [];
  return [
    releaseGateDiagnostic({
      code: "release_manifest_reproduction_mismatch",
      field: STAGE_ONE_RELEASE_MANIFEST_PATH,
      rule: "The clean production build must reproduce the committed Stage 1 release manifest byte-for-byte.",
      generated_surfaces: ["Promotable static output", "Cloudflare Pages deployment"],
    }),
  ];
}

export async function verifyStageOneReleaseInventory(input: {
  output_root: string;
  manifest: StageOneReleaseManifest;
}): Promise<StageOneReleaseDiagnostic[]> {
  let files: StageOneReleaseManifest["files"];
  try {
    files = await inventoryFiles(input.output_root);
  } catch (error) {
    return [
      releaseGateDiagnostic({
        code: "release_artifact_inventory_unreadable",
        field: input.output_root,
        rule: error instanceof Error ? error.message : String(error),
        generated_surfaces: ["Cloudflare Pages deployment"],
      }),
    ];
  }
  if (isDeepStrictEqual(files, input.manifest.files)) return [];

  const expected = new Map(input.manifest.files.map((file) => [file.path, file]));
  const actual = new Map(files.map((file) => [file.path, file]));
  const changedPaths = [...new Set([...expected.keys(), ...actual.keys()])]
    .filter((path) => !isDeepStrictEqual(expected.get(path), actual.get(path)))
    .sort((left, right) => left.localeCompare(right, "en"));
  return [
    releaseGateDiagnostic({
      code: "release_artifact_inventory_mismatch",
      field: changedPaths.join(", ") || "files",
      rule: "The downloaded static artifact must exactly match the committed release manifest inventory.",
      generated_surfaces: ["Cloudflare Pages deployment"],
    }),
  ];
}

export function validateImmutableDatasetAgainstPreviousManifest(input: {
  previous_manifest?: StageOneReleaseManifest;
  next_manifest: StageOneReleaseManifest;
  export_public_path: string;
}): StageOneReleaseDiagnostic[] {
  const previous = input.previous_manifest;
  if (!previous || previous.release_id !== input.next_manifest.release_id) return [];
  const artifactPath = input.export_public_path.replace(/^\/+/, "");
  const previousFile = previous.files.find(({ path }) => path === artifactPath);
  const nextFile = input.next_manifest.files.find(({ path }) => path === artifactPath);
  if (!previousFile || !nextFile || previousFile.sha256 !== nextFile.sha256) {
    return [
      releaseGateDiagnostic({
        code: "immutable_dataset_manifest_collision",
        record: artifactPath,
        field: "files.sha256",
        rule: "The same persisted Stage 1 release ID must never identify different dataset bytes.",
        generated_surfaces: ["JSON export", "Release manifest"],
      }),
    ];
  }
  return [];
}
