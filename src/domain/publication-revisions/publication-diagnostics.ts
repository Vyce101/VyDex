// Creates structured blocking diagnostics for deterministic publication failures.
import type { ValidationDiagnostic } from "../cross-record-validation";

export function createPublicationDiagnostic(
  code: string,
  path: PropertyKey[],
  rule: string,
  invalidValue?: unknown,
  recordId?: string,
  relatedRecordId?: string,
): ValidationDiagnostic {
  return {
    severity: "error",
    code,
    record_type: "entry_publication_request",
    ...(recordId ? { record_id: recordId } : {}),
    path,
    ...(invalidValue !== undefined ? { invalid_value: invalidValue } : {}),
    rule,
    ...(relatedRecordId ? { related_record_id: relatedRecordId } : {}),
  };
}
