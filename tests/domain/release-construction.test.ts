// Verifies strict release construction, diagnostic previews, routes, activity, changelog, and exports.
import { describe, expect, test, vi } from "vitest";
import { constructReleaseModel } from "../../src/domain/release-construction";
import { validateSiteOrigin } from "../../src/domain/route-generation";
import {
  IDS,
  createLoadedCanonicalRecords,
  createValidReleaseMetadata,
  createValidSnapshot,
} from "./fixtures";

const SECOND_REVISION_ID = "01900000-0000-7000-8000-000000000010";

function constructProduction(records = createLoadedCanonicalRecords()) {
  return constructReleaseModel({
    records,
    release_metadata: createValidReleaseMetadata(),
    site_origin: "https://vydex.example",
    mode: "production",
  });
}

function addSecondSnapshot(
  records: ReturnType<typeof createLoadedCanonicalRecords>,
  mutate: (snapshot: ReturnType<typeof createValidSnapshot>) => void,
) {
  const snapshot = createValidSnapshot();
  snapshot.revision_id = SECOND_REVISION_ID;
  snapshot.revision_number = 2;
  snapshot.published_at = "2026-07-22T12:00:00Z";
  snapshot.revision_category = "non_material_correction";
  snapshot.materiality = "non_material";
  snapshot.update_summary = "Corrected public wording without changing the assessment.";
  mutate(snapshot);
  records.entry_publication_snapshots.push({
    record_type: "entry_publication_snapshot",
    filename: `data/publication-snapshots/entries/${IDS.entry}/2-${SECOND_REVISION_ID}.json`,
    raw_text: JSON.stringify(snapshot),
    value: snapshot,
  });
  return snapshot;
}

describe("site origin validation", () => {
  test("accepts root-only HTTPS production origins and normalizes the trailing slash", () => {
    const result = validateSiteOrigin("https://vydex.example/", "production");
    expect(result).toEqual({ success: true, data: "https://vydex.example", diagnostics: [] });
  });

  test.each([
    "vydex.example",
    "http://vydex.example",
    "https://vydex.example/subdirectory",
    "https://vydex.example?preview=true",
    "https://vydex.example?",
    "https://vydex.example/.",
  ])("rejects invalid production origin %s", (origin) => {
    expect(validateSiteOrigin(origin, "production").success).toBe(false);
  });

  test("permits HTTP localhost only in preview", () => {
    expect(validateSiteOrigin("http://localhost:4321", "preview").success).toBe(true);
    expect(validateSiteOrigin("http://preview.example", "preview").success).toBe(false);
  });
});

