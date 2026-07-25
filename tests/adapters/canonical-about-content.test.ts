// Verifies the repository's canonical About content and blocking profile diagnostics.
import { beforeAll, describe, expect, test } from "vitest";
import { loadCanonicalRecords } from "../../src/adapters/canonical-record-loader";
import { aboutRecordSchema, type AboutRecord } from "../../src/domain/canonical-records";
import { constructReleaseModel } from "../../src/domain/release-construction";
import {
  createLoadedCanonicalRecords,
  createValidReleaseMetadata,
} from "../domain/fixtures";

const APPROVED_ABOUT_CONTENT = {
  header_lead: "VyDex tracks important frontier claims with evidence, caveats, sources, and updates.",
  positioning: "Not AI news. Not a hype feed.",
  maintainer_line:
    "VyDex is maintained by Luke Daniels, an independent builder in South Africa, also online as Vyce.",
  maintainer: {
    name: "Luke Daniels",
    public_alias: "Vyce",
    descriptor: "independent builder in South Africa",
    linkedin_url: "https://www.linkedin.com/in/ljdaniels101/",
    github_url: "https://github.com/Vyce101",
  },
  what_vydex_is: [
    "VyDex is a public evidence ledger for frontier claims. Each entry records the claim, the evidence behind it, the caveats, the sources used, and how the record has been updated.",
    "It is not AI news, a hype feed, a popularity ranking, or automatic coverage of every launch, paper, demo, or funding round.",
  ],
  why_vydex_exists: [
    "Frontier claims move quickly, but the evidence behind them is often scattered, uneven, or hard to verify quickly.",
    "VyDex started from private notes I was already keeping while tracking frontier AI claims. The public site exists because the same problem keeps showing up: important claims are spread across papers, demos, posts, filings, benchmarks, and news coverage, while much of the surrounding commentary is either too hype-driven or too hard to check.",
    "The goal is to give readers one careful place to see what changed, what the evidence supports, what remains uncertain, and how a topic is moving over time.",
  ],
  who_runs_vydex: [
    "VyDex is maintained by Luke Daniels, an independent builder in South Africa, also online as Vyce.",
    "This is a one-person project. I maintain the ledger, review sources, write entries, update the methodology, and decide what belongs in scope.",
  ],
  scope_limits: {
    introduction: "VyDex is designed to be careful, not exhaustive.",
    curated_not_exhaustive:
      "VyDex does not track every relevant claim, source, launch, paper, policy change, demo, or funding round.",
    english_language_bias:
      "VyDex may overrepresent English-language sources and sources that are easier to access or verify.",
    verification_varies_by_domain:
      "Some domains are easier to verify than others. Public benchmarks, filings, papers, and official records are easier to assess than private deployments or poorly documented claims.",
    ai_heavy_coverage:
      "VyDex tracks AI more heavily than slower-moving science domains, especially early in the project.",
    evidence_can_change:
      "Entries may be updated when new evidence, corrections, replications, disputes, or retractions appear.",
    coverage_baseline: [
      "Structured coverage begins in 2026.",
      "VyDex may include selected 2025 backfill entries, but backfill is not comprehensive and should not be read as a complete history of frontier acceleration before 2026.",
      "Earlier events may be referenced for context inside entries, but they are outside the structured coverage baseline unless they are explicitly added as backfill.",
    ],
  },
  how_vydex_stays_careful: {
    methodology: "Entries are judged against a public Methodology Version.",
    sources: "Sources show what VyDex used them for, not just where a link points.",
    updates: "The Changelog shows added entries, material updates, removals, and methodology changes.",
  },
  related_links: {
    methodology: {
      title: "Methodology",
      description: "How entries are included and judged.",
    },
    changelog: {
      title: "Changelog",
      description: "What changed in the ledger.",
    },
    export_json: {
      title: "Export JSON",
      description: "Download the latest accepted entry versions.",
    },
  },
};

