// Verifies the exact, deterministic, and Schema-valid Dataset 1.0.0 projection.
import { describe, expect, test, vi } from "vitest";
import {
  generateVyDexDatasetSchemaV1,
  generateVyDexDatasetV1,
  type ReleaseModel,
} from "../../src/domain";
import { constructReleaseModel } from "../../src/domain/release-construction";
import { IDS, createLoadedCanonicalRecords } from "./fixtures";
import { DATASET_FIXTURE_IDS, createDatasetFixtureRelease } from "./dataset-fixtures";

function generateFixtureDataset() {
  const result = generateVyDexDatasetV1({ release: createDatasetFixtureRelease() });
  if (!result.success) {
    throw new Error(JSON.stringify(result.diagnostics, null, 2));
  }
  return result;
}

describe("Dataset 1.0.0 Schema", () => {
  test("uses an absolute release-origin identity and documents nullable meanings", () => {
    const result = generateVyDexDatasetSchemaV1({ site_origin: "https://vydex.example" });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.schema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://vydex.example/schemas/vydex-dataset/1.0.0.json",
    });
    const definitions = result.data.schema.$defs as Record<string, Record<string, unknown>>;
    const dateProperties = (definitions.dates!.properties as Record<string, { description?: string }>);
    const entryProperties = (definitions.entry!.properties as Record<string, { description?: string }>);
    expect(dateProperties.date_happened?.description).toContain("null means unknown");
    expect(dateProperties.date_disclosed?.description).toContain("null means unknown");
    expect(dateProperties.next_check_date?.description).toContain("no check is scheduled");
    expect(entryProperties.potential_significance_if_confirmed?.description).toContain(
      "null means not applicable",
    );
    expect(result.data.serialized_json.endsWith("\n")).toBe(true);
    expect(result.data.serialized_json.endsWith("\n\n")).toBe(false);
  });

  test("rejects missing, non-HTTPS, and non-origin Schema identities", () => {
    for (const siteOrigin of [undefined, "http://vydex.example", "https://vydex.example/path"]) {
      expect(generateVyDexDatasetSchemaV1({ site_origin: siteOrigin }).success).toBe(false);
    }
  });
});

