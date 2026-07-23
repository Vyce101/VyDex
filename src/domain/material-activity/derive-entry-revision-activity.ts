// Derives current and meaningful Entry activity from validated immutable revisions.
import { calendarDateSchema } from "../canonical-records";
import type { ValidationResult } from "../cross-record-validation";
import { validateEntryRevisionHistory } from "./history-validation";
import type { DerivedEntryRevisionActivity, ReadonlyEntryPublicationSnapshot } from "./types";

export function deriveEntryRevisionActivity(
  snapshots: readonly ReadonlyEntryPublicationSnapshot[],
): ValidationResult<DerivedEntryRevisionActivity> {
  const historyResult = validateEntryRevisionHistory(snapshots);
  if (!historyResult.success) return historyResult;

  const ordered = historyResult.data;
  const first = ordered[0]!;
  const current = ordered.at(-1)!;
  const newestMaterial = ordered.findLast((snapshot) => snapshot.materiality === "material")!;

  return {
    success: true,
    data: {
      date_added: calendarDateSchema.parse(first.published_at.slice(0, 10)),
      date_updated: calendarDateSchema.parse(newestMaterial.published_at.slice(0, 10)),
      current_revision_id: current.revision_id,
      current_revision_number: current.revision_number,
      current_update_summary: current.update_summary,
      latest_meaningful_activity: {
        revision_id: newestMaterial.revision_id,
        revision_number: newestMaterial.revision_number,
        published_at: newestMaterial.published_at,
        revision_category: newestMaterial.revision_category,
        update_summary: newestMaterial.update_summary,
      },
    },
    diagnostics: [],
  };
}
