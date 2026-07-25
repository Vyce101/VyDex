// Orders Topic Trail Entries by latest updates and stable material-revision tie-breakers.
import type { ResolvedPublicEntry } from "./types";

export function compareResolvedTopicTrailEntriesByLatestUpdates(
  left: ResolvedPublicEntry,
  right: ResolvedPublicEntry,
): number {
  const materialActivityOrder = right.activity.latest_meaningful_activity.published_at.localeCompare(
    left.activity.latest_meaningful_activity.published_at,
  );
  if (materialActivityOrder !== 0) return materialActivityOrder;

  const dateAddedOrder = right.activity.date_added.localeCompare(left.activity.date_added);
  if (dateAddedOrder !== 0) return dateAddedOrder;

  const materialTitleOrder = left.activity.latest_meaningful_activity.entry_title.localeCompare(
    right.activity.latest_meaningful_activity.entry_title,
    "en",
  );
  if (materialTitleOrder !== 0) return materialTitleOrder;

  if (left.entry.id < right.entry.id) return -1;
  if (left.entry.id > right.entry.id) return 1;
  return 0;
}
