// Builds complete valid canonical records for focused domain validation tests.
import {
  CLAIM_STATUSES,
  DOMAINS,
  ENTRY_STATES,
  EVIDENCE_STRENGTHS,
  EVIDENCE_TYPES,
  METHODOLOGY_VERSION_TYPES,
  REVIEW_STATUSES,
  SOURCE_ROLES,
} from "../../src/domain/canonical-records";

export const IDS = {
  entry: "01900000-0000-7000-8000-000000000001",
  topicTrail: "01900000-0000-7000-8000-000000000002",
  secondaryTopicTrail: "01900000-0000-7000-8000-000000000003",
  methodology: "01900000-0000-7000-8000-000000000004",
  snapshot: "01900000-0000-7000-8000-000000000005",
  release: "01900000-0000-7000-8000-000000000006",
  alternateEntry: "01900000-0000-7000-8000-000000000007",
} as const;

function definitions(keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, `${key.replaceAll("_", " ")} definition.`]));
}

export function createValidEntry() {
  return {
    id: IDS.entry as string,
    slug: "verified-frontier-result",
    aliases: ["earlier-frontier-result"],
    title: "  Verified frontier result  ",
    claim: "The result **crosses** the defined threshold.",
    claim_status: "confirmed" as string,
    evidence_strength: "strong" as string,
    review_status: "stable" as string,
    review_reason: null as string | null,
    entry_state: "main_entry" as string,
    domains: ["ai_evaluation", "ai_capabilities"],
    primary_topic_trail_id: IDS.topicTrail as string,
    secondary_topic_trail_ids: [IDS.secondaryTopicTrail] as string[],
    methodology_id: IDS.methodology as string,
    date_happened: "2026-01-15",
    date_disclosed: null,
    date_last_checked: "2026-07-21",
    next_check_date: null,
    frontier_delta: {
      previous_frontier: "Earlier systems did not pass the complete evaluation.",
      new_claim_result: "The evaluated system passed every required component.",
      delta: "This adds evidence for a previously unmet capability threshold.",
    },
    details: {
      what_happened: "The evaluation was completed under the published protocol.",
      what_evidence_shows: "Results and artifacts support the stated outcome.",
      context_changes_interpretation: "The result applies only to the evaluated scope.",
      reader_takeaway: "The threshold is supported within the documented limits.",
    },
    confirmed_significance: "The result establishes a documented capability advance.",
    potential_significance_if_confirmed: null as string | null,
    caveats: ["The result applies to the **published** evaluation scope."],
    sources: [
      {
        citation_id: "evaluation-paper",
        title: "Evaluation paper",
        publisher_or_domain: "Example Research",
        url: "https://example.com/evaluation",
        evidence_types: ["peer_reviewed_paper", "technical_artifact"],
        source_role: "primary_evidence",
        used_for: "Supports the result and evaluation scope.",
      },
    ],
  };
}

export function createValidTopicTrail() {
  return {
    id: IDS.topicTrail,
    slug: "frontier-evaluations",
    aliases: [],
    name: "Frontier Evaluations",
    description: "Tracks evaluations that test a defined frontier capability threshold",
  };
}

export function createValidSecondaryTopicTrail() {
  return {
    id: IDS.secondaryTopicTrail,
    slug: "ai-capability-thresholds",
    aliases: ["capability-thresholds"],
    name: "AI Capability Thresholds",
    description: "Tracks evidence for threshold-crossing AI capabilities",
  };
}

