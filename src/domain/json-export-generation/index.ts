// Projects resolved public Entries into the versioned JSON dataset contract.
import {
  EVIDENCE_STRENGTH_SCORES,
  EVIDENCE_TYPES,
  type Entry,
  type EntryPublicationSnapshot,
  type EvidenceType,
  type Methodology,
  type MethodologyVersion,
  type ReleaseMetadata,
  type TopicTrail,
} from "../canonical-records";
import type { ValidationDiagnostic, ValidationResult } from "../cross-record-validation";
import type { DerivedEntryRevisionActivity } from "../material-activity";
import type { AbsoluteCanonicalUrl } from "../route-generation";

export type ExportTopicTrailReferenceV1 = {
  id: TopicTrail["id"];
  slug: TopicTrail["slug"];
  name: string;
  canonical_url: AbsoluteCanonicalUrl;
};

export type ExportMethodologyReferenceV1 = {
  id: Methodology["id"];
  public_version: Methodology["public_version"];
  title: string;
  canonical_url: AbsoluteCanonicalUrl;
};

export type ExportEntryV1 = Omit<
  Entry,
  "primary_topic_trail_id" | "secondary_topic_trail_ids" | "methodology_id" | "sources"
> & {
  canonical_url: AbsoluteCanonicalUrl;
  current_revision_id: EntryPublicationSnapshot["revision_id"];
  current_revision_number: number;
  current_revision_published_at: EntryPublicationSnapshot["published_at"];
  current_update_summary: string;
  evidence_strength_score: number;
  date_added: DerivedEntryRevisionActivity["date_added"];
  date_updated: DerivedEntryRevisionActivity["date_updated"];
  latest_meaningful_activity: DerivedEntryRevisionActivity["latest_meaningful_activity"];
  primary_topic_trail: ExportTopicTrailReferenceV1;
  secondary_topic_trails: ExportTopicTrailReferenceV1[];
  methodology: ExportMethodologyReferenceV1;
  evidence_types: EvidenceType[];
  sources: Entry["sources"];
};

export type VyDexDatasetV1 = {
  $schema: AbsoluteCanonicalUrl;
  dataset_name: "VyDex";
  dataset_schema_version: "1.0.0";
  release_id: ReleaseMetadata["release_id"];
  generated_at: ReleaseMetadata["generated_at"];
  scope: "latest_entry_versions";
  entry_count: number;
  methodology_versions: MethodologyVersion[];
  entries: ExportEntryV1[];
};

export type ExportEntryProjectionInput = {
  entry: Entry;
  snapshot: EntryPublicationSnapshot;
  activity: DerivedEntryRevisionActivity;
  canonical_url: AbsoluteCanonicalUrl;
  primary_topic_trail: ExportTopicTrailReferenceV1;
  secondary_topic_trails: ExportTopicTrailReferenceV1[];
  methodology: ExportMethodologyReferenceV1;
};

function deriveEvidenceTypes(entry: Entry): EvidenceType[] {
  const usedTypes = new Set(entry.sources.flatMap((source) => source.evidence_types));
  return EVIDENCE_TYPES.filter((evidenceType) => usedTypes.has(evidenceType));
}

export function projectExportEntry(input: ExportEntryProjectionInput): ExportEntryV1 {
  const {
    primary_topic_trail_id: _primaryTopicTrailId,
    secondary_topic_trail_ids: _secondaryTopicTrailIds,
    methodology_id: _methodologyId,
    sources,
    ...publicFields
  } = input.entry;
  return {
    ...publicFields,
    canonical_url: input.canonical_url,
    current_revision_id: input.snapshot.revision_id,
    current_revision_number: input.snapshot.revision_number,
    current_revision_published_at: input.snapshot.published_at,
    current_update_summary: input.snapshot.update_summary,
    evidence_strength_score: EVIDENCE_STRENGTH_SCORES[input.entry.evidence_strength],
    date_added: input.activity.date_added,
    date_updated: input.activity.date_updated,
    latest_meaningful_activity: input.activity.latest_meaningful_activity,
    primary_topic_trail: input.primary_topic_trail,
    secondary_topic_trails: input.secondary_topic_trails,
    methodology: input.methodology,
    evidence_types: deriveEvidenceTypes(input.entry),
    sources: [...sources],
  };
}

function exportDiagnostic(code: string, path: PropertyKey[], rule: string, invalidValue: unknown): ValidationDiagnostic {
  return {
    severity: "error",
    code,
    record_type: "dataset_export",
    path,
    invalid_value: invalidValue,
    rule,
  };
}

export function buildVyDexDatasetV1(input: {
  release_metadata: ReleaseMetadata;
  schema_url: AbsoluteCanonicalUrl;
  entries: readonly ExportEntryV1[];
}): ValidationResult<VyDexDatasetV1> {
  const methodologyVersions = [...new Set(input.entries.map((entry) => entry.methodology.public_version))].sort(
    (left, right) => left.localeCompare(right, "en", { numeric: true }),
  );
  const entries = [...input.entries];
  const dataset: VyDexDatasetV1 = {
    $schema: input.schema_url,
    dataset_name: "VyDex",
    dataset_schema_version: "1.0.0",
    release_id: input.release_metadata.release_id,
    generated_at: input.release_metadata.generated_at,
    scope: "latest_entry_versions",
    entry_count: entries.length,
    methodology_versions: methodologyVersions,
    entries,
  };
  if (dataset.entry_count !== dataset.entries.length) {
    return {
      success: false,
      diagnostics: [
        exportDiagnostic(
          "derived_count_mismatch",
          ["entry_count"],
          "Dataset entry_count must agree with the projected Entry collection.",
          dataset.entry_count,
        ),
      ],
    };
  }
  return { success: true, data: dataset, diagnostics: [] };
}
