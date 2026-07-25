// Projects the resolved canonical Methodology into the complete public rulebook model.
import {
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
  DOMAINS,
  DOMAIN_LABELS,
  ENTRY_STATES,
  EVIDENCE_STRENGTHS,
  EVIDENCE_STRENGTH_LABELS,
  EVIDENCE_STRENGTH_SCORES,
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_LABELS,
  METHODOLOGY_VERSION_TYPES,
  REVIEW_STATUSES,
  REVIEW_STATUS_LABELS,
  SOURCE_ROLES,
  SOURCE_ROLE_LABELS,
  methodologySchema,
  type ResolvedMethodology,
} from "../../domain";
import { renderMethodologyMarkdown } from "../../shared/canonical-markdown";
import {
  METHODOLOGY_JUMP_LINKS,
  METHODOLOGY_SECTION_IDS,
  type MethodologySectionId,
} from "../../shared/methodology-navigation";

type DefinitionRow = {
  label: string;
  meaning_html: string;
};

export type MethodologyPageViewModel = {
  title: string;
  intro_html: string;
  version: {
    label: string;
    url: string;
    effective_date: string;
    type_label: string;
  };
  section_ids: typeof METHODOLOGY_SECTION_IDS;
  jump_links: readonly { label: string; id: MethodologySectionId; href: `#${string}` }[];
  inclusion_rule_html: string[];
  inclusion_standard: {
    opening_html: string;
    checks_html: string[];
    included_example_html: string;
    excluded_example_html: string;
  };
  claim_appraisal: { opening_html: string; questions_html: string[] };
  public_labels: {
    intro_html: string;
    claim_statuses: Array<DefinitionRow & { value: string; ui_treatment: string }>;
    evidence_strength_intro_html: string;
    evidence_strengths: Array<
      DefinitionRow & { score: number; typical_evidence_html: string }
    >;
    review_status_intro_html: string;
    review_statuses: Array<DefinitionRow & { when_used_html: string }>;
    review_reason_html: string;
    entry_states: DefinitionRow[];
  };
  entry_fields: {
    frontier_delta: {
      definition_html: string;
      previous_frontier_html: string;
      new_claim_result_html: string;
      delta_html: string;
    };
    significance: {
      confirmed_html: string;
      potential_html: string;
    };
    caveats: { definition_html: string; examples_html: string[] };
  };
  sources: {
    intro_html: string;
    evidence_types: DefinitionRow[];
    used_for: {
      definition_html: string;
      public_statement_html: string;
      example_html: string;
    };
    source_roles: DefinitionRow[];
    source_role_distinction_html: string;
    source_ordering_html: string;
  };
  dates: {
    fields: DefinitionRow[];
    evidence_monitoring_html: string;
    review_triggers_html: string[];
  };
  taxonomy: {
    topic_trails: {
      definition_html: string;
      rules_html: string[];
      naming_rule_html: string;
      good_examples_html: string[];
      bad_examples_html: string[];
    };
    domains: DefinitionRow[];
  };
  entry_titles: {
    rule_html: string;
    pattern_html: string;
    hype_word_rule_html: string;
    examples_html: string[];
  };
  versioning: {
    introduction_html: string;
    definitions: DefinitionRow[];
    closing_line_html: string;
  };
};

const CLAIM_STATUS_UI_TREATMENTS = {
  confirmed: "Neutral label",
  supported: "Neutral label",
  provisional: "Neutral label",
  reported_but_unverified: "Quiet caution",
  disputed: "Medium caution",
  failed_retracted: "Strongest negative treatment",
} as const;

const VERSION_TYPE_LABELS = {
  major: "Major",
  minor: "Minor",
  patch: "Patch",
} as const;

const DATE_FIELDS = [
  ["Date Happened", "date_happened"],
  ["Date Disclosed", "date_disclosed"],
  ["Date Added", "date_added"],
  ["Date Updated", "date_updated"],
  ["Date Last Checked", "date_last_checked"],
  ["Next Check Date", "next_check_date"],
] as const;