export function createValidMethodology() {
  const methodologyValue = "Complete methodology prose with an [official link](https://example.com/methodology).";

  return {
    id: IDS.methodology,
    public_version: "1.0.0",
    version_type: "major",
    effective_date: "2026-01-01",
    title: "VyDex Public Methodology",
    intro: methodologyValue,
    content: {
      inclusion_rule: {
        paragraphs: [methodologyValue, methodologyValue],
      },
      inclusion_standard: {
        opening: methodologyValue,
        checks: [methodologyValue, methodologyValue, methodologyValue, methodologyValue],
        included_example: methodologyValue,
        excluded_example: methodologyValue,
      },
      claim_appraisal: {
        opening: methodologyValue,
        questions: [
          methodologyValue,
          methodologyValue,
          methodologyValue,
          methodologyValue,
          methodologyValue,
          methodologyValue,
        ],
      },
      public_labels: {
        intro: methodologyValue,
        claim_status_definitions: definitions(CLAIM_STATUSES),
        evidence_strength: {
          intro: methodologyValue,
          definitions: Object.fromEntries(
            EVIDENCE_STRENGTHS.map((key) => [
              key,
              { meaning: methodologyValue, typical_evidence: methodologyValue },
            ]),
          ),
        },
        review_status: {
          intro: methodologyValue,
          definitions: Object.fromEntries(
            REVIEW_STATUSES.map((key) => [key, { meaning: methodologyValue, used_when: methodologyValue }]),
          ),
          review_reason_definition: methodologyValue,
        },
        entry_state_definitions: definitions(ENTRY_STATES),
      },
      entry_fields: {
        frontier_delta: {
          definition: methodologyValue,
          previous_frontier: methodologyValue,
          new_claim_result: methodologyValue,
          delta: methodologyValue,
        },
        significance: {
          confirmed_significance: methodologyValue,
          potential_significance_if_confirmed: methodologyValue,
        },
        caveats: {
          definition: methodologyValue,
          examples: [methodologyValue],
        },
      },
      sources_and_evidence_types: {
        intro: methodologyValue,
        evidence_type_definitions: definitions(EVIDENCE_TYPES),
        used_for: {
          definition: methodologyValue,
          public_statement: methodologyValue,
          example: methodologyValue,
        },
        source_ordering: methodologyValue,
        source_role_definitions: definitions(SOURCE_ROLES),
        source_role_vs_evidence_type: methodologyValue,
      },
      dates_and_evidence_monitoring: {
        date_definitions: {
          date_happened: methodologyValue,
          date_disclosed: methodologyValue,
          date_added: methodologyValue,
          date_updated: methodologyValue,
          date_last_checked: methodologyValue,
          next_check_date: methodologyValue,
        },
        evidence_monitoring: methodologyValue,
        review_triggers: [methodologyValue],
      },
      topic_trails_and_domains: {
        topic_trails: {
          definition: methodologyValue,
          rules: [methodologyValue],
          naming_rule: methodologyValue,
          good_examples: [methodologyValue],
          bad_examples: [methodologyValue],
        },
        domain_definitions: definitions(DOMAINS),
      },
      entry_titles: {
        rule: methodologyValue,
        pattern: methodologyValue,
        hype_word_rule: methodologyValue,
        examples: [methodologyValue, methodologyValue],
      },
      versioning: {
        introduction: methodologyValue,
        definitions: definitions(METHODOLOGY_VERSION_TYPES),
        closing_line: methodologyValue,
      },
    },
  };
}

export function createValidSnapshot() {
  return {
    revision_id: IDS.snapshot as string,
    entry_id: IDS.entry as string,
    revision_number: 1,
    published_at: "2026-07-21T20:15:30Z",
    methodology_id: IDS.methodology as string,
    methodology_public_version: "1.0.0",
    revision_category: "initial_publication" as string,
    materiality: "material",
    update_summary: "Published the initial evidence record.",
    entry: createValidEntry(),
  };
}

export function createValidReleaseMetadata() {
  return {
    release_id: IDS.release,
    generated_at: "2026-07-21T20:30:00.123Z",
  };
}

export function createValidRecordSetInput() {
  return {
    entries: [{ filename: "entry.json", value: createValidEntry() }],
    topic_trails: [
      { filename: "frontier-evaluations.json", value: createValidTopicTrail() },
      { filename: "ai-capability-thresholds.json", value: createValidSecondaryTopicTrail() },
    ],
    methodologies: [{ filename: "methodology.json", value: createValidMethodology() }],
    entry_publication_snapshots: [{ filename: "entry-r1.json", value: createValidSnapshot() }],
    release_metadata: [{ filename: "release.json", value: createValidReleaseMetadata() }],
  };
}
