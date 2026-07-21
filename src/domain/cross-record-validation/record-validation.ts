// Exposes pure record-local validators that return typed records or structured diagnostics.
import type { z } from "zod";
import {
  entryPublicationSnapshotSchema,
  entrySchema,
  methodologySchema,
  releaseMetadataSchema,
  topicTrailSchema,
  type Entry,
  type EntryPublicationSnapshot,
  type Methodology,
  type ReleaseMetadata,
  type TopicTrail,
} from "../canonical-records";
import {
  createSchemaDiagnostics,
  type LocatedRecordInput,
  type ValidationResult,
} from "./diagnostics";

type IdentityField = "id" | "revision_id" | "release_id";

function validateRecord<T>(
  schema: z.ZodType<T>,
  input: LocatedRecordInput,
  recordType: string,
  identityField: IdentityField,
): ValidationResult<T> {
  const result = schema.safeParse(input.value);
  if (!result.success) {
    return {
      success: false,
      diagnostics: createSchemaDiagnostics(result.error, input, recordType, identityField),
    };
  }

  return { success: true, data: result.data, diagnostics: [] };
}

export function validateEntryRecord(input: LocatedRecordInput): ValidationResult<Entry> {
  return validateRecord(entrySchema, input, "entry", "id");
}

export function validateTopicTrailRecord(input: LocatedRecordInput): ValidationResult<TopicTrail> {
  return validateRecord(topicTrailSchema, input, "topic_trail", "id");
}

export function validateMethodologyRecord(input: LocatedRecordInput): ValidationResult<Methodology> {
  return validateRecord(methodologySchema, input, "methodology", "id");
}

export function validateEntryPublicationSnapshotRecord(
  input: LocatedRecordInput,
): ValidationResult<EntryPublicationSnapshot> {
  return validateRecord(entryPublicationSnapshotSchema, input, "entry_publication_snapshot", "revision_id");
}

export function validateReleaseMetadataRecord(input: LocatedRecordInput): ValidationResult<ReleaseMetadata> {
  return validateRecord(releaseMetadataSchema, input, "release_metadata", "release_id");
}