describe("generateVyDexDatasetV1", () => {
  test("projects the exact public contract from current published Entry snapshots", () => {
    const result = generateFixtureDataset();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const { dataset } = result.data;
    expect(dataset.$schema).toBe("https://vydex.example/schemas/vydex-dataset/1.0.0.json");
    expect(dataset).toMatchObject({
      dataset_name: "VyDex",
      dataset_schema_version: "1.0.0",
      release_id: IDS.release,
      generated_at: "2026-07-21T20:30:00.123Z",
      scope: "latest_entry_versions",
      entry_count: 2,
      methodology_versions: ["1.0.0"],
    });
    expect(dataset.entries.map(({ slug }) => slug)).toEqual([
      "alpha-frontier-result",
      "verified-frontier-result",
    ]);

    const entry = dataset.entries[1]!;
    expect(Object.keys(entry)).toEqual([
      "id",
      "slug",
      "canonical_url",
      "revision_id",
      "revision_number",
      "revision_published_at",
      "latest_update_summary",
      "title",
      "claim",
      "claim_status",
      "evidence_strength",
      "evidence_strength_score",
      "review_status",
      "review_reason",
      "entry_state",
      "domains",
      "primary_topic_trail",
      "secondary_topic_trails",
      "methodology",
      "dates",
      "frontier_delta",
      "details",
      "confirmed_significance",
      "potential_significance_if_confirmed",
      "caveats",
      "evidence_types",
      "sources",
    ]);
    expect(entry).toMatchObject({
      id: IDS.entry,
      title: "Published multi-source frontier result",
      revision_id: DATASET_FIXTURE_IDS.firstEntryRevisionTwo,
      revision_number: 2,
      revision_published_at: "2026-07-22T20:15:30Z",
      latest_update_summary: "Strengthened the evidence assessment with additional sources.",
      evidence_strength_score: 4,
      entry_state: "main_entry",
      domains: ["ai_capabilities", "biology", "space"],
      methodology: {
        id: IDS.methodology,
        version: "1.0.0",
        canonical_url: "https://vydex.example/methodology/1.0.0/",
      },
      dates: {
        date_added: "2026-07-21",
        date_updated: "2026-07-22",
      },
    });
    expect(entry).not.toHaveProperty("aliases");
    expect(entry).not.toHaveProperty("current_revision_id");
    expect(entry).not.toHaveProperty("latest_meaningful_activity");
    expect(entry.methodology).not.toHaveProperty("title");
    expect(entry.methodology).not.toHaveProperty("public_version");
    expect(entry.secondary_topic_trails.map(({ slug }) => slug)).toEqual([
      "ai-capability-thresholds",
      "frontier-artifacts",
    ]);
    expect(dataset.entries.every(({ entry_state }) => entry_state === "main_entry")).toBe(true);
    expect(dataset.entries.some(({ title }) => title.includes("Unpublished editable"))).toBe(false);
    expect(dataset.entry_count).toBe(dataset.entries.length);
  });

  test("derives and orders Sources, Source Role labels, and Evidence Types", () => {
    const result = generateFixtureDataset();
    expect(result.success).toBe(true);
    if (!result.success) return;
    const entry = result.data.dataset.entries.find(({ id }) => id === IDS.entry)!;

    expect(entry.sources.map(({ citation_id }) => citation_id)).toEqual([
      "primary-alpha",
      "primary-zulu",
      "replication-record",
      "official-record",
      "artifact-record",
      "context-alpha",
      "media-beta",
    ]);
    expect(entry.sources.map(({ source_role_label }) => source_role_label)).toEqual([
      "Primary Evidence",
      "Primary Evidence",
      "Independent Replication",
      "Official Record",
      "Strong Artifact",
      "Context Source",
      "Media Report",
    ]);
    expect(entry.sources[1]?.evidence_types).toEqual(["preprint", "technical_artifact"]);
    expect(entry.evidence_types).toEqual([
      "preprint",
      "peer_reviewed_paper",
      "independent_replication",
      "official_claim",
      "benchmark_result",
      "technical_artifact",
      "government_report",
      "court_filing",
      "audit",
      "media_report",
    ]);
  });

  test("returns immutable and stable-latest artifact descriptors without writing files", () => {
    const result = generateFixtureDataset();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const immutablePath =
      `/datasets/releases/${IDS.release}/vydex-latest-entry-versions-v1-0-0.json`;
    expect(result.data.public_path).toBe(immutablePath);
    expect(result.data.schema_public_path).toBe("/schemas/vydex-dataset/1.0.0.json");
    expect(result.data.latest_dataset_redirect).toEqual({
      source: "/datasets/vydex-latest-entry-versions-v1-0-0.json",
      destination: immutablePath,
      status: 302,
      kind: "latest_dataset",
    });
    expect(result.data.serialized_json.endsWith("\n")).toBe(true);
    expect(result.data.serialized_json.endsWith("\n\n")).toBe(false);
  });

  test("produces byte-identical Schema and dataset output for identical releases", () => {
    const firstDataset = generateFixtureDataset();
    const secondDataset = generateFixtureDataset();
    const firstSchema = generateVyDexDatasetSchemaV1({ site_origin: "https://vydex.example" });
    const secondSchema = generateVyDexDatasetSchemaV1({ site_origin: "https://vydex.example" });
    expect(firstDataset.success && secondDataset.success).toBe(true);
    expect(firstSchema.success && secondSchema.success).toBe(true);
    if (!firstDataset.success || !secondDataset.success || !firstSchema.success || !secondSchema.success) {
      return;
    }
    expect(secondDataset.data.serialized_json).toBe(firstDataset.data.serialized_json);
    expect(secondSchema.data.serialized_json).toBe(firstSchema.data.serialized_json);
    expect(firstDataset.data.dataset.$schema).toBe(firstSchema.data.schema.$id);
  });

  test("rejects preview, incomplete, removed, route-mismatched, and Schema-invalid inputs", () => {
    const preview = constructReleaseModel({
      records: createLoadedCanonicalRecords(),
      site_origin: "http://localhost:4321",
      mode: "preview",
    });
    expect(preview.mode).toBe("preview");
    if (preview.mode !== "preview") return;
    const previewResult = generateVyDexDatasetV1({ release: preview.preview as unknown as ReleaseModel });
    expect(previewResult.success).toBe(false);
    if (!previewResult.success) {
      expect(previewResult.diagnostics.map(({ code }) => code)).toContain(
        "validated_production_release_required",
      );
    }

    const missingMetadata = structuredClone(createDatasetFixtureRelease()) as Partial<ReleaseModel>;
    delete missingMetadata.release_metadata;
    expect(
      generateVyDexDatasetV1({ release: missingMetadata as ReleaseModel }).success,
    ).toBe(false);

    const removed = structuredClone(createDatasetFixtureRelease());
    removed.current_entries[0]!.entry.entry_state = "removed";
    const removedResult = generateVyDexDatasetV1({ release: removed });
    expect(removedResult.success).toBe(false);
    if (!removedResult.success) {
      expect(removedResult.diagnostics.map(({ code }) => code)).toContain("non_public_entry_in_dataset");
    }

    const wrongPath = structuredClone(createDatasetFixtureRelease());
    wrongPath.routes.dataset_artifact = "/datasets/releases/wrong.json" as never;
    expect(generateVyDexDatasetV1({ release: wrongPath }).success).toBe(false);

    const wrongUrl = structuredClone(createDatasetFixtureRelease());
    wrongUrl.current_entries[0]!.canonical_url = "https://vydex.example/entries/wrong/" as never;
    expect(generateVyDexDatasetV1({ release: wrongUrl }).success).toBe(false);

    const invalidPublicField = structuredClone(createDatasetFixtureRelease());
    invalidPublicField.current_entries[0]!.entry.title = "";
    const schemaInvalidResult = generateVyDexDatasetV1({ release: invalidPublicField });
    expect(schemaInvalidResult.success).toBe(false);
    if (!schemaInvalidResult.success) {
      expect(schemaInvalidResult.diagnostics.map(({ code }) => code)).toContain(
        "dataset_schema_validation_failed",
      );
    }
  });

  test("does not generate time, IDs, or console output", () => {
    const dateNow = vi.spyOn(Date, "now");
    const randomUuid = vi.spyOn(globalThis.crypto, "randomUUID");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = generateFixtureDataset();

    expect(result.success).toBe(true);
    expect(dateNow).not.toHaveBeenCalled();
    expect(randomUuid).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    dateNow.mockRestore();
    randomUuid.mockRestore();
    info.mockRestore();
    error.mockRestore();
  });
});