const METHODOLOGY_RENDERED_SECTION_IDS = Object.freeze([
  METHODOLOGY_SECTION_IDS.inclusionStandard,
  METHODOLOGY_SECTION_IDS.claimAppraisal,
  METHODOLOGY_SECTION_IDS.claimStatus,
  METHODOLOGY_SECTION_IDS.evidenceStrength,
  METHODOLOGY_SECTION_IDS.reviewStatus,
  METHODOLOGY_SECTION_IDS.entryState,
  METHODOLOGY_SECTION_IDS.frontierDelta,
  METHODOLOGY_SECTION_IDS.significance,
  METHODOLOGY_SECTION_IDS.caveats,
  METHODOLOGY_SECTION_IDS.sourcesAndEvidenceTypes,
  METHODOLOGY_SECTION_IDS.evidenceTypes,
  METHODOLOGY_SECTION_IDS.usedFor,
  METHODOLOGY_SECTION_IDS.sourceRoles,
  METHODOLOGY_SECTION_IDS.datesAndEvidenceMonitoring,
  METHODOLOGY_SECTION_IDS.topicTrails,
  METHODOLOGY_SECTION_IDS.domains,
  METHODOLOGY_SECTION_IDS.entryTitles,
  METHODOLOGY_SECTION_IDS.versioning,
] as const);

function renderAll(values: readonly string[]): string[] {
  return values.map(renderMethodologyMarkdown);
}

export function assertMethodologyAnchorContract(
  jumpLinks: readonly { id: MethodologySectionId }[],
  renderedSectionIds: readonly MethodologySectionId[],
): void {
  const ids = Object.values(METHODOLOGY_SECTION_IDS);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Methodology section IDs must be unique.");
  }

  const renderedIds = new Set(renderedSectionIds);
  for (const jumpLink of jumpLinks) {
    if (!renderedIds.has(jumpLink.id)) {
      throw new Error(`Methodology Jump To target is missing: ${jumpLink.id}.`);
    }
  }
}

