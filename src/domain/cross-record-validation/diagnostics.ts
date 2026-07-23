// Defines structured validation diagnostics and converts Zod issues without side effects.
import type { z } from "zod";

export type ValidationSeverity = "error" | "warning";

export type ValidationDiagnostic = {
  severity: ValidationSeverity;
  code: string;
  record_type: string;
  record_id?: string;
  filename?: string;
  path: PropertyKey[];
  invalid_value?: unknown;
  rule: string;
  related_record_id?: string;
};

export type LocatedRecordInput = {
  value: unknown;
  filename?: string;
};

export type ValidationResult<T> =
  | { success: true; data: T; diagnostics: readonly [] }
  | { success: false; diagnostics: ValidationDiagnostic[] };

type RecordIdentityField = "id" | "revision_id" | "release_id" | "methodology_id";

function getRecordId(value: unknown, identityField: RecordIdentityField | null): string | undefined {
  if (identityField === null) return undefined;
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = Reflect.get(value, identityField);
  return typeof candidate === "string" ? candidate : undefined;
}

function getInvalidValue(value: unknown, path: readonly PropertyKey[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if ((typeof current !== "object" && typeof current !== "function") || current === null) {
      return undefined;
    }
    return Reflect.get(current, key);
  }, value);
}

function getDiagnosticCode(issue: z.core.$ZodIssue): string {
  if (issue.code === "custom") {
    const params = "params" in issue ? issue.params : undefined;
    if (typeof params?.diagnosticCode === "string") {
      return params.diagnosticCode;
    }
  }

  if (issue.code === "invalid_type" && issue.input === undefined) {
    return "required_field";
  }

  const issueCodes: Partial<Record<z.core.$ZodIssue["code"], string>> = {
    invalid_type: "invalid_type",
    invalid_value: "invalid_controlled_value",
    invalid_format: "invalid_format",
    too_small: "required_value",
    too_big: "value_too_large",
    unrecognized_keys: "unknown_field",
  };
  return issueCodes[issue.code] ?? "invalid_record";
}

export function createSchemaDiagnostics(
  error: z.ZodError,
  input: LocatedRecordInput,
  recordType: string,
  identityField: RecordIdentityField | null,
): ValidationDiagnostic[] {
  const recordId = getRecordId(input.value, identityField);

  return error.issues.flatMap((issue) => {
    const paths =
      issue.code === "unrecognized_keys"
        ? issue.keys.map((key) => [...issue.path, key] as PropertyKey[])
        : [[...issue.path] as PropertyKey[]];

    return paths.map((path) => {
      const invalidValue = getInvalidValue(input.value, path);
      return {
        severity: "error",
        code: getDiagnosticCode(issue),
        record_type: recordType,
        ...(recordId ? { record_id: recordId } : {}),
        ...(input.filename ? { filename: input.filename } : {}),
        path,
        ...(invalidValue !== undefined ? { invalid_value: invalidValue } : {}),
        rule: issue.message,
      };
    });
  });
}

export function createAggregateDiagnostic(
  input: LocatedRecordInput,
  recordType: string,
  recordId: string,
  path: PropertyKey[],
  code: string,
  invalidValue: unknown,
  rule: string,
  relatedRecordId?: string,
): ValidationDiagnostic {
  return {
    severity: "error",
    code,
    record_type: recordType,
    record_id: recordId,
    ...(input.filename ? { filename: input.filename } : {}),
    path,
    invalid_value: invalidValue,
    rule,
    ...(relatedRecordId ? { related_record_id: relatedRecordId } : {}),
  };
}
