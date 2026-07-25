// Verifies uniform material-event ordering across every public Changelog type.
import { describe, expect, test } from "vitest";
import { comparePublicChangelogEvents } from "../../src/domain/release-construction/derive-changelog";
import type { PublicChangelogEvent } from "../../src/domain";

const IDS = {
  entryA: "01900000-0000-7000-8000-000000000101",
  entryB: "01900000-0000-7000-8000-000000000102",
  eventA: "01900000-0000-7000-8000-000000000201",
  eventB: "01900000-0000-7000-8000-000000000202",
  methodology: "01900000-0000-7000-8000-000000000301",
} as const;

function createEntryEvent(input: {
  type: "added" | "updated" | "removed";
  title: string;
  sourceIdentity: string;
}): PublicChangelogEvent {
  return {
    type: input.type,
    date: "2026-07-24",
    published_at: "2026-07-24T20:18:26Z",
    title: input.title,
    summary: "Recorded a material change.",
    source_identity: input.sourceIdentity,
    entry_id: IDS.entryA,
  } as PublicChangelogEvent;
}

function createMethodologyEvent(): PublicChangelogEvent {
  return {
    type: "methodology_change",
    date: "2026-07-24",
    published_at: "2026-07-24T20:18:26Z",
    title: "Shared title",
    summary: "Published a material Methodology change.",
    source_identity: IDS.methodology,
    methodology_id: IDS.methodology,
    canonical_url: "https://vydex.example/methodology/1.0.0/",
  } as PublicChangelogEvent;
}

describe("comparePublicChangelogEvents", () => {
  test("uses the approved type order when exact timestamps are tied", () => {
    const events = [
      createEntryEvent({ type: "removed", title: "Shared title", sourceIdentity: IDS.eventA }),
      createEntryEvent({ type: "updated", title: "Shared title", sourceIdentity: IDS.eventA }),
      createEntryEvent({ type: "added", title: "Shared title", sourceIdentity: IDS.eventA }),
      createMethodologyEvent(),
    ];

    expect(events.sort(comparePublicChangelogEvents).map(({ type }) => type)).toEqual([
      "methodology_change",
      "added",
      "updated",
      "removed",
    ]);
  });

  test("uses title and immutable identity as deterministic remaining fallbacks", () => {
    const events = [
      createEntryEvent({ type: "added", title: "Zulu title", sourceIdentity: IDS.eventA }),
      createEntryEvent({ type: "added", title: "Alpha title", sourceIdentity: IDS.eventB }),
      createEntryEvent({ type: "added", title: "Alpha title", sourceIdentity: IDS.eventA }),
    ];

    expect(events.sort(comparePublicChangelogEvents).map(({ title, source_identity }) => [
      title,
      source_identity,
    ])).toEqual([
      ["Alpha title", IDS.eventA],
      ["Alpha title", IDS.eventB],
      ["Zulu title", IDS.eventA],
    ]);
  });

  test("produces the same order for every input array order", () => {
    const events = [
      createEntryEvent({ type: "updated", title: "Beta title", sourceIdentity: IDS.eventB }),
      createEntryEvent({ type: "added", title: "Alpha title", sourceIdentity: IDS.eventA }),
      createMethodologyEvent(),
    ];
    const expected = [...events].sort(comparePublicChangelogEvents);

    expect([...events].reverse().sort(comparePublicChangelogEvents)).toEqual(expected);
    expect([events[1]!, events[2]!, events[0]!].sort(comparePublicChangelogEvents)).toEqual(expected);
  });
});
