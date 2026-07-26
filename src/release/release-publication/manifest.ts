// Builds the v2 internal manifest for one complete active release output.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { relative, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { PreparedApplicationExport } from "../../adapters/application-export";
import {
  gitCommitSchema,
  rfc3339UtcTimestampSchema,
  uuidV7Schema,
  type ReleaseModel,
} from "../../domain";
import { listStaticOutputFiles } from "../stage-one-release/static-output-routes";

export const RELEASE_DESCRIPTOR_PATH = "generated/release-data/release.json";
export const RELEASE_MANIFEST_PATH = "generated/release-data/release-manifest.json";
export const RELEASE_HISTORY_PATH = "generated/release-data/release-history.json";
export const RELEASE_ARCHIVE_ROOT = "generated/release-data/releases";

const redirectSchema = z.strictObject({
  source: z.string().startsWith("/"),
  destination: z.string().startsWith("/"),
  status: z.union([z.literal(301), z.literal(302)]),
});
const fileSchema = z.strictObject({
  path: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export const releaseManifestSchema = z
  .strictObject({
    manifest_version: z.literal("2.0.0"),
    release_id: uuidV7Schema,
    generated_at: rfc3339UtcTimestampSchema,
    source_commit: gitCommitSchema,
    previous_release_id: uuidV7Schema.nullable(),
    retained_release_ids: z.array(uuidV7Schema),
    site_origin: z.url({ protocol: /^https$/ }),
    entry_count: z.number().int().nonnegative(),
    topic_trail_count: z.number().int().nonnegative(),
    methodology_versions: z.array(z.string()).min(1),
    generated_routes: z.array(z.string().startsWith("/")),
    current_release_routes: z.array(z.string().startsWith("/")),
    retained_immutable_routes: z.array(z.string().startsWith("/")),
    export_filename: z.string().endsWith(".json"),
    json_schema_url: z.url({ protocol: /^https$/ }),
    redirects: z.array(redirectSchema),
    files: z.array(fileSchema),
  })
  .superRefine((manifest, context) => {
    for (const key of ["generated_routes", "current_release_routes", "retained_immutable_routes"] as const) {
      const values = manifest[key];
      if (JSON.stringify(values) !== JSON.stringify(sortedUnique(values))) {
        context.addIssue({ code: "custom", path: [key], message: `${key} must be sorted and deduplicated.` });
      }
    }
    const expectedGenerated = sortedUnique([...manifest.current_release_routes, ...manifest.retained_immutable_routes]);
    if (JSON.stringify(manifest.generated_routes) !== JSON.stringify(expectedGenerated)) {
      context.addIssue({ code: "custom", path: ["generated_routes"], message: "generated_routes must be the complete current and retained route union." });
    }
    const filePaths = manifest.files.map(({ path }) => path);
    if (new Set(filePaths).size !== filePaths.length || JSON.stringify(filePaths) !== JSON.stringify([...filePaths].sort((a, b) => a.localeCompare(b, "en")))) {
      context.addIssue({ code: "custom", path: ["files"], message: "Manifest files must be path-sorted and unique." });
    }
  });
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;

export async function inventoryReleaseFiles(outputRoot: string): Promise<ReleaseManifest["files"]> {
  const filenames = await listStaticOutputFiles(outputRoot);
  const files = await Promise.all(filenames.map(async (filename) => {
    const contents = await readFile(filename);
    return {
      path: relative(outputRoot, filename).split(sep).join("/"),
      bytes: contents.byteLength,
      sha256: createHash("sha256").update(contents).digest("hex"),
    };
  }));
  return files.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "en"));
}

export async function buildReleaseManifest(input: {
  output_root: string;
  release: ReleaseModel;
  prepared_export: PreparedApplicationExport;
  source_commit: string;
  previous_release_id: string | null;
  retained_release_ids: readonly string[];
  current_release_routes: readonly string[];
  retained_immutable_routes: readonly string[];
}): Promise<ReleaseManifest> {
  const artifact = input.prepared_export.artifact;
  const redirects = [
    ...input.release.redirects.map(({ source, destination, status }) => ({ source, destination, status })),
    {
      source: artifact.latest_dataset_redirect.source,
      destination: artifact.latest_dataset_redirect.destination,
      status: artifact.latest_dataset_redirect.status,
    },
  ].sort((left, right) => left.source.localeCompare(right.source, "en"));
  return releaseManifestSchema.parse({
    manifest_version: "2.0.0",
    release_id: input.release.release_metadata.release_id,
    generated_at: input.release.release_metadata.generated_at,
    source_commit: input.source_commit,
    previous_release_id: input.previous_release_id,
    retained_release_ids: input.retained_release_ids,
    site_origin: input.release.site_origin,
    entry_count: input.release.current_entries.length,
    topic_trail_count: input.release.topic_trails.length,
    methodology_versions: [...artifact.dataset.methodology_versions].sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
    generated_routes: sortedUnique([...input.current_release_routes, ...input.retained_immutable_routes]),
    current_release_routes: sortedUnique(input.current_release_routes),
    retained_immutable_routes: sortedUnique(input.retained_immutable_routes),
    export_filename: input.prepared_export.presentation.download_filename,
    json_schema_url: `${input.release.site_origin}${artifact.schema_public_path}`,
    redirects,
    files: await inventoryReleaseFiles(input.output_root),
  });
}

export function parseReleaseManifest(rawText: string): ReleaseManifest {
  return releaseManifestSchema.parse(JSON.parse(rawText));
}

export function serializeReleaseManifest(manifest: ReleaseManifest): string {
  return `${JSON.stringify(releaseManifestSchema.parse(manifest), null, 2)}\n`;
}

export function releaseManifestsEqual(left: ReleaseManifest, right: ReleaseManifest): boolean {
  return isDeepStrictEqual(left, right);
}
