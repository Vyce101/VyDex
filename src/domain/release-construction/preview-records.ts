// Retains invalid preview sources and freezes returned release models.
import type { ValidationDiagnostic } from "../cross-record-validation";
import type { CanonicalRecordSource, InvalidPreviewRecord } from "./types";

function getRecordId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  for (const field of ["id", "revision_id", "methodology_id"] as const) {
    const valueAtField = Reflect.get(value, field);
    if (typeof valueAtField === "string") return valueAtField;
  }
  return undefined;
}

export function buildInvalidPreviewRecords(
  sources: readonly CanonicalRecordSource[],
  diagnostics: readonly ValidationDiagnostic[],
): InvalidPreviewRecord[] {
  return sources.flatMap((source) => {
    const recordId = getRecordId(source.value);
    const matching = diagnostics.filter(
      (diagnostic) =>
        diagnostic.filename === source.filename ||
        (recordId !== undefined && diagnostic.record_id === recordId),
    );
    if (matching.length === 0) return [];
    return [
      {
        record_type: source.record_type,
        ...(recordId ? { record_id: recordId } : {}),
        filename: source.filename,
        raw_or_partial_value: source.value ?? source.raw_text ?? null,
        diagnostics: matching,
        unresolved_relationships: matching.filter(
          ({ code }) => code.startsWith("unresolved_") || code.startsWith("orphan_"),
        ),
      },
    ];
  });
}

export function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}
