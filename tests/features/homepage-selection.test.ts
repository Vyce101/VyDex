// Verifies fail-closed, non-mutating Stage 1 Homepage Entry selection.
import { describe, expect, test } from "vitest";
import { constructReleaseModel, type ResolvedPublicEntry } from "../../src/domain";
import {
  createHomepagePresentationModel,
  selectHomepageEntries,
} from "../../src/features/homepage";
import { createLoadedCanonicalRecords, createValidReleaseMetadata } from "../domain/fixtures";

function createResolvedEntry(sequence: number): ResolvedPublicEntry {
  const result = constructReleaseModel({
    records: createLoadedCanonicalRecords(),
    release_metadata: createValidReleaseMetadata(),
    site_origin: "https://vydex.example",
    mode: "production",
  });
  if (!result.success || result.mode !== "production") {
    throw new Error("Homepage selector tests require a valid resolved Entry.");
  }

  const resolved = structuredClone(result.release.current_entries[0]!);
  resolved.entry.id = `01900000-0000-7000-8000-${sequence.toString().padStart(12, "0")}` as ResolvedPublicEntry["entry"]["id"];
  resolved.activity.latest_meaningful_activity.published_at =
    `2026-07-${(10 + sequence).toString().padStart(2, "0")}T12:00:00Z` as ResolvedPublicEntry["activity"]["latest_meaningful_activity"]["published_at"];
  return resolved;
}

describe("selectHomepageEntries", () => {
  test("returns the latest Entry and caps the distinct recent Entries at five", () => {
    const input = [1, 2, 3, 4, 5, 6].map(createResolvedEntry).reverse();
    const originalOrder = input.map(({ entry }) => entry.id);

    const selection = selectHomepageEntries(input);

    expect(selection.latest_update.entry.id).toBe(input[0]?.entry.id);
    expect(selection.recent_entries).toHaveLength(5);
    expect(selection.recent_entries).not.toContain(selection.latest_update);
    expect(input.map(({ entry }) => entry.id)).toEqual(originalOrder);
  });

  test("returns only non-featured Entries when fewer than five are available", () => {
    const input = [1, 2, 3].map(createResolvedEntry);

    const selection = selectHomepageEntries(input);

    expect(selection.recent_entries).toHaveLength(2);
    expect(selection.recent_entries).not.toContain(selection.latest_update);
    expect(new Set([selection.latest_update, ...selection.recent_entries])).toEqual(new Set(input));
  });

  test("returns an empty recent list when the latest Entry is the only Entry", () => {
    const input = [createResolvedEntry(1)];

    const selection = selectHomepageEntries(input);

    expect(selection.latest_update).toBe(input[0]);
    expect(selection.recent_entries).toEqual([]);
  });

  test("keeps Homepage order when current wording changes without new material activity", () => {
    const older = createResolvedEntry(1);
    const newer = createResolvedEntry(2);
    const beforeCorrection = selectHomepageEntries([older, newer]).recent_entries.map(
      ({ entry }) => entry.id,
    );

    newer.entry.title = "Corrected non-material wording";
    const afterCorrection = selectHomepageEntries([newer, older]).recent_entries.map(
      ({ entry }) => entry.id,
    );

    expect(afterCorrection).toEqual(beforeCorrection);
  });

  test("fails closed for an empty production collection", () => {
    expect(() => selectHomepageEntries([])).toThrow("at least one valid current Entry");
    expect(() => createHomepagePresentationModel({ mode: "production", current_entries: [] })).toThrow(
      "at least one valid current Entry",
    );
  });

  test("provides the approved empty state only for private preview", () => {
    expect(createHomepagePresentationModel({ mode: "private_preview" })).toEqual({
      kind: "private_preview_empty",
      message: "No entries have been added yet.",
    });
  });
});
