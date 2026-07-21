// Resolves Entry Topic Trail and Methodology relationships for aggregate validation.
import type { Entry } from "../canonical-records";
import {
  createAggregateDiagnostic,
  type LocatedRecordInput,
  type ValidationDiagnostic,
} from "./diagnostics";

export function validateEntryRelationships(
  entry: Entry,
  input: LocatedRecordInput,
  recordType: "entry" | "entry_publication_snapshot",
  recordId: string,
  pathPrefix: PropertyKey[],
  topicTrailIds: ReadonlySet<string>,
  methodologyIds: ReadonlySet<string>,
  diagnostics: ValidationDiagnostic[],
  validateMethodology = true,
): void {
  const relationships = [
    {
      id: entry.primary_topic_trail_id,
      path: [...pathPrefix, "primary_topic_trail_id"],
    },
    ...entry.secondary_topic_trail_ids.map((id, index) => ({
      id,
      path: [...pathPrefix, "secondary_topic_trail_ids", index],
    })),
  ];

  for (const relationship of relationships) {
    if (!topicTrailIds.has(relationship.id)) {
      diagnostics.push(
        createAggregateDiagnostic(
          input,
          recordType,
          recordId,
          relationship.path,
          "unresolved_topic_trail",
          relationship.id,
          "Every primary and secondary Topic Trail relationship must resolve.",
          relationship.id,
        ),
      );
    }
  }

  if (validateMethodology && !methodologyIds.has(entry.methodology_id)) {
    diagnostics.push(
      createAggregateDiagnostic(
        input,
        recordType,
        recordId,
        [...pathPrefix, "methodology_id"],
        "unresolved_methodology",
        entry.methodology_id,
        "Every Entry methodology relationship must resolve.",
        entry.methodology_id,
      ),
    );
  }
}
