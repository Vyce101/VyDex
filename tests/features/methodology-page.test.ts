// Verifies projection of canonical Methodology content into the complete public rulebook model.
import { beforeAll, describe, expect, test } from "vitest";
import { loadFixedMetadataDevelopmentApplicationRelease } from "../../src/adapters/application-release";
import type { ResolvedMethodology } from "../../src/domain";
import {
  assertMethodologyAnchorContract,
  createMethodologyPageViewModel,
} from "../../src/features/methodology-page";
import {
  METHODOLOGY_JUMP_LINKS,
  METHODOLOGY_SECTION_IDS,
} from "../../src/shared/methodology-navigation";

describe("Methodology Page projection", () => {
  let methodology: ResolvedMethodology;

  beforeAll(async () => {
    const release = await loadFixedMetadataDevelopmentApplicationRelease({
      filesystem_root: process.cwd(),
      site_origin: "https://vydex.example",
    });
    methodology = release.methodology;
  });

  test("projects exact version metadata, canonical wording, and exhaustive controlled rows", () => {
    const model = createMethodologyPageViewModel(methodology);

    expect(model.title).toBe("Methodology");
    expect(model.version).toEqual({
      label: "v1.0.0",
      url: "https://vydex.example/methodology/1.0.0/",
      effective_date: "2026-07-24",
      type_label: "Major",
    });
    expect(model.public_labels.review_reason_html).toBe(
      "<p>Review Reason explains why an Entry is marked Follow-Up Needed and identifies the evidence, uncertainty, or review trigger that warrants another review.</p>",
    );
    expect(model.public_labels.claim_statuses.map(({ label }) => label)).toEqual([
      "Confirmed",
      "Supported",
      "Provisional",
      "Reported But Unverified",
      "Disputed",
      "Failed / Retracted",
    ]);
    expect(
      model.public_labels.evidence_strengths.map(({ label, score }) => [label, score]),
    ).toEqual([
      ["Thin", 1],
      ["Moderate", 2],
      ["Strong", 3],
      ["Very Strong", 4],
    ]);
    expect(model.sources.evidence_types).toHaveLength(12);
    expect(model.sources.source_roles).toHaveLength(6);
    expect(model.taxonomy.domains).toHaveLength(12);
    expect(model.versioning.definitions.map(({ label }) => label)).toEqual([
      "Major",
      "Minor",
      "Patch",
    ]);
  });

  test("exposes the exact ordered Jump To contract with resolvable stable IDs", () => {
    const model = createMethodologyPageViewModel(methodology);

    expect(model.jump_links).toEqual(
      METHODOLOGY_JUMP_LINKS.map((link) => ({ ...link, href: `#${link.id}` })),
    );
    expect(new Set(Object.values(model.section_ids)).size).toBe(
      Object.values(METHODOLOGY_SECTION_IDS).length,
    );
  });

  test("rejects a Jump To link whose rendered target is absent", () => {
    expect(() =>
      assertMethodologyAnchorContract(METHODOLOGY_JUMP_LINKS, [
        METHODOLOGY_SECTION_IDS.inclusionStandard,
      ]),
    ).toThrow(/Jump To target is missing/);
  });

  test.each([
    ["effective date", (record: Record<string, unknown>) => Reflect.deleteProperty(record, "effective_date")],
    [
      "Evidence Type definition",
      (record: Record<string, unknown>) => {
        const content = record.content as Record<string, unknown>;
        const sources = content.sources_and_evidence_types as Record<string, unknown>;
        const definitions = sources.evidence_type_definitions as Record<string, unknown>;
        Reflect.deleteProperty(definitions, "preprint");
      },
    ],
  ])("rejects a Methodology missing its %s", (_label, removeRequiredValue) => {
    const incomplete = structuredClone(methodology) as unknown as {
      methodology: Record<string, unknown>;
    };
    removeRequiredValue(incomplete.methodology);
    expect(() => createMethodologyPageViewModel(incomplete as unknown as ResolvedMethodology)).toThrow();
  });
});
