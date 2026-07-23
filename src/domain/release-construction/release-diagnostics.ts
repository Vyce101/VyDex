// Creates and deduplicates structured release diagnostics.
import type { ValidationDiagnostic } from "../cross-record-validation";

export function createReleaseDiagnostic(
  code: string,
  recordType: string,
  path: PropertyKey[],
  rule: string,
  invalidValue?: unknown,
  recordId?: string,
  relatedRecordId?: string,
): ValidationDiagnostic {
  return {
    severity: "error",
    code,
    record_type: recordType,
    ...(recordId ? { record_id: recordId } : {}),
    path,
    ...(invalidValue !== undefined ? { invalid_value: invalidValue } : {}),
    rule,
    ...(relatedRecordId ? { related_record_id: relatedRecordId } : {}),
  };
}

export function deduplicateDiagnostics(
  diagnostics: readonly ValidationDiagnostic[],
): ValidationDiagnostic[] {
  const unique = new Map<string, ValidationDiagnostic>();
  for (const diagnostic of diagnostics) {
    const key = JSON.stringify([
      diagnostic.code,
      diagnostic.record_type,
      diagnostic.record_id,
      diagnostic.filename,
      diagnostic.path,
      diagnostic.related_record_id,
      diagnostic.invalid_value,
    ]);
    if (!unique.has(key)) unique.set(key, diagnostic);
  }
  return [...unique.values()];
}
