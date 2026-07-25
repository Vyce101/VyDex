// Projects the resolved canonical About record into the static public page model.
import { STAGE_ONE_FIXED_PUBLIC_PATHS, type ResolvedAboutRecord } from "../../domain";
import { renderMethodologyMarkdown } from "../../shared/canonical-markdown";

const PRIVATE_PREVIEW_MESSAGE = "Maintainer details not added yet." as const;

const SCOPE_LIMIT_ROWS = [
  ["Curated, Not Exhaustive", "curated_not_exhaustive"],
  ["English-Language Bias", "english_language_bias"],
  ["Verification Varies by Domain", "verification_varies_by_domain"],
  ["AI-Heavy Coverage", "ai_heavy_coverage"],
  ["Evidence Can Change", "evidence_can_change"],
] as const;

const CAREFULNESS_CELLS = [
  ["Methodology", "methodology"],
  ["Sources", "sources"],
  ["Updates", "updates"],
] as const;

const RELATED_LINK_KEYS = ["methodology", "changelog", "export_json"] as const;

export type AboutPagePresentationInput =
  | { mode: "production"; about: ResolvedAboutRecord }
  | { mode: "private_preview"; about?: ResolvedAboutRecord };

export type AboutPageViewModel = {
  kind: "about";
  title: "About VyDex";
  header: {
    lead_html: string;
    positioning: string;
    maintainer_line_html: string;
    actions: readonly [
      { label: "Read Latest Entries"; href: string; treatment: "primary" },
      { label: "View Methodology"; href: string; treatment: "secondary" },
    ];
  };
  methodology_href: string;
  what_vydex_is_html: string[];
  why_vydex_exists_html: string[];
  who_runs_vydex_html: string[];
  scope_limits: {
    introduction_html: string;
    rows: Array<{ heading: string; explanation_html: string }>;
  };
  coverage_baseline_html: string[];
  carefulness: Array<{ heading: string; explanation_html: string }>;
  related_links: Array<{ title: string; description: string; url: string }>;
};

export type AboutPagePresentationModel =
  | AboutPageViewModel
  | { kind: "private_preview_missing"; message: typeof PRIVATE_PREVIEW_MESSAGE };

function renderAll(values: readonly string[]): string[] {
  return values.map(renderMethodologyMarkdown);
}

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

function renderLinkedMaintainerLine(about: ResolvedAboutRecord): string {
  const { maintainer, maintainer_line: maintainerLine } = about;
  const nameIndex = maintainerLine.indexOf(maintainer.name);
  const aliasIndex = maintainerLine.indexOf(
    maintainer.public_alias,
    nameIndex + maintainer.name.length,
  );
  const hasOneOrderedIdentityPair =
    nameIndex >= 0 &&
    aliasIndex > nameIndex &&
    countOccurrences(maintainerLine, maintainer.name) === 1 &&
    countOccurrences(maintainerLine, maintainer.public_alias) === 1;

  if (!hasOneOrderedIdentityPair) {
    throw new Error(
      "The canonical About maintainer line must contain the maintainer name and public alias once, in that order.",
    );
  }

  const beforeName = maintainerLine.slice(0, nameIndex);
  const betweenProfiles = maintainerLine.slice(nameIndex + maintainer.name.length, aliasIndex);
  const afterAlias = maintainerLine.slice(aliasIndex + maintainer.public_alias.length);
  const linkedLine = `${beforeName}[${maintainer.name}](${maintainer.linkedin_url})${betweenProfiles}[${maintainer.public_alias}](${maintainer.github_url})${afterAlias}`;

  return renderMethodologyMarkdown(linkedLine);
}

function createAboutPageViewModel(about: ResolvedAboutRecord): AboutPageViewModel {
  return {
    kind: "about",
    title: "About VyDex",
    header: {
      lead_html: renderMethodologyMarkdown(about.header_lead),
      positioning: about.positioning,
      maintainer_line_html: renderLinkedMaintainerLine(about),
      actions: [
        {
          label: "Read Latest Entries",
          href: STAGE_ONE_FIXED_PUBLIC_PATHS.latest,
          treatment: "primary",
        },
        {
          label: "View Methodology",
          href: STAGE_ONE_FIXED_PUBLIC_PATHS.methodology_current,
          treatment: "secondary",
        },
      ],
    },
    methodology_href: STAGE_ONE_FIXED_PUBLIC_PATHS.methodology_current,
    what_vydex_is_html: renderAll(about.what_vydex_is),
    why_vydex_exists_html: renderAll(about.why_vydex_exists),
    who_runs_vydex_html: renderAll(about.who_runs_vydex),
    scope_limits: {
      introduction_html: renderMethodologyMarkdown(about.scope_limits.introduction),
      rows: SCOPE_LIMIT_ROWS.map(([heading, key]) => ({
        heading,
        explanation_html: renderMethodologyMarkdown(about.scope_limits[key]),
      })),
    },
    coverage_baseline_html: renderAll(about.scope_limits.coverage_baseline),
    carefulness: CAREFULNESS_CELLS.map(([heading, key]) => ({
      heading,
      explanation_html: renderMethodologyMarkdown(about.how_vydex_stays_careful[key]),
    })),
    related_links: RELATED_LINK_KEYS.map((key) => ({
      title: about.related_links[key].title,
      description: about.related_links[key].description,
      url: about.related_links[key].url,
    })),
  };
}

export function createAboutPagePresentationModel(
  input: AboutPagePresentationInput,
): AboutPagePresentationModel {
  if (!input.about) {
    if (input.mode === "private_preview") {
      return { kind: "private_preview_missing", message: PRIVATE_PREVIEW_MESSAGE };
    }

    throw new Error("The production About Page requires a resolved canonical About record.");
  }

  return createAboutPageViewModel(input.about);
}