describe("constructReleaseModel production", () => {
  test("returns one complete internally consistent release", () => {
    const result = constructProduction();
    expect(result.success).toBe(true);
    if (!result.success || result.mode !== "production") return;

    expect(result.release.site_origin).toBe("https://vydex.example");
    expect(result.release.current_entries).toHaveLength(1);
    expect(result.release.current_entries[0]?.canonical_url).toBe(
      "https://vydex.example/entries/verified-frontier-result/",
    );
    expect(result.release.topic_trails.map(({ entry_count }) => entry_count)).toEqual([1, 1]);
    expect(result.release.about.related_links).toMatchObject({
      methodology: { url: "https://vydex.example/methodology/" },
      changelog: { url: "https://vydex.example/changelog/" },
      export_json: { url: "https://vydex.example/export/" },
    });
    expect(result.release.redirects).toContainEqual(
      expect.objectContaining({
        source: "/entries/earlier-frontier-result/",
        destination: "/entries/verified-frontier-result/",
        status: 301,
      }),
    );
    expect(result.release.export.artifact_path).toBe(
      `/datasets/releases/${IDS.release}/vydex-latest-entry-versions-v1-0-0.json`,
    );
    expect(result.release.export.dataset.entry_count).toBe(result.release.export.entries.length);
    expect(Object.isFrozen(result.release)).toBe(true);
  });

  test("uses the newest snapshot while allowing unpublished canonical Entry differences", () => {
    const records = createLoadedCanonicalRecords();
    const canonicalEntry = records.entries[0]!.value as { title: string; slug: string };
    canonicalEntry.title = "Unpublished authoring title";
    canonicalEntry.slug = "unpublished-authoring-slug";

    const result = constructProduction(records);
    expect(result.success).toBe(true);
    if (!result.success || result.mode !== "production") return;
    expect(result.release.current_entries[0]?.entry.title).toBe("Verified frontier result");
    expect(result.release.routes.entries[IDS.entry]).toBe("/entries/verified-frontier-result/");
  });

  test("blocks missing metadata, invalid origins, incomplete singleton content, and removed states", () => {
    const missingMetadata = constructReleaseModel({
      records: createLoadedCanonicalRecords(),
      site_origin: "https://vydex.example",
      mode: "production",
    });
    expect(missingMetadata.success).toBe(false);
    if (!missingMetadata.success && missingMetadata.mode === "production") {
      expect(missingMetadata.diagnostics.map(({ code }) => code)).toContain("release_metadata_required");
    }

    const invalidOrigin = constructReleaseModel({
      records: createLoadedCanonicalRecords(),
      release_metadata: createValidReleaseMetadata(),
      site_origin: "http://vydex.example",
      mode: "production",
    });
    expect(invalidOrigin.success).toBe(false);
    if (!invalidOrigin.success && invalidOrigin.mode === "production") {
      expect(invalidOrigin.diagnostics.map(({ code }) => code)).toContain("invalid_site_origin");
    }

    const incompleteAbout = createLoadedCanonicalRecords();
    delete (incompleteAbout.about[0]!.value as Partial<{ header_lead: string }>).header_lead;
    const incompleteAboutResult = constructProduction(incompleteAbout);
    expect(incompleteAboutResult.success).toBe(false);

    const missingEvent = createLoadedCanonicalRecords();
    missingEvent.methodology_publication_events = [];
    const missingEventResult = constructProduction(missingEvent);
    expect(missingEventResult.success).toBe(false);
    if (!missingEventResult.success && missingEventResult.mode === "production") {
      expect(missingEventResult.diagnostics.map(({ code }) => code)).toContain(
        "methodology_publication_event_required",
      );
    }

    const removedCanonical = createLoadedCanonicalRecords();
    (removedCanonical.entries[0]!.value as { entry_state: string }).entry_state = "removed";
    const removedCanonicalResult = constructProduction(removedCanonical);
    expect(removedCanonicalResult.success).toBe(false);
    if (!removedCanonicalResult.success && removedCanonicalResult.mode === "production") {
      expect(removedCanonicalResult.diagnostics.map(({ code }) => code)).toContain("removed_entry_not_public");
    }

    const removedSnapshot = createLoadedCanonicalRecords();
    const snapshot = removedSnapshot.entry_publication_snapshots[0]!.value as ReturnType<
      typeof createValidSnapshot
    >;
    snapshot.entry.entry_state = "removed";
    const removedSnapshotResult = constructProduction(removedSnapshot);
    expect(removedSnapshotResult.success).toBe(false);
    if (!removedSnapshotResult.success && removedSnapshotResult.mode === "production") {
      expect(removedSnapshotResult.diagnostics.map(({ code }) => code)).toContain(
        "selected_removed_entry_not_public",
      );
    }
  });

  test("blocks broken snapshot relationships and non-1.0.0 Methodology references", () => {
    const brokenRelationship = createLoadedCanonicalRecords();
    const brokenSnapshot = brokenRelationship.entry_publication_snapshots[0]!.value as ReturnType<
      typeof createValidSnapshot
    >;
    brokenSnapshot.entry.primary_topic_trail_id = "01900000-0000-7000-8000-000000000099";
    const relationshipResult = constructProduction(brokenRelationship);
    expect(relationshipResult.success).toBe(false);
    if (!relationshipResult.success && relationshipResult.mode === "production") {
      expect(relationshipResult.diagnostics.map(({ code }) => code)).toContain("unresolved_topic_trail");
    }

    const wrongMethodology = createLoadedCanonicalRecords();
    const wrongSnapshot = wrongMethodology.entry_publication_snapshots[0]!.value as ReturnType<
      typeof createValidSnapshot
    >;
    wrongSnapshot.methodology_public_version = "2.0.0";
    const methodologyResult = constructProduction(wrongMethodology);
    expect(methodologyResult.success).toBe(false);
    if (!methodologyResult.success && methodologyResult.mode === "production") {
      expect(methodologyResult.diagnostics.map(({ code }) => code)).toContain(
        "stage_1_methodology_reference_required",
      );
    }
  });

  test("keeps non-material revisions current without changing material dates or changelog", () => {
    const records = createLoadedCanonicalRecords();
    addSecondSnapshot(records, (snapshot) => {
      snapshot.entry.title = "Verified frontier result corrected";
    });

    const result = constructProduction(records);
    expect(result.success).toBe(true);
    if (!result.success || result.mode !== "production") return;
    const entry = result.release.current_entries[0]!;
    expect(entry.snapshot.revision_number).toBe(2);
    expect(entry.activity.date_updated).toBe("2026-07-21");
    expect(entry.activity.latest_meaningful_activity.revision_number).toBe(1);
    expect(result.release.changelog_events.filter(({ type }) => type !== "methodology_change")).toHaveLength(1);
  });

  test("retains every historical slug as a direct permanent redirect", () => {
    const records = createLoadedCanonicalRecords();
    addSecondSnapshot(records, (snapshot) => {
      snapshot.entry.slug = "renamed-frontier-result";
      snapshot.entry.aliases = ["verified-frontier-result", "earlier-frontier-result"];
      snapshot.entry.evidence_strength = "very_strong";
      snapshot.revision_category = "material_update";
      snapshot.materiality = "material";
      snapshot.update_summary = "Strengthened the assessment and published the new canonical slug.";
    });

    const result = constructProduction(records);
    expect(result.success).toBe(true);
    if (!result.success || result.mode !== "production") return;
    expect(result.release.routes.entries[IDS.entry]).toBe("/entries/renamed-frontier-result/");
    expect(result.release.redirects).toContainEqual(
      expect.objectContaining({
        source: "/entries/verified-frontier-result/",
        destination: "/entries/renamed-frontier-result/",
      }),
    );
  });

  test("rejects a history that drops a previously published slug", () => {
    const records = createLoadedCanonicalRecords();
    addSecondSnapshot(records, (snapshot) => {
      snapshot.entry.slug = "renamed-frontier-result";
      snapshot.entry.aliases = ["earlier-frontier-result"];
      snapshot.entry.evidence_strength = "very_strong";
      snapshot.revision_category = "material_update";
      snapshot.materiality = "material";
    });

    const result = constructProduction(records);
    expect(result.success).toBe(false);
    if (result.success || result.mode !== "production") return;
    expect(result.diagnostics.map(({ code }) => code)).toContain("historical_slug_alias_missing");
  });

  test("rejects missing histories, orphan histories, and empty public trails", () => {
    const missing = createLoadedCanonicalRecords();
    missing.entry_publication_snapshots = [];
    const missingResult = constructProduction(missing);
    expect(missingResult.success).toBe(false);
    if (!missingResult.success && missingResult.mode === "production") {
      expect(missingResult.diagnostics.map(({ code }) => code)).toContain("entry_publication_history_required");
    }

    const orphan = createLoadedCanonicalRecords();
    orphan.entries = [];
    const orphanResult = constructProduction(orphan);
    expect(orphanResult.success).toBe(false);
    if (!orphanResult.success && orphanResult.mode === "production") {
      expect(orphanResult.diagnostics.map(({ code }) => code)).toContain("orphan_entry_snapshot_history");
    }

    const emptyTrail = createLoadedCanonicalRecords();
    const snapshot = emptyTrail.entry_publication_snapshots[0]!.value as ReturnType<typeof createValidSnapshot>;
    snapshot.entry.secondary_topic_trail_ids = [];
    const emptyTrailResult = constructProduction(emptyTrail);
    expect(emptyTrailResult.success).toBe(false);
    if (!emptyTrailResult.success && emptyTrailResult.mode === "production") {
      expect(emptyTrailResult.diagnostics.map(({ code }) => code)).toContain("empty_public_topic_trail");
    }
  });

  test("uses the accepted date-only Methodology changelog tie-breaker", () => {
    const records = createLoadedCanonicalRecords();
    const methodology = records.methodologies[0]!.value as { effective_date: string };
    const event = records.methodology_publication_events[0]!.value as { date: string };
    methodology.effective_date = "2026-07-21";
    event.date = "2026-07-21";

    const result = constructProduction(records);
    expect(result.success).toBe(true);
    if (!result.success || result.mode !== "production") return;
    expect(result.release.changelog_events.map(({ type }) => type)).toEqual(["methodology_change", "added"]);
  });

  test("builds the accepted export projection without unrelated top-level collections", () => {
    const result = constructProduction();
    expect(result.success).toBe(true);
    if (!result.success || result.mode !== "production") return;
    const dataset = result.release.export.dataset;
    const entry = dataset.entries[0]!;
    expect(dataset).toMatchObject({
      dataset_name: "VyDex",
      dataset_schema_version: "1.0.0",
      release_id: IDS.release,
      scope: "latest_entry_versions",
      methodology_versions: ["1.0.0"],
    });
    expect(entry).toMatchObject({
      id: IDS.entry,
      evidence_strength_score: 3,
      evidence_types: ["peer_reviewed_paper", "technical_artifact"],
      primary_topic_trail: { id: IDS.topicTrail },
      methodology: {
        id: IDS.methodology,
        canonical_url: "https://vydex.example/methodology/1.0.0/",
      },
    });
    expect(entry.sources.map(({ citation_id }) => citation_id)).toEqual(["evaluation-paper"]);
    expect(dataset).not.toHaveProperty("topic_trails");
    expect(dataset).not.toHaveProperty("about");
    expect(dataset).not.toHaveProperty("changelog_events");
  });

  test("is deterministic and has no logging side effects", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const first = constructProduction(structuredClone(createLoadedCanonicalRecords()));
    const second = constructProduction(structuredClone(createLoadedCanonicalRecords()));
    expect(second).toEqual(first);
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    info.mockRestore();
    error.mockRestore();
  });
});

