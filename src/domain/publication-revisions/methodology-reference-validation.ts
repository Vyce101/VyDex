// Resolves proposed and historical snapshot Methodology references exactly.
import {
  methodologySchema,
  type Entry,
  type EntryPublicationSnapshot,
  type Methodology,
} from "../canonical-records";
import {
  createSchemaDiagnostics,
  type ValidationDiagnostic,
} from "../cross-record-validation";
import { createPublicationDiagnostic } from "./publication-diagnostics";

export function validateMethodologyReferences(
  methodologies: readonly Methodology[],
  proposedEntry: Entry,
  history: readonly EntryPublicationSnapshot[],
  diagnostics: ValidationDiagnostic[],
): Methodology | undefined {
  const parsedMethodologies = methodologies.flatMap((methodology) => {
    const result = methodologySchema.safeParse(methodology);
    if (!result.success) {
      diagnostics.push(
        ...createSchemaDiagnostics(result.error, { value: methodology }, "methodology", "id"),
      );
      return [];
    }
    return [result.data];
  });
  if (diagnostics.length > 0) return undefined;

  const methodologyById = new Map<string, Methodology>();
  for (const methodology of parsedMethodologies) {
    if (methodologyById.has(methodology.id)) {
      diagnostics.push(
        createPublicationDiagnostic(
          "duplicate_methodology_id",
          ["methodologies"],
          "Supplied Methodology IDs must be unique.",
          methodology.id,
          proposedEntry.id,
          methodology.id,
        ),
      );
      continue;
    }
    methodologyById.set(methodology.id, methodology);
  }

  const proposedMethodology = methodologyById.get(proposedEntry.methodology_id);
  if (!proposedMethodology) {
    diagnostics.push(
      createPublicationDiagnostic(
        "unresolved_methodology",
        ["proposed_entry", "methodology_id"],
        "The proposed Entry Methodology reference must resolve exactly once.",
        proposedEntry.methodology_id,
        proposedEntry.id,
        proposedEntry.methodology_id,
      ),
    );
  }

  for (const snapshot of history) {
    const methodology = methodologyById.get(snapshot.methodology_id);
    if (!methodology) {
      diagnostics.push(
        createPublicationDiagnostic(
          "unresolved_methodology",
          ["existing_snapshots", snapshot.revision_number - 1, "methodology_id"],
          "Every historical snapshot Methodology reference must resolve.",
          snapshot.methodology_id,
          snapshot.revision_id,
          snapshot.methodology_id,
        ),
      );
      continue;
    }
    if (methodology.public_version !== snapshot.methodology_public_version) {
      diagnostics.push(
        createPublicationDiagnostic(
          "snapshot_methodology_version_mismatch",
          ["existing_snapshots", snapshot.revision_number - 1, "methodology_public_version"],
          "A historical snapshot must reference the exact supplied Methodology public version.",
          snapshot.methodology_public_version,
          snapshot.revision_id,
          methodology.id,
        ),
      );
    }
  }

  return proposedMethodology;
}
