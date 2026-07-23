// Verifies deterministic Entry publication, semantic materiality, and immutable snapshots.
import { describe, expect, test } from "vitest";
import {
  entrySchema,
  methodologySchema,
  rfc3339UtcTimestampSchema,
  uuidV7Schema,
  type EntryRevisionCategory,
  type Materiality,
  type Methodology,
} from "../../src/domain/canonical-records";
import {
  entryMaterialChangePathSchema,
  publishEntryRevision,
  type EntryMaterialChangePath,
  type PublishEntryRevisionInput,
  type PublishedEntryRevision,
} from "../../src/domain/publication-revisions";
import { createValidEntry, createValidMethodology } from "./fixtures";

const REVISION_IDS = {
  first: uuidV7Schema.parse("01900000-0000-7000-8000-000000000008"),
  second: uuidV7Schema.parse("01900000-0000-7000-8000-000000000009"),
  third: uuidV7Schema.parse("01900000-0000-7000-8000-00000000000a"),
};

function createInitialInput(overrides: Partial<PublishEntryRevisionInput> = {}): PublishEntryRevisionInput {
  return {
    proposed_entry: entrySchema.parse(createValidEntry()),
    existing_snapshots: [],
    methodologies: [methodologySchema.parse(createValidMethodology())],
    revision_id: REVISION_IDS.first,
    published_at: rfc3339UtcTimestampSchema.parse("2026-07-21T20:15:30Z"),
    revision_category: "initial_publication",
    materiality: "material",
    update_summary: "Published the initial evidence record.",
    material_change_paths: [],
    ...overrides,
  };
}

function publishInitial(): PublishedEntryRevision {
  const result = publishEntryRevision(createInitialInput());
  expect(result.success).toBe(true);
  if (!result.success) throw new Error("Expected the initial fixture publication to succeed.");
  return result.data;
}

type LaterOptions = {
  revision_category?: EntryRevisionCategory;
  materiality?: Materiality;
  material_change_paths?: readonly EntryMaterialChangePath[];
  update_summary?: string;
  methodologies?: readonly Methodology[];
};

function publishLater(
  mutateEntry: (entry: ReturnType<typeof createValidEntry>) => void,
  options: LaterOptions = {},
) {
  const initial = publishInitial();
  const proposedValue = createValidEntry();
  mutateEntry(proposedValue);
  return publishEntryRevision({
    proposed_entry: entrySchema.parse(proposedValue),
    existing_snapshots: [initial.snapshot],
    methodologies: options.methodologies ?? [methodologySchema.parse(createValidMethodology())],
    revision_id: REVISION_IDS.second,
    published_at: rfc3339UtcTimestampSchema.parse("2026-07-22T20:15:30Z"),
    revision_category: options.revision_category ?? "non_material_correction",
    materiality: options.materiality ?? "non_material",
    update_summary: options.update_summary ?? "Corrected public wording.",
    material_change_paths: options.material_change_paths ?? [],
  });
}

function diagnosticCodes(result: ReturnType<typeof publishEntryRevision>): string[] {
  return result.success ? [] : result.diagnostics.map(({ code }) => code);
}

describe("material-change path contract", () => {
  test.each([
    "details",
    "details.context_changes_interpretation",
    "frontier_delta.previous_frontier",
    "caveats",
    "sources[source-3]",
    "methodology_id",
  ])("accepts %s", (path) => {
    expect(entryMaterialChangePathSchema.safeParse(path).success).toBe(true);
  });

  test.each(["id", "details.unknown", "sources[2]", "sources[]", "sources[source-3].url", "caveats[0]"])(
    "rejects %s",
    (path) => {
      expect(entryMaterialChangePathSchema.safeParse(path).success).toBe(false);
    },
  );
});

