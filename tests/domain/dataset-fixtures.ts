// Builds complete multi-Entry production releases for Dataset 1.0.0 tests.
import type { CanonicalRecordSource, ReleaseModel } from "../../src/domain/release-construction";
import { constructReleaseModel } from "../../src/domain/release-construction";
import {
  IDS,
  createLoadedCanonicalRecords,
  createValidEntry,
  createValidReleaseMetadata,
  createValidSecondaryTopicTrail,
  createValidSnapshot,
} from "./fixtures";

export const DATASET_FIXTURE_IDS = {
  secondEntry: IDS.alternateEntry,
  secondEntrySnapshot: "01900000-0000-7000-8000-000000000008",
  firstEntryRevisionTwo: "01900000-0000-7000-8000-000000000010",
  thirdTopicTrail: "01900000-0000-7000-8000-000000000011",
} as const;

function source(
  recordType: CanonicalRecordSource["record_type"],
  filename: string,
  value: unknown,
): CanonicalRecordSource {
  return {
    record_type: recordType,
    filename,
    raw_text: JSON.stringify(value),
    value,
  };
}

export function createDatasetFixtureRelease(): ReleaseModel {
  const records = createLoadedCanonicalRecords();
  const editableFirstEntry = records.entries[0]!.value as ReturnType<typeof createValidEntry>;
  editableFirstEntry.title = "Unpublished editable title that must not leak";

  const thirdTrail = {
    ...createValidSecondaryTopicTrail(),
    id: DATASET_FIXTURE_IDS.thirdTopicTrail,
  };
  thirdTrail.slug = "frontier-artifacts";
  thirdTrail.aliases = [];
  thirdTrail.name = "Frontier Artifacts";
  records.topic_trails.push(
    source(
      "topic_trail",
      "data/canonical-records/topic-trails/frontier-artifacts.json",
      thirdTrail,
    ),
  );

  const firstRevisionTwo = createValidSnapshot();
  firstRevisionTwo.revision_id = DATASET_FIXTURE_IDS.firstEntryRevisionTwo;
  firstRevisionTwo.revision_number = 2;
  firstRevisionTwo.published_at = "2026-07-22T20:15:30Z";
  firstRevisionTwo.revision_category = "material_update";
  firstRevisionTwo.materiality = "material";
  firstRevisionTwo.update_summary = "Strengthened the evidence assessment with additional sources.";
  firstRevisionTwo.entry.title = "Published multi-source frontier result";
  firstRevisionTwo.entry.evidence_strength = "very_strong";
  firstRevisionTwo.entry.domains = ["space", "biology", "ai_capabilities"];
  firstRevisionTwo.entry.secondary_topic_trail_ids = [
    DATASET_FIXTURE_IDS.thirdTopicTrail,
    IDS.secondaryTopicTrail,
  ];
  firstRevisionTwo.entry.potential_significance_if_confirmed =
    "Confirmation would broaden the supported frontier result.";
  firstRevisionTwo.entry.sources = [
    {
      citation_id: "media-beta",
      title: "Beta media report",
      publisher_or_domain: "Example News",
      url: "https://example.com/media-beta",
      evidence_types: ["media_report"],
      source_role: "media_report",
      used_for: "Provides public reporting context.",
    },
    {
      citation_id: "primary-zulu",
      title: "Zulu primary record",
      publisher_or_domain: "Example Lab",
      url: "https://example.com/primary-zulu",
      evidence_types: ["technical_artifact", "preprint"],
      source_role: "primary_evidence",
      used_for: "Supplies the primary result and artifacts.",
    },
    {
      citation_id: "context-alpha",
      title: "Alpha context record",
      publisher_or_domain: "Example Archive",
      url: "http://example.com/context-alpha",
      evidence_types: ["government_report"],
      source_role: "context_source",
      used_for: "Establishes historical context.",
    },
    {
      citation_id: "official-record",
      title: "Official evaluation record",
      publisher_or_domain: "Example Agency",
      url: "https://example.com/official-record",
      evidence_types: ["court_filing", "official_claim"],
      source_role: "official_record",
      used_for: "Confirms the official record.",
    },
    {
      citation_id: "primary-alpha",
      title: "Alpha primary record",
      publisher_or_domain: "Example Lab",
      url: "https://example.com/primary-alpha",
      evidence_types: ["benchmark_result"],
      source_role: "primary_evidence",
      used_for: "Supplies the primary benchmark result.",
    },
    {
      citation_id: "replication-record",
      title: "Independent replication record",
      publisher_or_domain: "Example University",
      url: "https://example.com/replication-record",
      evidence_types: ["independent_replication", "peer_reviewed_paper"],
      source_role: "independent_replication",
      used_for: "Supports independent replication.",
    },
    {
      citation_id: "artifact-record",
      title: "Strong artifact record",
      publisher_or_domain: "Example Repository",
      url: "https://example.com/artifact-record",
      evidence_types: ["audit"],
      source_role: "strong_artifact",
      used_for: "Provides a strong supporting artifact.",
    },
  ];
  records.entry_publication_snapshots.push(
    source(
      "entry_publication_snapshot",
      `data/publication-snapshots/entries/${IDS.entry}/2-${DATASET_FIXTURE_IDS.firstEntryRevisionTwo}.json`,
      firstRevisionTwo,
    ),
  );

  const secondEntry = createValidEntry();
  secondEntry.id = DATASET_FIXTURE_IDS.secondEntry;
  secondEntry.slug = "alpha-frontier-result";
  secondEntry.aliases = [];
  secondEntry.title = "Alpha frontier result";
  secondEntry.primary_topic_trail_id = IDS.topicTrail;
  secondEntry.secondary_topic_trail_ids = [DATASET_FIXTURE_IDS.thirdTopicTrail];
  secondEntry.sources[0]!.citation_id = "alpha-evaluation-paper";
  records.entries.unshift(
    source("entry", "data/canonical-records/entries/alpha-frontier-result.json", secondEntry),
  );

  const secondEntrySnapshot = createValidSnapshot();
  secondEntrySnapshot.revision_id = DATASET_FIXTURE_IDS.secondEntrySnapshot;
  secondEntrySnapshot.entry_id = DATASET_FIXTURE_IDS.secondEntry;
  secondEntrySnapshot.revision_number = 1;
  secondEntrySnapshot.published_at = "2026-07-20T12:00:00Z";
  secondEntrySnapshot.entry = structuredClone(secondEntry);
  records.entry_publication_snapshots.unshift(
    source(
      "entry_publication_snapshot",
      `data/publication-snapshots/entries/${DATASET_FIXTURE_IDS.secondEntry}/1-${DATASET_FIXTURE_IDS.secondEntrySnapshot}.json`,
      secondEntrySnapshot,
    ),
  );

  const result = constructReleaseModel({
    records,
    release_metadata: createValidReleaseMetadata(),
    site_origin: "https://vydex.example",
    mode: "production",
  });
  if (result.mode !== "production" || !result.success) {
    const codes = result.mode === "production" ? result.diagnostics.map(({ code }) => code) : ["wrong_mode"];
    throw new Error(`Dataset fixture release failed: ${codes.join(", ")}`);
  }
  return result.release;
}
