// Verifies deterministic current Entry ordering for release and Homepage consumers.
import { describe, expect, test } from "vitest";
import {
  compareResolvedPublicEntriesByLatestMaterialActivity,
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
    throw new Error("Entry ordering tests require a valid resolved Entry.");
  }
  return structuredClone(result.release.current_entries[0]!);
}

function withOrderingValues(input: {
  id: string;
  title?: string;
  material_activity: string;
  date_added: string;
}): ResolvedPublicEntry {
  const resolved = createResolvedEntry();
  resolved.entry.id = input.id as ResolvedPublicEntry["entry"]["id"];
  resolved.entry.title = input.title ?? resolved.entry.title;
  resolved.activity.latest_meaningful_activity.published_at =
    input.material_activity as ResolvedPublicEntry["activity"]["latest_meaningful_activity"]["published_at"];
  resolved.activity.date_added = input.date_added as ResolvedPublicEntry["activity"]["date_added"];
  return resolved;
}

function orderedIds(entries: ResolvedPublicEntry[]): string[] {
  return [...entries]
    .sort(compareResolvedPublicEntriesByLatestMaterialActivity)
    .map(({ entry }) => entry.id);
}

describe("compareResolvedPublicEntriesByLatestMaterialActivity", () => {
  test("uses material activity timestamp as the dominant order", () => {
    const olderActivity = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000010",
      material_activity: "2026-07-20T12:00:00Z",
      date_added: "2026-07-25",
    });
    const newerActivity = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000011",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-19",
    });

    expect(orderedIds([olderActivity, newerActivity])).toEqual([newerActivity.entry.id, olderActivity.entry.id]);
  });

  test("uses Date Added when material activity timestamps are equal", () => {
    const earlierAddition = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000010",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-19",
    });
    const laterAddition = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000011",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-20",
    });

    expect(orderedIds([earlierAddition, laterAddition])).toEqual([laterAddition.entry.id, earlierAddition.entry.id]);
  });

  test("uses immutable Entry ID when both activity dates are equal", () => {
    const higherId = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000011",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-20",
    });
    const lowerId = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000010",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-20",
    });

    expect(orderedIds([higherId, lowerId])).toEqual([lowerId.entry.id, higherId.entry.id]);
  });

  test("does not let a title-only correction change ordering", () => {
    const first = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000010",
      title: "Zulu title",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-20",
    });
    const second = withOrderingValues({
      id: "01900000-0000-7000-8000-000000000011",
      title: "Alpha title",
      material_activity: "2026-07-21T12:00:00Z",
      date_added: "2026-07-20",
    });
    const beforeCorrection = orderedIds([second, first]);

    first.entry.title = "Alpha title";
    second.entry.title = "Zulu title";

    expect(orderedIds([second, first])).toEqual(beforeCorrection);
  });
});
