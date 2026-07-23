// Verifies intrinsic revision-history validation and derived material activity.
import { describe, expect, test } from "vitest";
import {
  entryPublicationSnapshotSchema,
  type EntryPublicationSnapshot,
} from "../../src/domain/canonical-records";
import { deriveEntryRevisionActivity } from "../../src/domain/material-activity";
import { createValidEntry, createValidSnapshot } from "./fixtures";

const REVISION_IDS = [
  "01900000-0000-7000-8000-000000000005",
  "01900000-0000-7000-8000-000000000008",
  "01900000-0000-7000-8000-000000000009",
] as const;

function createSnapshot(
  revisionNumber: number,
  overrides: Partial<EntryPublicationSnapshot> = {},
): EntryPublicationSnapshot {
  const entry = createValidEntry();
  entry.title = `Verified frontier result revision ${revisionNumber}`;
  return entryPublicationSnapshotSchema.parse({
    ...createValidSnapshot(),
    revision_id: REVISION_IDS[revisionNumber - 1],
    revision_number: revisionNumber,
    published_at: `2026-07-${20 + revisionNumber}T20:15:30Z`,
    revision_category: revisionNumber === 1 ? "initial_publication" : "material_update",
    materiality: "material",
    update_summary: `Published revision ${revisionNumber}.`,
    entry,
    ...overrides,
  });
}

function diagnosticCodes(result: ReturnType<typeof deriveEntryRevisionActivity>): string[] {
  return result.success ? [] : result.diagnostics.map(({ code }) => code);
}

describe("Entry revision activity", () => {
  test("derives current and meaningful activity by revision order without mutating input order", () => {
    const first = createSnapshot(1);
    const second = createSnapshot(2);
    const thirdEntry = createValidEntry();
    thirdEntry.title = "Corrected frontier result wording";
    const third = createSnapshot(3, {
      revision_category: "non_material_correction",
      materiality: "non_material",
      update_summary: "Corrected title wording.",
      entry: entryPublicationSnapshotSchema.parse({ ...createValidSnapshot(), entry: thirdEntry }).entry,
    });
    const input = [third, first, second];

    const result = deriveEntryRevisionActivity(input);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(input.map(({ revision_number }) => revision_number)).toEqual([3, 1, 2]);
    expect(result.data).toEqual({
      date_added: "2026-07-21",
      date_updated: "2026-07-22",
      current_revision_id: REVISION_IDS[2],
      current_revision_number: 3,
      current_update_summary: "Corrected title wording.",
      latest_meaningful_activity: {
        revision_id: REVISION_IDS[1],
        revision_number: 2,
        published_at: "2026-07-22T20:15:30Z",
        revision_category: "material_update",
        update_summary: "Published revision 2.",
      },
    });
  });

  test("rejects empty, discontinuous, duplicate, and mixed-identity histories", () => {
    expect(diagnosticCodes(deriveEntryRevisionActivity([]))).toContain("empty_revision_history");

    const startsAtTwo = createSnapshot(1);
    startsAtTwo.revision_number = 2;
    expect(diagnosticCodes(deriveEntryRevisionActivity([startsAtTwo]))).toContain(
      "revision_sequence_must_start_at_one",
    );

    const first = createSnapshot(1);
    const third = createSnapshot(3);
    expect(diagnosticCodes(deriveEntryRevisionActivity([first, third]))).toContain(
      "non_contiguous_revision_numbers",
    );

    const duplicateId = createSnapshot(2, { revision_id: first.revision_id });
    expect(diagnosticCodes(deriveEntryRevisionActivity([first, duplicateId]))).toContain(
      "duplicate_revision_id",
    );

    const duplicateNumber = createSnapshot(2);
    duplicateNumber.revision_number = 1;
    expect(diagnosticCodes(deriveEntryRevisionActivity([first, duplicateNumber]))).toContain(
      "duplicate_revision_number",
    );

    const otherEntry = createSnapshot(2);
    otherEntry.entry_id = "01900000-0000-7000-8000-000000000007" as typeof otherEntry.entry_id;
    otherEntry.entry.id = otherEntry.entry_id;
    expect(diagnosticCodes(deriveEntryRevisionActivity([first, otherEntry]))).toContain(
      "history_entry_id_mismatch",
    );
  });

  test("requires publication timestamps to increase strictly with revision number", () => {
    const first = createSnapshot(1);
    const equal = createSnapshot(2, { published_at: first.published_at });
    const earlier = createSnapshot(2, { published_at: "2026-07-20T20:15:30Z" as typeof first.published_at });

    expect(diagnosticCodes(deriveEntryRevisionActivity([first, equal]))).toContain(
      "revision_timestamp_order_conflict",
    );
    expect(diagnosticCodes(deriveEntryRevisionActivity([first, earlier]))).toContain(
      "revision_timestamp_order_conflict",
    );
  });

  test("validates stored category, materiality, automatic changes, review checks, and no-op revisions", () => {
    const first = createSnapshot(1);
    const wrongInitial = createSnapshot(1, { revision_category: "material_update" });
    expect(diagnosticCodes(deriveEntryRevisionActivity([wrongInitial]))).toContain(
      "invalid_initial_revision_category",
    );

    const automaticEntry = createValidEntry();
    automaticEntry.claim_status = "supported";
    const automaticCorrection = createSnapshot(2, {
      revision_category: "non_material_correction",
      materiality: "non_material",
      entry: entryPublicationSnapshotSchema.parse({ ...createValidSnapshot(), entry: automaticEntry }).entry,
    });
    expect(diagnosticCodes(deriveEntryRevisionActivity([first, automaticCorrection]))).toContain(
      "automatically_material_change_marked_non_material",
    );

    const noOp = createSnapshot(2, { entry: first.entry });
    expect(diagnosticCodes(deriveEntryRevisionActivity([first, noOp]))).toContain("no_public_change");

    const reviewEntry = createValidEntry();
    Reflect.set(reviewEntry, "next_check_date", "2026-09-01");
    const invalidReview = createSnapshot(2, {
      revision_category: "review_check",
      materiality: "non_material",
      entry: entryPublicationSnapshotSchema.parse({ ...createValidSnapshot(), entry: reviewEntry }).entry,
    });
    expect(diagnosticCodes(deriveEntryRevisionActivity([first, invalidReview]))).toContain(
      "review_check_requires_date_last_checked_change",
    );
  });

  test("keeps historical material updates readable when their transient declaration is unavailable", () => {
    const first = createSnapshot(1);
    const proseEntry = createValidEntry();
    proseEntry.details.reader_takeaway = "Updated interpretation based on the complete evidence record.";
    const semanticUpdate = createSnapshot(2, {
      entry: entryPublicationSnapshotSchema.parse({ ...createValidSnapshot(), entry: proseEntry }).entry,
    });

    expect(deriveEntryRevisionActivity([first, semanticUpdate]).success).toBe(true);
    expect(entryPublicationSnapshotSchema.safeParse(first).success).toBe(true);
  });
});
