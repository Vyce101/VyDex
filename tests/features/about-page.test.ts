// Verifies canonical About projection and the non-promotable private-preview fallback.
import { beforeAll, describe, expect, test } from "vitest";
import { loadFixedMetadataDevelopmentApplicationRelease } from "../../src/adapters/application-release";
import { constructReleaseModel, type ResolvedAboutRecord } from "../../src/domain";
import { createAboutPagePresentationModel } from "../../src/features/about-page";
import {
  createLoadedCanonicalRecords,
  createValidReleaseMetadata,
} from "../domain/fixtures";

describe("About Page projection", () => {
  let about: ResolvedAboutRecord;

  beforeAll(async () => {
    const release = await loadFixedMetadataDevelopmentApplicationRelease({
      filesystem_root: process.cwd(),
      site_origin: "https://vydex.example",
    });
    about = release.about;
  });

  test("projects exact canonical content, ordered structures, and approved destinations", () => {
    const model = createAboutPagePresentationModel({ mode: "production", about });

    expect(model.kind).toBe("about");
    if (model.kind !== "about") return;
    expect(model.title).toBe("About VyDex");
    expect(model.header.lead_html).toBe(`<p>${about.header_lead}</p>`);
    expect(model.header.positioning).toBe(about.positioning);
    expect(model.header.maintainer_line_html).toBe(
      '<p>VyDex is maintained by <a href="https://www.linkedin.com/in/ljdaniels101/">Luke Daniels</a>, an independent builder in South Africa, also online as <a href="https://github.com/Vyce101">Vyce</a>.</p>',
    );
    expect(model.header.actions).toEqual([
      { label: "Read Latest Entries", href: "/#latest", treatment: "primary" },
      { label: "View Methodology", href: "/methodology/", treatment: "secondary" },
    ]);
    expect(model.methodology_href).toBe("/methodology/");
    expect(model.what_vydex_is_html).toEqual(about.what_vydex_is.map((value) => `<p>${value}</p>`));
    expect(model.why_vydex_exists_html).toEqual(
      about.why_vydex_exists.map((value) => `<p>${value}</p>`),
    );
    expect(model.who_runs_vydex_html).toEqual(
      about.who_runs_vydex.map((value) => `<p>${value}</p>`),
    );
    expect(model.scope_limits.introduction_html).toBe(
      `<p>${about.scope_limits.introduction}</p>`,
    );
    expect(model.scope_limits.rows.map(({ heading }) => heading)).toEqual([
      "Curated, Not Exhaustive",
      "English-Language Bias",
      "Verification Varies by Domain",
      "AI-Heavy Coverage",
      "Evidence Can Change",
    ]);
    expect(model.scope_limits.rows.map(({ explanation_html }) => explanation_html)).toEqual([
      `<p>${about.scope_limits.curated_not_exhaustive}</p>`,
      `<p>${about.scope_limits.english_language_bias}</p>`,
      `<p>${about.scope_limits.verification_varies_by_domain}</p>`,
      `<p>${about.scope_limits.ai_heavy_coverage}</p>`,
      `<p>${about.scope_limits.evidence_can_change}</p>`,
    ]);
    expect(model.coverage_baseline_html).toEqual(
      about.scope_limits.coverage_baseline.map((value) => `<p>${value}</p>`),
    );
    expect(model.carefulness.map(({ heading }) => heading)).toEqual([
      "Methodology",
      "Sources",
      "Updates",
    ]);
    expect(model.carefulness.map(({ explanation_html }) => explanation_html)).toEqual([
      `<p>${about.how_vydex_stays_careful.methodology}</p>`,
      `<p>${about.how_vydex_stays_careful.sources}</p>`,
      `<p>${about.how_vydex_stays_careful.updates}</p>`,
    ]);
    expect(model.related_links).toEqual([
      {
        ...about.related_links.methodology,
        url: "https://vydex.example/methodology/",
      },
      {
        ...about.related_links.changelog,
        url: "https://vydex.example/changelog/",
      },
      {
        ...about.related_links.export_json,
        url: "https://vydex.example/export/",
      },
    ]);
  });

  test("fails projection when the canonical maintainer identities cannot be linked safely", () => {
    const inconsistentAbout = structuredClone(about) as ResolvedAboutRecord;
    inconsistentAbout.maintainer_line = inconsistentAbout.maintainer_line.replace(
      inconsistentAbout.maintainer.public_alias,
      "a different alias",
    ) as ResolvedAboutRecord["maintainer_line"];

    expect(() =>
      createAboutPagePresentationModel({ mode: "production", about: inconsistentAbout }),
    ).toThrow(/maintainer name and public alias once/);
  });

  test("renders the approved fallback without promoting an incomplete private preview", () => {
    const records = createLoadedCanonicalRecords();
    Reflect.deleteProperty(records.about[0]!.value as Record<string, unknown>, "maintainer_line");
    const result = constructReleaseModel({
      records,
      release_metadata: createValidReleaseMetadata(),
      site_origin: "http://localhost:4321",
      mode: "preview",
    });

    expect(result.mode).toBe("preview");
    if (result.mode !== "preview") return;
    expect(result.preview.promotable).toBe(false);
    expect(result.preview.resolved.about).toBeUndefined();
    expect(result.preview.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "required_field",
        record_type: "about",
        path: ["maintainer_line"],
      }),
    );
    expect(
      createAboutPagePresentationModel({
        mode: "private_preview",
        about: result.preview.resolved.about,
      }),
    ).toEqual({
      kind: "private_preview_missing",
      message: "Maintainer details not added yet.",
    });
  });
});
