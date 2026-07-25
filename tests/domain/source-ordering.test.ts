// Verifies the shared public source order across domain release and Dataset projections.
import { describe, expect, test } from "vitest";
import {
  SOURCE_ROLES,
  SOURCE_ROLE_LABELS,
  entrySourceCitationSchema,
  generateVyDexDatasetV1,
  orderEntrySourcesForPublicDisplay,
  type EntrySourceCitation,
} from "../../src/domain";
import { constructReleaseModel } from "../../src/domain/release-construction";
import { createDatasetFixtureRelease } from "./dataset-fixtures";
import {
  createLoadedCanonicalRecords,
  createValidReleaseMetadata,
} from "./fixtures";

function createSource(
  sourceRole: EntrySourceCitation["source_role"],
  title: string,
): EntrySourceCitation {
  return entrySourceCitationSchema.parse({
    citation_id: `${sourceRole}-${title}`.toLowerCase().replaceAll("_", "-").replaceAll(" ", "-"),
    title,
    publisher_or_domain: `Publisher for ${title}`,
    url: `https://example.com/${sourceRole}/${encodeURIComponent(title)}`,
    evidence_types: [sourceRole === "media_report" ? "media_report" : "technical_artifact"],
    source_role: sourceRole,
    used_for: `Used for ${title}`,
  });
}

test("orders every role by the approved cascade and titles alphabetically within a role", () => {
  const reversedRoles = [...SOURCE_ROLES].reverse();
  const sources = [
    ...reversedRoles.map((role) => createSource(role, `Zulu ${role}`)),
    createSource("primary_evidence", "Alpha primary evidence"),
  ];

  const ordered = orderEntrySourcesForPublicDisplay(sources);

  expect(ordered.map(({ source_role }) => source_role)).toEqual([
    "primary_evidence",
    "primary_evidence",
    "independent_replication",
    "official_record",
    "strong_artifact",
    "context_source",
    "media_report",
  ]);
  expect(ordered.slice(0, 2).map(({ title }) => title)).toEqual([
    "Alpha primary evidence",
    "Zulu primary_evidence",
  ]);
});

test("sorts a copy without mutating the canonical array or its source objects", () => {
  const first = createSource("context_source", "Context record");
  const second = createSource("primary_evidence", "Primary record");
  const canonicalSources = [first, second];
  const originalValues = structuredClone(canonicalSources);

  const ordered = orderEntrySourcesForPublicDisplay(canonicalSources);

  expect(ordered).not.toBe(canonicalSources);
  expect(canonicalSources).toEqual(originalValues);
  expect(ordered).toEqual([second, first]);
  expect(ordered[0]).toBe(second);
  expect(ordered[1]).toBe(first);
});

test("release resolution orders its cloned Entry and leaves canonical and snapshot sources unchanged", () => {
  const records = createLoadedCanonicalRecords();
  const unorderedSources = [
    createSource("media_report", "Media record"),
    createSource("primary_evidence", "Primary record"),
    createSource("official_record", "Official record"),
  ];
  const canonicalEntry = records.entries[0]!.value as { sources: EntrySourceCitation[] };
  const snapshot = records.entry_publication_snapshots[0]!.value as {
    entry: { sources: EntrySourceCitation[] };
  };
  canonicalEntry.sources = [...unorderedSources];
  snapshot.entry.sources = [...unorderedSources];
  const canonicalBefore = canonicalEntry.sources.map(({ citation_id }) => citation_id);
  const snapshotBefore = snapshot.entry.sources.map(({ citation_id }) => citation_id);

  const result = constructReleaseModel({
    records,
    release_metadata: createValidReleaseMetadata(),
    site_origin: "https://vydex.example",
    mode: "production",
  });

  expect(result.success).toBe(true);
  if (!result.success || result.mode !== "production") return;
  expect(result.release.current_entries[0]!.entry.sources.map(({ source_role }) => source_role)).toEqual([
    "primary_evidence",
    "official_record",
    "media_report",
  ]);
  expect(canonicalEntry.sources.map(({ citation_id }) => citation_id)).toEqual(canonicalBefore);
  expect(snapshot.entry.sources.map(({ citation_id }) => citation_id)).toEqual(snapshotBefore);
  expect(
    result.release.current_entries[0]!.snapshot.entry.sources.map(({ citation_id }) => citation_id),
  ).toEqual(snapshotBefore);
});

describe("release and Dataset source ordering", () => {
  test("produces the same order while preserving every source field attachment", () => {
    const release = createDatasetFixtureRelease();
    const resolvedEntry = release.current_entries.find(({ entry }) =>
      entry.sources.some(({ citation_id }) => citation_id === "primary-alpha"),
    )!;
    const result = generateVyDexDatasetV1({ release });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const datasetEntry = result.data.dataset.entries.find(({ id }) => id === resolvedEntry.entry.id)!;
    expect(datasetEntry.sources.map(({ citation_id }) => citation_id)).toEqual(
      resolvedEntry.entry.sources.map(({ citation_id }) => citation_id),
    );

    for (const datasetSource of datasetEntry.sources) {
      const resolvedSource = resolvedEntry.entry.sources.find(
        ({ citation_id }) => citation_id === datasetSource.citation_id,
      )!;
      expect(datasetSource).toMatchObject({
        title: resolvedSource.title,
        publisher_or_domain: resolvedSource.publisher_or_domain,
        url: resolvedSource.url,
        source_role: resolvedSource.source_role,
        source_role_label: SOURCE_ROLE_LABELS[resolvedSource.source_role],
        used_for: resolvedSource.used_for,
      });
      expect(new Set(datasetSource.evidence_types)).toEqual(new Set(resolvedSource.evidence_types));
    }
  });
});
