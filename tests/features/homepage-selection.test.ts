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
  test("returns the latest Entry, caps recent Entries at five, and keeps Latest in the list", () => {
    const input = [1, 2, 3, 4, 5, 6].map(createResolvedEntry).reverse();
    const originalOrder = input.map(({ entry }) => entry.id);

    const selection = selectHomepageEntries(input);

    expect(selection.latest_update.entry.id).toBe(input[0]?.entry.id);
    expect(selection.recent_entries).toHaveLength(5);
    expect(selection.recent_entries[0]).toBe(selection.latest_update);
    expect(input.map(({ entry }) => entry.id)).toEqual(originalOrder);
  });

  test("returns only real Entries when fewer than five are available", () => {
    const input = [1, 2, 3].map(createResolvedEntry);

    const selection = selectHomepageEntries(input);

    expect(selection.recent_entries).toHaveLength(3);
    expect(new Set(selection.recent_entries)).toEqual(new Set(input));
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
