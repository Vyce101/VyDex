// Orders resolved public Entries by material activity, addition date, and immutable identity.
import type { ResolvedPublicEntry } from "./types";

export function compareResolvedPublicEntriesByLatestMaterialActivity(
  left: ResolvedPublicEntry,
  right: ResolvedPublicEntry,
): number {
  const materialActivityOrder = right.activity.latest_meaningful_activity.published_at.localeCompare(
    left.activity.latest_meaningful_activity.published_at,
  );
  if (materialActivityOrder !== 0) return materialActivityOrder;

  const dateAddedOrder = right.activity.date_added.localeCompare(left.activity.date_added);
  if (dateAddedOrder !== 0) return dateAddedOrder;

  if (left.entry.id < right.entry.id) return -1;
  if (left.entry.id > right.entry.id) return 1;
  return 0;
}
