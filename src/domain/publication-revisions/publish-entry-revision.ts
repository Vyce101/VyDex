// Orchestrates deterministic validation and immutable Entry snapshot creation.
import {
  entryPublicationSnapshotSchema,
  entrySchema,
  type EntryPublicationSnapshot,
} from "../canonical-records";
import {
  createSchemaDiagnostics,
  type ValidationDiagnostic,
  type ValidationResult,
} from "../cross-record-validation";
import { deriveEntryRevisionActivity } from "../material-activity";
import { freezeEntryPublicationSnapshot } from "./immutable-snapshot";
import { validateMethodologyReferences } from "./methodology-reference-validation";
import {
  publicationMetadataSchema,
  type PublishedEntryRevision,
  type PublishEntryRevisionInput,
} from "./publication-request";
import { validateRevisionClassification } from "./revision-classification";

export function publishEntryRevision(
  input: PublishEntryRevisionInput,
): ValidationResult<PublishedEntryRevision> {
  const diagnostics: ValidationDiagnostic[] = [];
  const entryResult = entrySchema.safeParse(input.proposed_entry);
  if (!entryResult.success) {
    diagnostics.push(
      ...createSchemaDiagnostics(
        entryResult.error,
        { value: input.proposed_entry },
        "entry",
        "id",
      ),
    );
  }

  const metadataInput = {
    revision_id: input.revision_id,
    published_at: input.published_at,
    revision_category: input.revision_category,
    materiality: input.materiality,
    update_summary: input.update_summary,
    material_change_paths: input.material_change_paths,
  };
  const metadataResult = publicationMetadataSchema.safeParse(metadataInput);
  if (!metadataResult.success) {
    diagnostics.push(
      ...createSchemaDiagnostics(
        metadataResult.error,
        { value: metadataInput },
        "entry_publication_request",
        "revision_id",
      ),
    );
  }
  if (!entryResult.success || !metadataResult.success) return { success: false, diagnostics };

  const proposedEntry = entryResult.data;
  const metadata = metadataResult.data;
  let history: EntryPublicationSnapshot[] = [];
  if (input.existing_snapshots.length > 0) {
    const historyResult = deriveEntryRevisionActivity(input.existing_snapshots);
    if (!historyResult.success) return historyResult;
    history = input.existing_snapshots
      .map((snapshot) => entryPublicationSnapshotSchema.parse(snapshot))
      .sort((left, right) => left.revision_number - right.revision_number);
  }

  const previous = history.at(-1);
  if (previous && previous.entry_id !== proposedEntry.id) {
    diagnostics.push({
      severity: "error",
      code: "history_entry_id_mismatch",
      record_type: "entry_publication_request",
      record_id: proposedEntry.id,
      path: ["proposed_entry", "id"],
      invalid_value: proposedEntry.id,
      rule: "The proposed Entry must have the same identity as its existing history.",
      related_record_id: previous.entry_id,
    });
  }
  if (proposedEntry.entry_state === "removed") {
    diagnostics.push({
      severity: "error",
      code: "stage_1_removal_not_supported",
      record_type: "entry_publication_request",
      record_id: proposedEntry.id,
      path: ["proposed_entry", "entry_state"],
      invalid_value: proposedEntry.entry_state,
      rule: "Stage 1 publication must not publish a removed Entry.",
    });
  }

  const resolvedMethodology = validateMethodologyReferences(
    input.methodologies,
    proposedEntry,
    history,
    diagnostics,
  );
  validateRevisionClassification(metadata, previous?.entry ?? null, proposedEntry, diagnostics);
  if (diagnostics.length > 0 || !resolvedMethodology) return { success: false, diagnostics };

  const candidate = {
    revision_id: metadata.revision_id,
    entry_id: proposedEntry.id,
    revision_number: history.length + 1,
    published_at: metadata.published_at,
    methodology_id: resolvedMethodology.id,
    methodology_public_version: resolvedMethodology.public_version,
    revision_category: metadata.revision_category,
    materiality: metadata.materiality,
    update_summary: metadata.update_summary,
    entry: proposedEntry,
  };
  const snapshotResult = entryPublicationSnapshotSchema.safeParse(candidate);
  if (!snapshotResult.success) {
    return {
      success: false,
      diagnostics: createSchemaDiagnostics(
        snapshotResult.error,
        { value: candidate },
        "entry_publication_snapshot",
        "revision_id",
      ),
    };
  }

  const snapshot = freezeEntryPublicationSnapshot(snapshotResult.data);
  const activityResult = deriveEntryRevisionActivity([...history, snapshot]);
  if (!activityResult.success) return activityResult;

  return {
    success: true,
    data: { snapshot, activity: activityResult.data },
    diagnostics: [],
  };
}
