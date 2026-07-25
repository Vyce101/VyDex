// Verifies Topic Trail page projection, fail-closed production data, and preview fallbacks.
import { describe, expect, test } from "vitest";
import {
  constructReleaseModel,
  type ResolvedTopicTrail,
} from "../../src/domain";
import {
  TOPIC_TRAIL_PREVIEW_FALLBACKS,
  createTopicTrailPagePresentationModel,
} from "../../src/features/topic-trail-page";
import {
  createLoadedCanonicalRecords,
  createValidReleaseMetadata,
  createValidSnapshot,
} from "../domain/fixtures";

function createResolvedTrail(): ResolvedTopicTrail {
  const result = constructReleaseModel({
    records: createLoadedCanonicalRecords(),
    release_metadata: createValidReleaseMetadata(),
    site_origin: "https://vydex.example",
    mode: "production",
  });
  if (!result.success || result.mode !== "production") {
    throw new Error("Topic Trail page tests require a valid resolved trail.");
  }
  return result.release.topic_trails.find(
    ({ topic_trail }) => topic_trail.slug === "frontier-evaluations",
  )!;
}

describe("createTopicTrailPagePresentationModel", () => {
  test("projects exact public metadata and preserves one-entry trails without mutation", () => {
    const trail = createResolvedTrail();
    const original = structuredClone(trail);

    const model = createTopicTrailPagePresentationModel({ mode: "production", trail });

    expect(model).toMatchObject({
      kind: "topic_trail",
      is_private_preview: false,
      name: "Frontier Evaluations",
      description: "Tracks evaluations that test a defined frontier capability threshold",
      metadata: {
        entry_count: 1,
        last_activity: { iso: "2026-07-21", label: "2026-07-21" },
        default_order: "Latest Updates",
      },
      methodology_href: "/methodology/#topic-trails",
      entry_preview_topic_trail: {
        name: "Frontier Evaluations",
        canonical_url: "https://vydex.example/topic-trails/frontier-evaluations/",
      },
    });
    expect(model.entries).toHaveLength(1);
    expect(model.entries[0]).toBe(trail.entries[0]);
    expect(trail).toEqual(original);
  });

  test("fails closed when required production values are inconsistent", () => {
    const missingName = structuredClone(createResolvedTrail()) as ResolvedTopicTrail;
    Reflect.deleteProperty(missingName.topic_trail, "name");
    expect(() =>
      createTopicTrailPagePresentationModel({ mode: "production", trail: missingName }),
    ).toThrow("Trail Name");

    const missingDescription = structuredClone(createResolvedTrail()) as ResolvedTopicTrail;
    Reflect.deleteProperty(missingDescription.topic_trail, "description");
    expect(() =>
      createTopicTrailPagePresentationModel({ mode: "production", trail: missingDescription }),
    ).toThrow("one-sentence description");

    const empty = structuredClone(createResolvedTrail()) as ResolvedTopicTrail;
    empty.entries = [];
    empty.entry_count = 0;
    expect(() =>
      createTopicTrailPagePresentationModel({ mode: "production", trail: empty }),
    ).toThrow("at least one public Entry");

    const unknownActivity = structuredClone(createResolvedTrail()) as ResolvedTopicTrail;
    Reflect.deleteProperty(unknownActivity.last_activity, "published_at");
    expect(() =>
      createTopicTrailPagePresentationModel({ mode: "production", trail: unknownActivity }),
    ).toThrow(/Last Activity/);

    const inconsistentCount = structuredClone(createResolvedTrail()) as ResolvedTopicTrail;
    inconsistentCount.entry_count = 2;
    expect(() =>
      createTopicTrailPagePresentationModel({ mode: "production", trail: inconsistentCount }),
    ).toThrow("accurate Entry count");
  });

  test("surfaces approved fallbacks from a non-promotable missing-field preview", () => {
    const records = createLoadedCanonicalRecords();
    const partialTrail = records.topic_trails[0]!.value as {
      name?: string;
      description?: string;
    };
    Reflect.deleteProperty(partialTrail, "name");
    const result = constructReleaseModel({
      records,
      release_metadata: createValidReleaseMetadata(),
      site_origin: "http://localhost:4321",
      mode: "preview",
    });

    expect(result.mode).toBe("preview");
    if (result.mode !== "preview") return;
    expect(result.preview.promotable).toBe(false);
    expect(result.preview.resolved.routes).toBeUndefined();
    expect(result.preview.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "required_field",
        record_type: "topic_trail",
        path: ["name"],
      }),
    );

    const model = createTopicTrailPagePresentationModel({
      mode: "private_preview",
      trail: { topic_trail: partialTrail },
    });
    expect(model.name).toBe(TOPIC_TRAIL_PREVIEW_FALLBACKS.missing_required_field);
    expect(model.description).toBe(partialTrail.description);
    expect(model.metadata.last_activity).toBeNull();
    expect(TOPIC_TRAIL_PREVIEW_FALLBACKS.unknown_last_activity).toBe("Unknown");
    expect(model.entries).toEqual([]);
  });

  test("keeps unknown activity non-promotable and presentation-only", () => {
    const records = createLoadedCanonicalRecords();
    const snapshot = records.entry_publication_snapshots[0]!.value as ReturnType<
      typeof createValidSnapshot
    >;
    snapshot.materiality = "non_material";
    const result = constructReleaseModel({
      records,
      release_metadata: createValidReleaseMetadata(),
      site_origin: "http://localhost:4321",
      mode: "preview",
    });

    expect(result.mode).toBe("preview");
    if (result.mode !== "preview") return;
    expect(result.preview.promotable).toBe(false);
    expect(result.preview.diagnostics).toContainEqual(
      expect.objectContaining({ code: "revision_materiality_mismatch" }),
    );
    expect(result.preview.resolved.topic_trails).toBeUndefined();

    const model = createTopicTrailPagePresentationModel({
      mode: "private_preview",
      trail: {
        topic_trail: {
          name: "Frontier Evaluations",
          description: "Tracks evaluations that test a defined frontier capability threshold",
        },
      },
    });
    expect(model.metadata.last_activity).toBeNull();
    expect(JSON.stringify(result.preview)).not.toContain("Last Activity: Unknown");
  });
});