describe("constructReleaseModel preview", () => {
  test("keeps trustworthy resolved data but withholds release-specific export paths without metadata", () => {
    const result = constructReleaseModel({
      records: createLoadedCanonicalRecords(),
      site_origin: "http://localhost:4321",
      mode: "preview",
    });
    expect(result.mode).toBe("preview");
    if (result.mode !== "preview") return;
    expect(result.preview.promotable).toBe(false);
    expect(result.preview.resolved.current_entries).toHaveLength(1);
    expect(result.preview.resolved.export_entries).toHaveLength(1);
    expect(result.preview.resolved.export_artifact_path).toBeUndefined();
    expect(result.preview.diagnostics.map(({ code }) => code)).toContain("release_metadata_required");
  });

  test("retains invalid partial records and never injects presentation placeholders", () => {
    const records = createLoadedCanonicalRecords();
    const invalidEntry = records.entries[0]!.value as Partial<{ title: string }>;
    delete invalidEntry.title;

    const result = constructReleaseModel({
      records,
      release_metadata: createValidReleaseMetadata(),
      site_origin: "http://localhost:4321",
      mode: "preview",
    });
    if (result.mode !== "preview") return;
    expect(result.preview.promotable).toBe(false);
    expect(result.preview.invalid_records).toContainEqual(
      expect.objectContaining({
        record_type: "entry",
        filename: "data/canonical-records/entries/entry.json",
        diagnostics: expect.arrayContaining([expect.objectContaining({ code: "required_field" })]),
      }),
    );
    expect(result.preview.resolved.current_entries).toBeUndefined();
    expect(result.preview.resolved.methodology?.version_url).toBe(
      "http://localhost:4321/methodology/1.0.0/",
    );
    expect(result.preview.resolved.about?.related_links.changelog.url).toBe(
      "http://localhost:4321/changelog/",
    );
    expect(JSON.stringify(result.preview)).not.toContain("Missing Required Field");
  });

  test("does not derive public values from a loader-invalid snapshot", () => {
    const records = createLoadedCanonicalRecords();
    const snapshotSource = records.entry_publication_snapshots[0]!;
    records.diagnostics.push({
      severity: "error",
      code: "snapshot_filename_metadata_mismatch",
      record_type: "entry_publication_snapshot",
      filename: snapshotSource.filename,
      path: [],
      invalid_value: "wrong-name.json",
      rule: "Snapshot filename must agree with stored metadata.",
    });

    const result = constructReleaseModel({
      records,
      release_metadata: createValidReleaseMetadata(),
      site_origin: "http://localhost:4321",
      mode: "preview",
    });
    if (result.mode !== "preview") return;
    expect(result.preview.resolved.current_entries).toBeUndefined();
    expect(result.preview.invalid_records).toContainEqual(
      expect.objectContaining({ filename: snapshotSource.filename }),
    );
  });
});
