// Exposes pure record-local validators that return typed records or structured diagnostics.
import type { z } from "zod";
import {
  aboutRecordSchema,
  entryPublicationSnapshotSchema,
  entrySchema,
  methodologyPublicationEventSchema,
  methodologySchema,
  releaseMetadataSchema,
  topicTrailSchema,
  type AboutRecord,
  type Entry,
  type EntryPublicationSnapshot,
  type Methodology,
  type MethodologyPublicationEvent,
  type ReleaseMetadata,
  type TopicTrail,
} from "../canonical-records";
import {
  createSchemaDiagnostics,
  type LocatedRecordInput,
  type ValidationResult,
} from "./diagnostics";

type IdentityField = "id" | "revision_id" | "release_id" | "methodology_id" | null;

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

export function validateAboutRecord(input: LocatedRecordInput): ValidationResult<AboutRecord> {
  return validateRecord(aboutRecordSchema, input, "about", null);
}

export function validateTopicTrailRecord(input: LocatedRecordInput): ValidationResult<TopicTrail> {
  return validateRecord(topicTrailSchema, input, "topic_trail", "id");
}

export function validateMethodologyRecord(input: LocatedRecordInput): ValidationResult<Methodology> {
  return validateRecord(methodologySchema, input, "methodology", "id");
}

export function validateMethodologyPublicationEventRecord(
  input: LocatedRecordInput,
): ValidationResult<MethodologyPublicationEvent> {
  return validateRecord(
    methodologyPublicationEventSchema,
    input,
    "methodology_publication_event",
    "methodology_id",
  );
}

export function validateEntryPublicationSnapshotRecord(
  input: LocatedRecordInput,
): ValidationResult<EntryPublicationSnapshot> {
  return validateRecord(entryPublicationSnapshotSchema, input, "entry_publication_snapshot", "revision_id");
}

export function validateReleaseMetadataRecord(input: LocatedRecordInput): ValidationResult<ReleaseMetadata> {
  return validateRecord(releaseMetadataSchema, input, "release_metadata", "release_id");
}
