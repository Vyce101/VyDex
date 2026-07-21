// Validates canonical record collections, durable identities, slugs, and relationships.
import type {
  Entry,
  EntryPublicationSnapshot,
  Methodology,
  ReleaseMetadata,
  TopicTrail,
} from "../canonical-records";
import {
  createAggregateDiagnostic,
  type LocatedRecordInput,
  type ValidationDiagnostic,
  type ValidationResult,
} from "./diagnostics";
import {
  validateGlobalIds,
  validateSlugNamespace,
  type DurableRecord,
  type ValidatedLocated,
} from "./identity-validation";
import {
  validateEntryPublicationSnapshotRecord,
  validateEntryRecord,
  validateMethodologyRecord,
  validateReleaseMetadataRecord,
  validateTopicTrailRecord,
} from "./record-validation";
import { validateEntryRelationships } from "./relationship-validation";

export type CanonicalValidationMode = "authoring" | "stage_1_production";

export type CanonicalRecordSetInput = {
  entries: readonly LocatedRecordInput[];
  topic_trails: readonly LocatedRecordInput[];
  methodologies: readonly LocatedRecordInput[];
  entry_publication_snapshots: readonly LocatedRecordInput[];
  release_metadata: readonly LocatedRecordInput[];
};

export type CanonicalRecordSet = {
  entries: Entry[];
  topic_trails: TopicTrail[];
  methodologies: Methodology[];
  entry_publication_snapshots: EntryPublicationSnapshot[];
  release_metadata: ReleaseMetadata[];
};

function validateCollection<T>(
  inputs: readonly LocatedRecordInput[],
  validator: (input: LocatedRecordInput) => ValidationResult<T>,
  diagnostics: ValidationDiagnostic[],
): ValidatedLocated<T>[] {
  return inputs.flatMap((input) => {
    const result = validator(input);
    if (!result.success) {
      diagnostics.push(...result.diagnostics);
      return [];
    }
    return [{ data: result.data, input }];
  });
}

export function validateCanonicalRecordSet(
  input: CanonicalRecordSetInput,
  mode: CanonicalValidationMode,
): ValidationResult<CanonicalRecordSet> {
  const diagnostics: ValidationDiagnostic[] = [];
  const entries = validateCollection(input.entries, validateEntryRecord, diagnostics);
  const topicTrails = validateCollection(input.topic_trails, validateTopicTrailRecord, diagnostics);
  const methodologies = validateCollection(input.methodologies, validateMethodologyRecord, diagnostics);
  const snapshots = validateCollection(
    input.entry_publication_snapshots,
    validateEntryPublicationSnapshotRecord,
    diagnostics,
  );
  const releaseMetadata = validateCollection(input.release_metadata, validateReleaseMetadataRecord, diagnostics);

  const durableRecords: DurableRecord[] = [
      ...entries.map(({ data, input: recordInput }) => ({
        id: data.id,
        input: recordInput,
        recordType: "entry",
        path: ["id"],
      })),
      ...topicTrails.map(({ data, input: recordInput }) => ({
        id: data.id,
        input: recordInput,
        recordType: "topic_trail",
        path: ["id"],
      })),
      ...methodologies.map(({ data, input: recordInput }) => ({
        id: data.id,
        input: recordInput,
        recordType: "methodology",
        path: ["id"],
      })),
      ...snapshots.map(({ data, input: recordInput }) => ({
        id: data.revision_id,
        input: recordInput,
        recordType: "entry_publication_snapshot",
        path: ["revision_id"],
      })),
      ...releaseMetadata.map(({ data, input: recordInput }) => ({
        id: data.release_id,
        input: recordInput,
        recordType: "release_metadata",
        path: ["release_id"],
      })),
    ];
  validateGlobalIds(durableRecords, diagnostics);

  validateSlugNamespace(entries, "entry", diagnostics);
  validateSlugNamespace(topicTrails, "topic_trail", diagnostics);

  const topicTrailIds = new Set(topicTrails.map(({ data }) => data.id));
  const methodologyById = new Map(methodologies.map(({ data }) => [data.id, data]));
  const methodologyIds = new Set(methodologyById.keys());

  for (const { data: entry, input: recordInput } of entries) {
    validateEntryRelationships(
      entry,
      recordInput,
      "entry",
      entry.id,
      [],
      topicTrailIds,
      methodologyIds,
      diagnostics,
    );

    if (mode === "stage_1_production" && entry.entry_state === "removed") {
      diagnostics.push(
        createAggregateDiagnostic(
          recordInput,
          "entry",
          entry.id,
          ["entry_state"],
          "removed_entry_not_public",
          entry.entry_state,
          "Stage 1 production records must not use the removed Entry State.",
        ),
      );
    }
  }

  for (const { data: snapshot, input: recordInput } of snapshots) {
    validateEntryRelationships(
      snapshot.entry,
      recordInput,
      "entry_publication_snapshot",
      snapshot.revision_id,
      ["entry"],
      topicTrailIds,
      methodologyIds,
      diagnostics,
      false,
    );

    const methodology = methodologyById.get(snapshot.methodology_id);
    if (!methodology) {
      diagnostics.push(
        createAggregateDiagnostic(
          recordInput,
          "entry_publication_snapshot",
          snapshot.revision_id,
          ["methodology_id"],
          "unresolved_methodology",
          snapshot.methodology_id,
          "Every snapshot Methodology relationship must resolve.",
          snapshot.methodology_id,
        ),
      );
    } else if (methodology.public_version !== snapshot.methodology_public_version) {
      diagnostics.push(
        createAggregateDiagnostic(
          recordInput,
          "entry_publication_snapshot",
          snapshot.revision_id,
          ["methodology_public_version"],
          "snapshot_methodology_version_mismatch",
          snapshot.methodology_public_version,
          "Snapshot Methodology public version must match the referenced Methodology record.",
          methodology.id,
        ),
      );
    }
  }

  if (diagnostics.length > 0) {
    return { success: false, diagnostics };
  }

  return {
    success: true,
    data: {
      entries: entries.map(({ data }) => data),
      topic_trails: topicTrails.map(({ data }) => data),
      methodologies: methodologies.map(({ data }) => data),
      entry_publication_snapshots: snapshots.map(({ data }) => data),
      release_metadata: releaseMetadata.map(({ data }) => data),
    },
    diagnostics: [],
  };
}
