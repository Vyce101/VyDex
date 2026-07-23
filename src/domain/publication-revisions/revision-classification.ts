// Enforces revision category and objective or declared materiality consistency.
import type { Entry } from "../canonical-records";
import type { ValidationDiagnostic } from "../cross-record-validation";
import {
  entryValuesEqual,
  hasAutomaticallyMaterialEntryChange,
  hasDeclaredMaterialPathChanged,
} from "./entry-comparison";
import { createPublicationDiagnostic } from "./publication-diagnostics";
import type { PublicationMetadata } from "./publication-request";

export function validateRevisionClassification(
  metadata: PublicationMetadata,
  previousEntry: Entry | null,
  proposedEntry: Entry,
  diagnostics: ValidationDiagnostic[],
): void {
  const isInitial = previousEntry === null;
  const hasActualChange = isInitial || !entryValuesEqual(previousEntry, proposedEntry);
  const hasAutomaticChange = !isInitial && hasAutomaticallyMaterialEntryChange(previousEntry, proposedEntry);
  const declaredChanges = metadata.material_change_paths.filter((path, index) => {
    const changed = hasDeclaredMaterialPathChanged(path, previousEntry, proposedEntry);
    if (!changed) {
      diagnostics.push(
        createPublicationDiagnostic(
          "unchanged_material_change_path",
          ["material_change_paths", index],
          "Every declared material-change path must identify an actual Entry difference.",
          path,
          proposedEntry.id,
        ),
      );
    }
    return changed;
  });
  const hasDeclaredChange = declaredChanges.length > 0;

  if (isInitial) {
    if (metadata.revision_category !== "initial_publication") {
      diagnostics.push(
        createPublicationDiagnostic(
          "invalid_initial_revision_category",
          ["revision_category"],
          "The first publication must use initial_publication.",
          metadata.revision_category,
          proposedEntry.id,
        ),
      );
    }
    if (metadata.materiality !== "material") {
      diagnostics.push(
        createPublicationDiagnostic(
          "revision_materiality_mismatch",
          ["materiality"],
          "The first publication must be material.",
          metadata.materiality,
          proposedEntry.id,
        ),
      );
    }
    return;
  }

  if (!hasActualChange) {
    diagnostics.push(
      createPublicationDiagnostic(
        "no_public_change",
        ["proposed_entry"],
        "A later publication must change the complete public Entry state.",
        undefined,
        proposedEntry.id,
      ),
    );
  }

  const expectedMateriality =
    metadata.revision_category === "material_update"
      ? "material"
      : metadata.revision_category === "non_material_correction" || metadata.revision_category === "review_check"
        ? "non_material"
        : undefined;
  if (metadata.revision_category === "initial_publication") {
    diagnostics.push(
      createPublicationDiagnostic(
        "initial_publication_after_revision_one",
        ["revision_category"],
        "initial_publication is valid only when no prior snapshots exist.",
        metadata.revision_category,
        proposedEntry.id,
      ),
    );
  }
  if (metadata.revision_category === "removal") {
    diagnostics.push(
      createPublicationDiagnostic(
        "stage_1_removal_not_supported",
        ["revision_category"],
        "Stage 1 publication does not create removal revisions.",
        metadata.revision_category,
        proposedEntry.id,
      ),
    );
  }
  if (expectedMateriality && metadata.materiality !== expectedMateriality) {
    diagnostics.push(
      createPublicationDiagnostic(
        "revision_materiality_mismatch",
        ["materiality"],
        `${metadata.revision_category} must be ${expectedMateriality}.`,
        metadata.materiality,
        proposedEntry.id,
      ),
    );
  }
  if (hasAutomaticChange && metadata.materiality === "non_material") {
    diagnostics.push(
      createPublicationDiagnostic(
        "automatically_material_change_marked_non_material",
        ["materiality"],
        "A change to an automatically material field cannot be non-material.",
        metadata.materiality,
        proposedEntry.id,
      ),
    );
  }
  if (hasDeclaredChange && metadata.materiality === "non_material") {
    diagnostics.push(
      createPublicationDiagnostic(
        "declared_material_change_marked_non_material",
        ["materiality"],
        "A declared semantic material change cannot be non-material.",
        metadata.materiality,
        proposedEntry.id,
      ),
    );
  }
  if (metadata.revision_category === "material_update" && !hasAutomaticChange && !hasDeclaredChange) {
    diagnostics.push(
      createPublicationDiagnostic(
        "material_update_without_material_change",
        ["revision_category"],
        "A material_update requires an automatically material or declared semantic change.",
        metadata.revision_category,
        proposedEntry.id,
      ),
    );
  }
  if (
    metadata.revision_category === "review_check" &&
    previousEntry.date_last_checked === proposedEntry.date_last_checked
  ) {
    diagnostics.push(
      createPublicationDiagnostic(
        "review_check_requires_date_last_checked_change",
        ["proposed_entry", "date_last_checked"],
        "A review_check must update date_last_checked.",
        proposedEntry.date_last_checked,
        proposedEntry.id,
      ),
    );
  }
}
