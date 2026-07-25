// Defines the deterministic public ordering for Entry source citations.
import {
  SOURCE_ROLES,
  type EntrySourceCitation,
} from "../canonical-records";

export function compareEntrySourcesByPublicOrder(
  left: EntrySourceCitation,
  right: EntrySourceCitation,
): number {
  const roleOrder = SOURCE_ROLES.indexOf(left.source_role) - SOURCE_ROLES.indexOf(right.source_role);
  return roleOrder !== 0 ? roleOrder : left.title.localeCompare(right.title, "en");
}

export function orderEntrySourcesForPublicDisplay(
  sources: readonly EntrySourceCitation[],
): EntrySourceCitation[] {
  return [...sources].sort(compareEntrySourcesByPublicOrder);
}
