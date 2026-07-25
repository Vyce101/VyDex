// Enriches validation and release-gate failures with affected generated surfaces.
import type { ValidationDiagnostic } from "../../domain";

export type StageOneReleaseDiagnostic = {
  code: string;
  record: string;
  field: string;
  rule: string;
  relationship: string;
  generated_surfaces: string[];
};

const SURFACES_BY_RECORD_TYPE: Readonly<Record<string, readonly string[]>> = Object.freeze({
  entry: ["Homepage", "Entry routes", "Topic Trails", "Changelog", "JSON export"],
  entry_publication_snapshot: ["Homepage", "Entry routes", "Topic Trails", "Changelog", "JSON export"],
  topic_trail: ["Topic Trail routes", "Entry relationships", "JSON export"],
  methodology: ["Methodology routes", "Entry routes", "Changelog", "JSON export"],
  methodology_publication_event: ["Changelog", "Methodology routes"],
  about: ["About route"],
  dataset_export: ["Export route", "JSON export", "JSON Schema"],
  dataset_artifact: ["JSON export"],
  release_metadata: ["All public routes", "JSON export", "Release manifest"],
  release: ["All public routes", "Release manifest"],
  route: ["Generated routes", "Header and Footer navigation", "Redirect registry"],
});

export function enrichValidationDiagnostic(
  diagnostic: ValidationDiagnostic,
): StageOneReleaseDiagnostic {
  const generatedSurfaces = SURFACES_BY_RECORD_TYPE[diagnostic.record_type] ?? ["Production release"];
  return {
    code: diagnostic.code,
    record:
      diagnostic.filename ??
      [diagnostic.record_type, diagnostic.record_id].filter(Boolean).join(":") ??
      diagnostic.record_type,
    field: diagnostic.path.map(String).join(".") || "(record)",
    rule: diagnostic.rule,
    relationship: diagnostic.related_record_id ?? "(none)",
    generated_surfaces: [...generatedSurfaces],
  };
}

export function releaseGateDiagnostic(input: {
  code: string;
  rule: string;
  field?: string;
  record?: string;
  relationship?: string;
  generated_surfaces: readonly string[];
}): StageOneReleaseDiagnostic {
  return {
    code: input.code,
    record: input.record ?? "release",
    field: input.field ?? "(release gate)",
    rule: input.rule,
    relationship: input.relationship ?? "(none)",
    generated_surfaces: [...input.generated_surfaces],
  };
}

export function formatReleaseDiagnostics(
  diagnostics: readonly StageOneReleaseDiagnostic[],
): string {
  return diagnostics
    .map(
      (diagnostic, index) =>
        [
          `${index + 1}. [${diagnostic.code}]`,
          `   Record: ${diagnostic.record}`,
          `   Field: ${diagnostic.field}`,
          `   Rule: ${diagnostic.rule}`,
          `   Relationship: ${diagnostic.relationship}`,
          `   Generated surfaces affected: ${diagnostic.generated_surfaces.join(", ")}`,
        ].join("\n"),
    )
    .join("\n\n");
}
