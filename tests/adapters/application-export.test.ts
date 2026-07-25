// Verifies deterministic application preparation of the public export and page metadata.
import { beforeAll, describe, expect, test } from "vitest";
import { prepareApplicationExport } from "../../src/adapters/application-export";
import { loadFixedMetadataDevelopmentApplicationRelease } from "../../src/adapters/application-release";
import type { ReleaseModel } from "../../src/domain";

describe("prepareApplicationExport", () => {
  let release: ReleaseModel;

  beforeAll(async () => {
    release = await loadFixedMetadataDevelopmentApplicationRelease({
      filesystem_root: process.cwd(),
      site_origin: "https://vydex.example",
    });
  });

  test("derives the page model from the schema-valid artifact built from seed records", () => {
    const result = prepareApplicationExport(release);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const { artifact, presentation } = result.data;
    expect(presentation).toEqual({
      format: "JSON",
      scope: "Latest Entry Versions",
      entry_count: artifact.dataset.entry_count,
      last_generated: "2026-07-24",
      methodology_versions: artifact.dataset.methodology_versions,
      download_filename: "vydex-latest-entry-versions-v1-0-0-2026-07-24.json",
      download_path:
        "/datasets/releases/01900000-0000-7000-8000-000000000099/vydex-latest-entry-versions-v1-0-0-2026-07-24.json",
      schema_path: "/schemas/vydex-dataset/1.0.0.json",
    });
    expect(presentation.entry_count).toBe(artifact.dataset.entries.length);
    expect(artifact.dataset.generated_at.startsWith(presentation.last_generated)).toBe(true);
  });

  test("returns identical paths and bytes when the same release is prepared again", () => {
    const first = prepareApplicationExport(release);
    const second = prepareApplicationExport(release);

    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.data.artifact.public_path).toBe(first.data.artifact.public_path);
    expect(second.data.artifact.serialized_json).toBe(first.data.artifact.serialized_json);
    expect(second.data.presentation).toEqual(first.data.presentation);
  });

  test("fails closed for invalid metadata, artifact paths, and schema-invalid Entries", () => {
    const invalidMetadata = structuredClone(release) as ReleaseModel;
    delete (invalidMetadata.release_metadata as Partial<ReleaseModel["release_metadata"]>).generated_at;
    const invalidMetadataResult = prepareApplicationExport(invalidMetadata);
    expect(invalidMetadataResult.success).toBe(false);
    if (!invalidMetadataResult.success) {
      expect(invalidMetadataResult.diagnostics.map(({ code }) => code)).toContain(
        "valid_release_metadata_required",
      );
    }

    const invalidPath = structuredClone(release);
    invalidPath.routes.dataset_artifact = "/datasets/releases/wrong.json" as never;
    const invalidPathResult = prepareApplicationExport(invalidPath);
    expect(invalidPathResult.success).toBe(false);
    if (!invalidPathResult.success) {
      expect(invalidPathResult.diagnostics.map(({ code }) => code)).toContain(
        "dataset_artifact_path_mismatch",
      );
    }

    const invalidEntry = structuredClone(release);
    invalidEntry.current_entries[0]!.entry.title = "";
    const invalidEntryResult = prepareApplicationExport(invalidEntry);
    expect(invalidEntryResult.success).toBe(false);
    if (!invalidEntryResult.success) {
      expect(invalidEntryResult.diagnostics.map(({ code }) => code)).toContain(
        "dataset_schema_validation_failed",
      );
    }
  });
});