export function createMethodologyPageViewModel(
  source: ResolvedMethodology,
): MethodologyPageViewModel {
  assertMethodologyAnchorContract(METHODOLOGY_JUMP_LINKS, METHODOLOGY_RENDERED_SECTION_IDS);
  const methodology = methodologySchema.parse(source.methodology);
  const { content } = methodology;

  return {
    title: methodology.title,
    intro_html: renderMethodologyMarkdown(methodology.intro),
    version: {
      label: `v${methodology.public_version}`,
      url: source.version_url,
      effective_date: methodology.effective_date,
      type_label: VERSION_TYPE_LABELS[methodology.version_type],
    },
    section_ids: METHODOLOGY_SECTION_IDS,
    jump_links: METHODOLOGY_JUMP_LINKS.map((link) => ({
      ...link,
      href: `#${link.id}` as const,
    })),
    inclusion_rule_html: renderAll(content.inclusion_rule.paragraphs),
    inclusion_standard: {
      opening_html: renderMethodologyMarkdown(content.inclusion_standard.opening),
      checks_html: renderAll(content.inclusion_standard.checks),
      included_example_html: renderMethodologyMarkdown(content.inclusion_standard.included_example),
      excluded_example_html: renderMethodologyMarkdown(content.inclusion_standard.excluded_example),
    },
    claim_appraisal: {
      opening_html: renderMethodologyMarkdown(content.claim_appraisal.opening),
      questions_html: renderAll(content.claim_appraisal.questions),
    },
    public_labels: {
      intro_html: renderMethodologyMarkdown(content.public_labels.intro),
      claim_statuses: CLAIM_STATUSES.map((status) => ({
        value: status,
        label: CLAIM_STATUS_LABELS[status],
        meaning_html: renderMethodologyMarkdown(
          content.public_labels.claim_status_definitions[status],
        ),
        ui_treatment: CLAIM_STATUS_UI_TREATMENTS[status],
      })),
      evidence_strength_intro_html: renderMethodologyMarkdown(
        content.public_labels.evidence_strength.intro,
      ),
      evidence_strengths: EVIDENCE_STRENGTHS.map((strength) => ({
        label: EVIDENCE_STRENGTH_LABELS[strength],
        score: EVIDENCE_STRENGTH_SCORES[strength],
        meaning_html: renderMethodologyMarkdown(
          content.public_labels.evidence_strength.definitions[strength].meaning,
        ),
        typical_evidence_html: renderMethodologyMarkdown(
          content.public_labels.evidence_strength.definitions[strength].typical_evidence,
        ),
      })),
      review_status_intro_html: renderMethodologyMarkdown(content.public_labels.review_status.intro),
      review_statuses: REVIEW_STATUSES.map((status) => ({
        label: REVIEW_STATUS_LABELS[status],
        meaning_html: renderMethodologyMarkdown(
          content.public_labels.review_status.definitions[status].meaning,
        ),
        when_used_html: renderMethodologyMarkdown(
          content.public_labels.review_status.definitions[status].used_when,
        ),
      })),
      review_reason_html: renderMethodologyMarkdown(
        content.public_labels.review_status.review_reason_definition,
      ),
      entry_states: ENTRY_STATES.map((state) => ({
        label: state === "main_entry" ? "Main Entry" : "Removed",
        meaning_html: renderMethodologyMarkdown(
          content.public_labels.entry_state_definitions[state],
        ),
      })),
    },
    entry_fields: {
      frontier_delta: {
        definition_html: renderMethodologyMarkdown(content.entry_fields.frontier_delta.definition),
        previous_frontier_html: renderMethodologyMarkdown(
          content.entry_fields.frontier_delta.previous_frontier,
        ),
        new_claim_result_html: renderMethodologyMarkdown(
          content.entry_fields.frontier_delta.new_claim_result,
        ),
        delta_html: renderMethodologyMarkdown(content.entry_fields.frontier_delta.delta),
      },
      significance: {
        confirmed_html: renderMethodologyMarkdown(
          content.entry_fields.significance.confirmed_significance,
        ),
        potential_html: renderMethodologyMarkdown(
          content.entry_fields.significance.potential_significance_if_confirmed,
        ),
      },
      caveats: {
        definition_html: renderMethodologyMarkdown(content.entry_fields.caveats.definition),
        examples_html: renderAll(content.entry_fields.caveats.examples),
      },
    },
    sources: {
      intro_html: renderMethodologyMarkdown(content.sources_and_evidence_types.intro),
      evidence_types: EVIDENCE_TYPES.map((evidenceType) => ({
        label: EVIDENCE_TYPE_LABELS[evidenceType],
        meaning_html: renderMethodologyMarkdown(
          content.sources_and_evidence_types.evidence_type_definitions[evidenceType],
        ),
      })),
      used_for: {
        definition_html: renderMethodologyMarkdown(
          content.sources_and_evidence_types.used_for.definition,
        ),
        public_statement_html: renderMethodologyMarkdown(
          content.sources_and_evidence_types.used_for.public_statement,
        ),
        example_html: renderMethodologyMarkdown(content.sources_and_evidence_types.used_for.example),
      },
      source_roles: SOURCE_ROLES.map((sourceRole) => ({
        label: SOURCE_ROLE_LABELS[sourceRole],
        meaning_html: renderMethodologyMarkdown(
          content.sources_and_evidence_types.source_role_definitions[sourceRole],
        ),
      })),
      source_role_distinction_html: renderMethodologyMarkdown(
        content.sources_and_evidence_types.source_role_vs_evidence_type,
      ),
      source_ordering_html: renderMethodologyMarkdown(
        content.sources_and_evidence_types.source_ordering,
      ),
    },
    dates: {
      fields: DATE_FIELDS.map(([label, key]) => ({
        label,
        meaning_html: renderMethodologyMarkdown(
          content.dates_and_evidence_monitoring.date_definitions[key],
        ),
      })),
      evidence_monitoring_html: renderMethodologyMarkdown(
        content.dates_and_evidence_monitoring.evidence_monitoring,
      ),
      review_triggers_html: renderAll(content.dates_and_evidence_monitoring.review_triggers),
    },
    taxonomy: {
      topic_trails: {
        definition_html: renderMethodologyMarkdown(
          content.topic_trails_and_domains.topic_trails.definition,
        ),
        rules_html: renderAll(content.topic_trails_and_domains.topic_trails.rules),
        naming_rule_html: renderMethodologyMarkdown(
          content.topic_trails_and_domains.topic_trails.naming_rule,
        ),
        good_examples_html: renderAll(
          content.topic_trails_and_domains.topic_trails.good_examples,
        ),
        bad_examples_html: renderAll(content.topic_trails_and_domains.topic_trails.bad_examples),
      },
      domains: DOMAINS.map((domain) => ({
        label: DOMAIN_LABELS[domain],
        meaning_html: renderMethodologyMarkdown(
          content.topic_trails_and_domains.domain_definitions[domain],
        ),
      })),
    },
    entry_titles: {
      rule_html: renderMethodologyMarkdown(content.entry_titles.rule),
      pattern_html: renderMethodologyMarkdown(content.entry_titles.pattern),
      hype_word_rule_html: renderMethodologyMarkdown(content.entry_titles.hype_word_rule),
      examples_html: renderAll(content.entry_titles.examples),
    },
    versioning: {
      introduction_html: renderMethodologyMarkdown(content.versioning.introduction),
      definitions: METHODOLOGY_VERSION_TYPES.map((versionType) => ({
        label: VERSION_TYPE_LABELS[versionType],
        meaning_html: renderMethodologyMarkdown(content.versioning.definitions[versionType]),
      })),
      closing_line_html: renderMethodologyMarkdown(content.versioning.closing_line),
    },
  };
}
