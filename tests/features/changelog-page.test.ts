// Verifies material-event projection, grouping, links, and production guards.
import { beforeAll, describe, expect, test } from "vitest";
import { loadFixedMetadataDevelopmentApplicationRelease } from "../../src/adapters/application-release";
import type { PublicChangelogEvent } from "../../src/domain";
import { createChangelogPageViewModel } from "../../src/features/changelog-page";

describe("Changelog Page projection", () => {
  let events: readonly PublicChangelogEvent[];

  beforeAll(async () => {
    const release = await loadFixedMetadataDevelopmentApplicationRelease({
      filesystem_root: process.cwd(),
      site_origin: "https://vydex.example",
    });
    events = release.changelog_events;
  });

  test("projects exact copy and groups the complete seed release by derived calendar date", () => {
    const model = createChangelogPageViewModel(events);

    expect(model).toMatchObject({
      title: "Changelog",
      intro: "Material changes to the VyDex evidence ledger.",
      explanation:
        "This page records new entries, meaningful updates, removals, and methodology changes.",
    });
    expect(model.change_types).toEqual([
      { type: "added", label: "Added", description: "New entry added to the ledger." },
      {
        type: "updated",
        label: "Updated",
        description: "Important source, status, evidence, caveat, context, or interpretation changed.",
      },
      {
        type: "removed",
        label: "Removed",
        description:
          "Entry removed because it no longer meets criteria or no longer supports the frontier interpretation.",
      },
      {
        type: "methodology_change",
        label: "Methodology Change",
        description: "Rules, labels, categories, or judgment standards changed.",
      },
    ]);
    expect(model.date_groups.map(({ date }) => date)).toEqual([
      "2026-08-03",
      "2026-07-30",
      "2026-07-25",
      "2026-07-24",
    ]);
    expect(model.date_groups.map(({ records }) => records.length)).toEqual([1, 1, 1, 4]);
    expect(model.date_groups[3]!.records.map(({ type }) => type)).toEqual([
      "added",
      "added",
      "added",
      "methodology_change",
    ]);
    expect(JSON.stringify(model)).not.toContain("published_at");
    expect(JSON.stringify(model)).not.toContain("T20:18:26Z");
  });

  test("preserves release ordering while grouping consecutive derived dates", () => {
    const methodology = events.find(({ type }) => type === "methodology_change")!;
    const added = events.find(({ type, date }) => type === "added" && date === methodology.date)!;
    const model = createChangelogPageViewModel([methodology, added]);

    expect(model.date_groups).toHaveLength(1);
    expect(model.date_groups[0]!.records.map(({ type }) => type)).toEqual([
      "methodology_change",
      "added",
    ]);
  });

  test("creates title-specific accessible links and omits legitimately unavailable links", () => {
    const methodology = events.find(({ type }) => type === "methodology_change")!;
    const added = structuredClone(
      events.find(({ type, date }) => type === "added" && date === methodology.date)!,
    );
    const linkedModel = createChangelogPageViewModel([added, methodology]);

    expect(linkedModel.date_groups[0]!.records[0]!.link).toEqual({
      href: added.canonical_url,
      label: "View Entry →",
      accessible_name: `View Entry: ${added.title}`,
    });
    expect(linkedModel.date_groups[0]!.records.at(-1)!.link).toEqual({
      href: methodology.canonical_url,
      label: "View Methodology →",
      accessible_name: `View Methodology: ${methodology.title}`,
    });

    Reflect.deleteProperty(added, "canonical_url");
    expect(createChangelogPageViewModel([added]).date_groups[0]!.records[0]!.link).toBeUndefined();
  });

  test("rejects empty, incomplete, inconsistent, or invalid-URL production events", () => {
    expect(() => createChangelogPageViewModel([])).toThrow("at least one material event");

    const missingTitle = structuredClone(events[0]!) as PublicChangelogEvent;
    Reflect.deleteProperty(missingTitle, "title");
    expect(() => createChangelogPageViewModel([missingTitle])).toThrow("event title");

    const missingTimestamp = structuredClone(events[0]!) as PublicChangelogEvent;
    Reflect.deleteProperty(missingTimestamp, "published_at");
    expect(() => createChangelogPageViewModel([missingTimestamp])).toThrow("publication timestamp");

    const inconsistentDate = structuredClone(events[0]!) as PublicChangelogEvent;
    inconsistentDate.date = "2026-07-23" as PublicChangelogEvent["date"];
    expect(() => createChangelogPageViewModel([inconsistentDate])).toThrow("dates derived");

    const invalidUrl = structuredClone(events[0]!) as PublicChangelogEvent;
    invalidUrl.canonical_url = "not-a-url" as PublicChangelogEvent["canonical_url"];
    expect(() => createChangelogPageViewModel([invalidUrl])).toThrow("affected-record URL");

    const emptyUrl = structuredClone(events[0]!) as PublicChangelogEvent;
    emptyUrl.canonical_url = "" as PublicChangelogEvent["canonical_url"];
    expect(() => createChangelogPageViewModel([emptyUrl])).toThrow("affected-record URL");
  });
});
