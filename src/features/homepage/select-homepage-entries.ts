// Selects deterministic current Entry records for the Stage 1 Homepage.
import {
  compareResolvedPublicEntriesByLatestMaterialActivity,
  type ResolvedPublicEntry,
} from "../../domain";

const MAXIMUM_RECENT_HOMEPAGE_ENTRIES = 5;

export type HomepageEntrySelection = {
  latest_update: ResolvedPublicEntry;
  recent_entries: ResolvedPublicEntry[];
};

export type HomepagePresentationModel =
  | { kind: "entries"; selection: HomepageEntrySelection }
  | { kind: "private_preview_empty"; message: "No entries have been added yet." };

export type HomepagePresentationInput =
  | { mode: "production"; current_entries: readonly ResolvedPublicEntry[] }
  | { mode: "private_preview"; current_entries?: readonly ResolvedPublicEntry[] };

export function selectHomepageEntries(
  currentEntries: readonly ResolvedPublicEntry[],
): HomepageEntrySelection {
  if (currentEntries.length === 0) {
    throw new Error("The Stage 1 Homepage requires at least one valid current Entry.");
  }

  const orderedEntries = [...currentEntries].sort(
    compareResolvedPublicEntriesByLatestMaterialActivity,
  );
  const latestUpdate = orderedEntries[0];
  if (!latestUpdate) {
    throw new Error("The Stage 1 Homepage requires a Latest Update Entry.");
  }

  return {
    latest_update: latestUpdate,
    recent_entries: orderedEntries.slice(0, MAXIMUM_RECENT_HOMEPAGE_ENTRIES),
  };
}

export function createHomepagePresentationModel(
  input: HomepagePresentationInput,
): HomepagePresentationModel {
  if (input.mode === "private_preview" && (input.current_entries?.length ?? 0) === 0) {
    return { kind: "private_preview_empty", message: "No entries have been added yet." };
  }

  return {
    kind: "entries",
    selection: selectHomepageEntries(input.current_entries ?? []),
  };
}