describe("Entry revision publication", () => {
  test("creates a complete initial snapshot with derived activity", () => {
    const result = publishEntryRevision(
      createInitialInput({
        update_summary: "  Published the initial evidence record.  ",
        material_change_paths: ["details", "sources[evaluation-paper]"],
      }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.snapshot).toMatchObject({
      revision_id: REVISION_IDS.first,
      revision_number: 1,
      methodology_public_version: "1.0.0",
      revision_category: "initial_publication",
      materiality: "material",
      update_summary: "Published the initial evidence record.",
    });
    expect(result.data.snapshot.entry).toEqual(entrySchema.parse(createValidEntry()));
    expect(result.data.activity).toMatchObject({
      date_added: "2026-07-21",
      date_updated: "2026-07-21",
      current_revision_id: REVISION_IDS.first,
      current_revision_number: 1,
    });
  });

  test("detaches and deeply freezes the snapshot without mutating caller inputs", () => {
    const entry = entrySchema.parse(createValidEntry());
    const input = createInitialInput({ proposed_entry: entry });
    const result = publishEntryRevision(input);

    expect(result.success).toBe(true);
    if (!result.success) return;
    Reflect.set(entry.details, "reader_takeaway", "Mutated after publication.");
    entry.sources[0]!.title = "Mutated source";
    expect(result.data.snapshot.entry.details.reader_takeaway).not.toBe("Mutated after publication.");
    expect(result.data.snapshot.entry.sources[0]!.title).toBe("Evaluation paper");
    expect(Object.isFrozen(result.data.snapshot)).toBe(true);
    expect(Object.isFrozen(result.data.snapshot.entry.details)).toBe(true);
    expect(Object.isFrozen(result.data.snapshot.entry.sources)).toBe(true);
    expect(input.existing_snapshots).toEqual([]);
  });

  test("increments from valid unsorted history and keeps old snapshots readable", () => {
    const first = publishInitial();
    const secondResult = publishLater(
      (entry) => {
        entry.title = "Corrected frontier result";
      },
    );
    expect(secondResult.success).toBe(true);
    if (!secondResult.success) return;
    const thirdEntry = createValidEntry();
    thirdEntry.title = "Corrected frontier result again";

    const thirdResult = publishEntryRevision({
      ...createInitialInput(),
      proposed_entry: entrySchema.parse(thirdEntry),
      existing_snapshots: [secondResult.data.snapshot, first.snapshot],
      revision_id: REVISION_IDS.third,
      published_at: rfc3339UtcTimestampSchema.parse("2026-07-23T20:15:30Z"),
      revision_category: "non_material_correction",
      materiality: "non_material",
      update_summary: "Corrected the title again.",
    });

    expect(thirdResult.success).toBe(true);
    if (!thirdResult.success) return;
    expect(thirdResult.data.snapshot.revision_number).toBe(3);
    expect(first.snapshot.revision_number).toBe(1);
    expect(first.snapshot.entry.title).toBe("Verified frontier result");
    expect(thirdResult.data.activity.date_updated).toBe("2026-07-21");
    expect(thirdResult.data.activity.current_update_summary).toBe("Corrected the title again.");
  });

  test.each(["claim_status", "evidence_strength", "entry_state", "confirmed_significance", "potential_significance_if_confirmed"] as const)(
    "rejects a non-material change to automatically material field %s",
    (field) => {
      const result = publishLater((entry) => {
        const replacements: Record<typeof field, unknown> = {
          claim_status: "supported",
          evidence_strength: "very_strong",
          entry_state: "removed",
          confirmed_significance: "A materially different confirmed significance.",
          potential_significance_if_confirmed: "A newly stated potential significance.",
        };
        Reflect.set(entry, field, replacements[field]);
      });

      expect(diagnosticCodes(result)).toContain("automatically_material_change_marked_non_material");
    },
  );

  test("accepts declared parent and child prose changes and rejects unchanged declarations", () => {
    const parent = publishLater(
      (entry) => {
        entry.details.context_changes_interpretation = "The complete context materially changes interpretation.";
      },
      {
        revision_category: "material_update",
        materiality: "material",
        material_change_paths: ["details"],
      },
    );
    expect(parent.success).toBe(true);

    const child = publishLater(
      (entry) => {
        entry.details.context_changes_interpretation = "The complete context materially changes interpretation.";
      },
      {
        revision_category: "material_update",
        materiality: "material",
        material_change_paths: ["details.context_changes_interpretation"],
      },
    );
    expect(child.success).toBe(true);

    const unchanged = publishLater(
      (entry) => {
        entry.title = "Corrected frontier result";
      },
      {
        revision_category: "material_update",
        materiality: "material",
        material_change_paths: ["details"],
      },
    );
    expect(diagnosticCodes(unchanged)).toContain("unchanged_material_change_path");
  });

  test("addresses source additions, removals, and modifications by citation ID", () => {
    const added = publishLater(
      (entry) => {
        entry.sources.push({
          citation_id: "source-3",
          title: "Additional source",
          publisher_or_domain: "Example Research",
          url: "https://example.com/additional",
          evidence_types: ["audit"],
          source_role: "context_source",
          used_for: "Adds material context.",
        });
      },
      {
        revision_category: "material_update",
        materiality: "material",
        material_change_paths: ["sources[source-3]"],
      },
    );
    expect(added.success).toBe(true);

    const removed = publishLater(
      (entry) => {
        entry.sources[0]!.citation_id = "replacement-source";
      },
      {
        revision_category: "material_update",
        materiality: "material",
        material_change_paths: ["sources[evaluation-paper]"],
      },
    );
    expect(removed.success).toBe(true);

    const modified = publishLater(
      (entry) => {
        entry.sources[0]!.url = "https://example.com/repaired-evaluation";
      },
      {
        revision_category: "material_update",
        materiality: "material",
        material_change_paths: ["sources[evaluation-paper]"],
      },
    );
    expect(modified.success).toBe(true);
  });

  test("does not treat otherwise identical source reordering as a semantic source change", () => {
    const initialEntry = createValidEntry();
    initialEntry.sources.push({
      citation_id: "source-3",
      title: "Additional source",
      publisher_or_domain: "Example Research",
      url: "https://example.com/additional",
      evidence_types: ["audit"],
      source_role: "context_source",
      used_for: "Adds context.",
    });
    const initialResult = publishEntryRevision(
      createInitialInput({ proposed_entry: entrySchema.parse(initialEntry) }),
    );
    expect(initialResult.success).toBe(true);
    if (!initialResult.success) return;

    const reorderedEntry = createValidEntry();
    reorderedEntry.sources.push(initialEntry.sources[1]!);
    reorderedEntry.sources.reverse();
    const baseInput = {
      ...createInitialInput(),
      proposed_entry: entrySchema.parse(reorderedEntry),
      existing_snapshots: [initialResult.data.snapshot],
      revision_id: REVISION_IDS.second,
      published_at: rfc3339UtcTimestampSchema.parse("2026-07-22T20:15:30Z"),
    };
    const correction = publishEntryRevision({
      ...baseInput,
      revision_category: "non_material_correction",
      materiality: "non_material",
    });
    expect(correction.success).toBe(true);

    const declared = publishEntryRevision({
      ...baseInput,
      revision_category: "material_update",
      materiality: "material",
      material_change_paths: ["sources[evaluation-paper]"],
    });
    expect(diagnosticCodes(declared)).toContain("unchanged_material_change_path");
  });

  test("accepts review scheduling updates and rejects review checks without a checked-date change", () => {
    const valid = publishLater(
      (entry) => {
        entry.date_last_checked = "2026-07-22";
        Reflect.set(entry, "next_check_date", "2026-09-01");
      },
      { revision_category: "review_check" },
    );
    expect(valid.success).toBe(true);

    const invalid = publishLater(
      (entry) => {
        Reflect.set(entry, "next_check_date", "2026-09-01");
      },
      { revision_category: "review_check" },
    );
    expect(diagnosticCodes(invalid)).toContain("review_check_requires_date_last_checked_change");
  });

  test("rejects no-op, unjustified material, contradictory, removal, and empty-summary publications", () => {
    expect(diagnosticCodes(publishLater(() => {}))).toContain("no_public_change");
    expect(
      diagnosticCodes(
        publishLater(
          (entry) => {
            entry.title = "Corrected title";
          },
          { revision_category: "material_update", materiality: "material" },
        ),
      ),
    ).toContain("material_update_without_material_change");
    expect(
      diagnosticCodes(
        publishLater(
          (entry) => {
            entry.details.reader_takeaway = "Material interpretation.";
          },
          { material_change_paths: ["details.reader_takeaway"] },
        ),
      ),
    ).toContain("declared_material_change_marked_non_material");
    expect(
      diagnosticCodes(
        publishLater(
          (entry) => {
            entry.title = "Removed title";
          },
          { revision_category: "removal", materiality: "material" },
        ),
      ),
    ).toContain("stage_1_removal_not_supported");
    expect(
      diagnosticCodes(
        publishLater(
          (entry) => {
            entry.title = "Corrected title";
          },
          { update_summary: "   " },
        ),
      ),
    ).toContain("required_value");
  });

  test("rejects conflicting revision history, revision IDs, and timestamps", () => {
    const initial = publishInitial();
    const proposed = entrySchema.parse({ ...createValidEntry(), title: "Corrected title" });
    const base = createInitialInput({
      proposed_entry: proposed,
      existing_snapshots: [initial.snapshot],
      revision_category: "non_material_correction",
      materiality: "non_material",
    });

    expect(diagnosticCodes(publishEntryRevision({ ...base, revision_id: initial.snapshot.revision_id }))).toContain(
      "duplicate_revision_id",
    );
    expect(
      diagnosticCodes(
        publishEntryRevision({
          ...base,
          revision_id: REVISION_IDS.second,
          published_at: initial.snapshot.published_at,
        }),
      ),
    ).toContain("revision_timestamp_order_conflict");
    expect(
      diagnosticCodes(
        publishEntryRevision({
          ...base,
          revision_id: REVISION_IDS.second,
          published_at: rfc3339UtcTimestampSchema.parse("2026-07-20T20:15:30Z"),
        }),
      ),
    ).toContain("revision_timestamp_order_conflict");
  });

  test("requires unique and exact Methodology references across current and historical revisions", () => {
    const methodology = methodologySchema.parse(createValidMethodology());
    const duplicate = publishEntryRevision(createInitialInput({ methodologies: [methodology, methodology] }));
    expect(diagnosticCodes(duplicate)).toContain("duplicate_methodology_id");

    const missing = publishEntryRevision(createInitialInput({ methodologies: [] }));
    expect(diagnosticCodes(missing)).toContain("unresolved_methodology");

    const initial = publishInitial();
    const oldMethodologyValue = createValidMethodology();
    oldMethodologyValue.public_version = "2.0.0";
    const wrongVersion = publishEntryRevision({
      ...createInitialInput(),
      proposed_entry: entrySchema.parse({ ...createValidEntry(), title: "Corrected title" }),
      existing_snapshots: [initial.snapshot],
      revision_id: REVISION_IDS.second,
      published_at: rfc3339UtcTimestampSchema.parse("2026-07-22T20:15:30Z"),
      revision_category: "non_material_correction",
      materiality: "non_material",
      methodologies: [methodologySchema.parse(oldMethodologyValue)],
    });
    expect(diagnosticCodes(wrongVersion)).toContain("snapshot_methodology_version_mismatch");
  });

  test("allows a declared Methodology change while resolving both historical versions", () => {
    const initial = publishInitial();
    const nextMethodologyValue = createValidMethodology();
    const nextMethodologyId = "01900000-0000-7000-8000-00000000000b";
    Reflect.set(nextMethodologyValue, "id", nextMethodologyId);
    nextMethodologyValue.public_version = "2.0.0";
    const nextMethodology = methodologySchema.parse(nextMethodologyValue);
    const proposedValue = createValidEntry();
    proposedValue.methodology_id = nextMethodologyId;

    const result = publishEntryRevision({
      ...createInitialInput(),
      proposed_entry: entrySchema.parse(proposedValue),
      existing_snapshots: [initial.snapshot],
      methodologies: [methodologySchema.parse(createValidMethodology()), nextMethodology],
      revision_id: REVISION_IDS.second,
      published_at: rfc3339UtcTimestampSchema.parse("2026-07-22T20:15:30Z"),
      revision_category: "material_update",
      materiality: "material",
      update_summary: "Applied Methodology version 2.0.0.",
      material_change_paths: ["methodology_id"],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.snapshot.methodology_id).toBe(nextMethodology.id);
    expect(result.data.snapshot.methodology_public_version).toBe("2.0.0");
  });

  test("returns structured diagnostics for malformed and duplicate material paths", () => {
    const malformed = publishEntryRevision(
      createInitialInput({ material_change_paths: ["sources[2]" as EntryMaterialChangePath] }),
    );
    expect(diagnosticCodes(malformed)).toContain("invalid_material_change_path");

    const duplicate = publishEntryRevision(
      createInitialInput({ material_change_paths: ["details", "details"] }),
    );
    expect(diagnosticCodes(duplicate)).toContain("duplicate_material_change_path");
  });
});