function createRecordsWithAbout(about: unknown) {
  const records = createLoadedCanonicalRecords();
  records.about = [
    {
      record_type: "about",
      filename: "data/canonical-records/about/about.json",
      raw_text: JSON.stringify(about),
      value: about,
    },
  ];
  return records;
}

function constructProductionRelease(about: unknown) {
  return constructReleaseModel({
    records: createRecordsWithAbout(about),
    release_metadata: createValidReleaseMetadata(),
    site_origin: "https://vydex.vyce.workers.dev",
    mode: "production",
  });
}

describe("canonical About content", () => {
  let about: AboutRecord;

  beforeAll(async () => {
    const records = await loadCanonicalRecords({ filesystem_root: process.cwd() });
    expect(records.diagnostics).toEqual([]);
    expect(records.about).toHaveLength(1);
    about = aboutRecordSchema.parse(records.about[0]!.value);
  });

  test("stores the exact approved content and both approved profile URLs", () => {
    expect(about).toEqual(APPROVED_ABOUT_CONTENT);
  });

  test.each(["linkedin_url", "github_url"] as const)(
    "blocks a production release when maintainer.%s is missing",
    (profileField) => {
      const incompleteAbout = structuredClone(APPROVED_ABOUT_CONTENT);
      Reflect.deleteProperty(incompleteAbout.maintainer, profileField);

      const result = constructProductionRelease(incompleteAbout);

      expect(result.success).toBe(false);
      expect(result.mode).toBe("production");
      if (result.success || result.mode !== "production") return;
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          severity: "error",
          code: "required_field",
          record_type: "about",
          filename: "data/canonical-records/about/about.json",
          path: ["maintainer", profileField],
        }),
      );
    },
  );

  test("blocks a production release when the maintainer line is missing", () => {
    const incompleteAbout = structuredClone(APPROVED_ABOUT_CONTENT);
    Reflect.deleteProperty(incompleteAbout, "maintainer_line");

    const result = constructProductionRelease(incompleteAbout);

    expect(result.success).toBe(false);
    expect(result.mode).toBe("production");
    if (result.success || result.mode !== "production") return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "required_field",
        record_type: "about",
        filename: "data/canonical-records/about/about.json",
        path: ["maintainer_line"],
      }),
    );
  });

  test.each([
    "curated_not_exhaustive",
    "english_language_bias",
    "verification_varies_by_domain",
    "ai_heavy_coverage",
    "evidence_can_change",
  ] as const)("blocks a production release when scope_limits.%s is missing", (scopeLimit) => {
    const incompleteAbout = structuredClone(APPROVED_ABOUT_CONTENT);
    Reflect.deleteProperty(incompleteAbout.scope_limits, scopeLimit);

    const result = constructProductionRelease(incompleteAbout);

    expect(result.success).toBe(false);
    expect(result.mode).toBe("production");
    if (result.success || result.mode !== "production") return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "required_field",
        record_type: "about",
        filename: "data/canonical-records/about/about.json",
        path: ["scope_limits", scopeLimit],
      }),
    );
  });

  test("preserves the approved About content in the validated release", () => {
    const result = constructProductionRelease(about);

    expect(result.success).toBe(true);
    expect(result.mode).toBe("production");
    if (!result.success || result.mode !== "production") return;
    expect(result.release.about).toEqual({
      ...APPROVED_ABOUT_CONTENT,
      related_links: {
        methodology: {
          ...APPROVED_ABOUT_CONTENT.related_links.methodology,
          url: "https://vydex.vyce.workers.dev/methodology/",
        },
        changelog: {
          ...APPROVED_ABOUT_CONTENT.related_links.changelog,
          url: "https://vydex.vyce.workers.dev/changelog/",
        },
        export_json: {
          ...APPROVED_ABOUT_CONTENT.related_links.export_json,
          url: "https://vydex.vyce.workers.dev/export/",
        },
      },
    });
  });
});
