// Verifies deterministic Topic Trail ordering and material-title stability.
import { describe, expect, test } from "vitest";
import {
  compareResolvedTopicTrailEntriesByLatestUpdates,
  constructReleaseModel,
  type ResolvedPublicEntry,
} from "../../src/domain";
import { createLoadedCanonicalRecords, createValidReleaseMetadata } from "./fixtures";

function createResolvedEntry(): ResolvedPublicEntry {
  const result = constructReleaseModel({
    records: createLoadedCanonicalRecords(),
    release_metadata: createValidReleaseMetadata(),
    site_origin: "https://vydex.example",
    mode: "production",
  });
  if (!result.success || result.mode !== "production") {
    throw new Error("Topic Trail ordering tests require a valid resolved Entry.");
  }
  return structuredClone(result.release.current_entries[0]!);
}

function withOrderingValues(input: {
  id: string;
  current_title?: string;
  material_title: string;
  material_activity: string;
  date_added: string;
}): ResolvedPublicEntry {
  const resolved = createResolvedEntry();
  resolved.entry.id = input.id as ResolvedPublicEntry["entry"]["id"];
  resolved.entry.title = input.current_title ?? input.material_title;
  resolved.activity.latest_meaningful_activity.entry_title = input.material_title;
  resolved.activity.latest_meaningful_activity.published_at =
    input.material_activity as ResolvedPublicEntry["activity"]["latest_meaningful_activity"]["published_at"];
  resolved.activity.date_added = input.date_added as ResolvedPublicEntry["activity"]["date_added"];
  return resolved;
}

function orderedIds(entries: readonly ResolvedPublicEntry[]): string[] {
  return [...entries]
    .sort(compareResolvedTopicTrailEntriesByLatestUpdates)
    .map(({ entry }) => entry.id);
}

describe("compareResolvedTopicTrailEntriesByLatestUpdates", () => {
  test("orders by material activity before every tie-breaker", () => {
    const older = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000010",
      material_title: "Alpha",
      material_activity: "2026-07-20T12:00:00Z",
      date_added: "2026-07-25",
    });
    const newer = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000011",
      material_title: "Zulu",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-19",
    });

    expect(orderedIds([older, newer])).toEqual([newer.entry.id, older.entry.id]);
  });

  test("uses Date Added when material activity timestamps match", () => {
    const earlier = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000010",
      material_title: "Alpha",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-19",
    });
    const later = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000011",
      material_title: "Zulu",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-20",
    });

    expect(orderedIds([earlier, later])).toEqual([later.entry.id, earlier.entry.id]);
  });

  test("uses the latest material title before immutable Entry ID", () => {
    const zulu = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000010",
      material_title: "Zulu result",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-20",
    });
    const alpha = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000011",
      material_title: "Alpha result",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-20",
    });

    expect(orderedIds([zulu, alpha])).toEqual([alpha.entry.id, zulu.entry.id]);
  });

  test("uses immutable Entry ID only after matching material titles", () => {
    const higherId = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000011",
      material_title: "Same result",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-20",
    });
    const lowerId = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000010",
      material_title: "Same result",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-20",
    });

    expect(orderedIds([higherId, lowerId])).toEqual([lowerId.entry.id, higherId.entry.id]);
  });

  test("ignores a later non-material correction to the current title and does not mutate input", () => {
    const corrected = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000011",
      current_title: "Zulu corrected wording",
      material_title: "Alpha material wording",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-20",
    });
    const other = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000010",
      material_title: "Beta material wording",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-20",
    });
    const input = [other, corrected];

    expect(orderedIds(input)).toEqual([corrected.entry.id, other.entry.id]);
    expect(input).toEqual([other, corrected]);
  });
});
