// Enforces durable UUID and public slug namespaces across validated record collections.
import type { Entry, TopicTrail } from "../canonical-records";
import {
  createAggregateDiagnostic,
  type LocatedRecordInput,
  type ValidationDiagnostic,
} from "./diagnostics";

export type ValidatedLocated<T> = {
  data: T;
  input: LocatedRecordInput;
};

export type DurableRecord = {
  id: string;
  input: LocatedRecordInput;
  recordType: string;
  path: PropertyKey[];
};

type SlugOwner = {
  recordId: string;
};

export function validateGlobalIds(records: readonly DurableRecord[], diagnostics: ValidationDiagnostic[]): void {
  const identities = new Map<string, DurableRecord>();

  for (const record of records) {
    const existing = identities.get(record.id);
    if (!existing) {
      identities.set(record.id, record);
      continue;
    }

    diagnostics.push(
      createAggregateDiagnostic(
        record.input,
        record.recordType,
        record.id,
        record.path,
        "duplicate_durable_id",
        record.id,
        `Durable UUIDv7 IDs must be globally unique; this ID is already used by ${existing.recordType}.`,
        existing.id,
      ),
    );
  }
}

export function validateSlugNamespace(
  records: readonly ValidatedLocated<Entry | TopicTrail>[],
  recordType: "entry" | "topic_trail",
  diagnostics: ValidationDiagnostic[],
): void {
  const slugs = new Map<string, SlugOwner>();

  for (const record of records) {
    const candidates = [
      { value: record.data.slug, path: ["slug"] as PropertyKey[] },
      ...record.data.aliases.map((alias, index) => ({
        value: alias,
        path: ["aliases", index] as PropertyKey[],
      })),
    ];

    for (const candidate of candidates) {
      const existing = slugs.get(candidate.value);
      if (!existing) {
        slugs.set(candidate.value, { recordId: record.data.id });
        continue;
      }

      if (existing.recordId === record.data.id) {
        continue;
      }

      diagnostics.push(
        createAggregateDiagnostic(
          record.input,
          recordType,
          record.data.id,
          candidate.path,
          "slug_namespace_collision",
          candidate.value,
          `Current slugs and aliases must be unique within the ${recordType} namespace.`,
          existing.recordId,
        ),
      );
    }
  }
}
