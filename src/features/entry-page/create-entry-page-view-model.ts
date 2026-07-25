// Projects one resolved public Entry into the complete Entry Page display model.
import {
  CLAIM_STATUS_LABELS,
  DOMAIN_LABELS,
  EVIDENCE_STRENGTH_LABELS,
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_LABELS,
  REVIEW_STATUS_LABELS,
  SOURCE_ROLE_LABELS,
  type CalendarDate,
  type ClaimStatus,
  type ResolvedPublicEntry,
} from "../../domain";
import {
  renderEntryBlockMarkdown,
  renderEntryInlineMarkdown,
} from "../../shared/entry-markdown";
import {
  createMethodologySectionUrl,
  METHODOLOGY_SECTION_IDS,
} from "../../shared/methodology-navigation";

export type EntryPageDate = {
  iso: CalendarDate;
  label: string;
};

export type EntryPageLink = {
  label: string;
  url: string;
};

export type EntryPageViewModel = {
  title: string;
  claim_html: string;
  claim_status: { value: ClaimStatus; label: string };
  evidence_strength_label: string;
  review_status_label: string;
  review_reason: string | null;
  next_check_date: EntryPageDate | null;
  caution_notice: string | null;
  domains: string[];
  date_updated: EntryPageDate;
  primary_topic_trail: EntryPageLink;
  secondary_topic_trails: EntryPageLink[];
  methodology: { version: string; url: string };
  methodology_help_links: {
    domain: string;
    topic_trail: string;
    evidence_type: string;
    used_for: string;
    source_role: string;
    potential_significance: string;
    review_reason: string;
  };
  frontier_delta: {
    previous_frontier_html: string;
    new_claim_result_html: string;
    delta_html: string;
  };
  details: {
    what_happened_html: string;
    what_evidence_shows_html: string;
    context_changes_interpretation_html: string;
    reader_takeaway_html: string;
  };
  confirmed_significance_html: string;
  potential_significance_html: string | null;
  caveats_html: string[];
  metadata: {
    date_happened: EntryPageDate | null;
    date_disclosed: EntryPageDate | null;
    date_added: EntryPageDate;
    date_updated: EntryPageDate;
    date_last_checked: EntryPageDate;
    next_check_date: EntryPageDate | null;
    entry_state_label: "Main Entry";
    evidence_type_labels: string[];
  };
  sources: Array<{
    citation_id: string;
    title: string;
    publisher_or_domain: string;
    source_role_label: string;
    evidence_type_labels: string[];
    used_for: string;
    url: string;
  }>;
};

const CAUTION_NOTICES: Partial<Record<ClaimStatus, string>> = {
  reported_but_unverified: "This claim is reported but not independently verified.",
  disputed: "This claim is disputed. The evidence or interpretation is materially contested.",
  failed_retracted: "This claim has failed later review or been retracted.",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

function formatDate(value: CalendarDate): EntryPageDate {
  return {
    iso: value,
    label: dateFormatter.format(new Date(`${value}T00:00:00Z`)),
  };
}

function requireCanonicalUrl(value: string, field: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Entry Page requires a valid ${field}.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Entry Page requires a valid ${field}.`);
  }
  return value;
}

export function createEntryPageViewModel(source: ResolvedPublicEntry): EntryPageViewModel {
  if (source.entry.entry_state !== "main_entry") {
    throw new Error("Entry Page requires a current public Main Entry.");
  }

  const { entry } = source;
  const representedEvidenceTypes = new Set(entry.sources.flatMap(({ evidence_types }) => evidence_types));
  const evidenceTypeLabels = EVIDENCE_TYPES
    .filter((evidenceType) => representedEvidenceTypes.has(evidenceType))
    .map((evidenceType) => EVIDENCE_TYPE_LABELS[evidenceType]);
  const methodologyUrl = requireCanonicalUrl(
    source.methodology.canonical_url,
    "Methodology URL",
  );

  return {
    title: entry.title,
    claim_html: renderEntryInlineMarkdown(entry.claim),
    claim_status: {
      value: entry.claim_status,
      label: CLAIM_STATUS_LABELS[entry.claim_status],
    },
    evidence_strength_label: EVIDENCE_STRENGTH_LABELS[entry.evidence_strength],
    review_status_label: REVIEW_STATUS_LABELS[entry.review_status],
    review_reason: entry.review_status === "follow_up_needed" ? entry.review_reason : null,
    next_check_date: entry.next_check_date ? formatDate(entry.next_check_date) : null,
    caution_notice: CAUTION_NOTICES[entry.claim_status] ?? null,
    domains: entry.domains.map((domain) => DOMAIN_LABELS[domain]),
    date_updated: formatDate(source.activity.date_updated),
    primary_topic_trail: {
      label: source.primary_topic_trail.name,
      url: requireCanonicalUrl(source.primary_topic_trail.canonical_url, "Primary Topic Trail URL"),
    },
    secondary_topic_trails: source.secondary_topic_trails.map((trail) => ({
      label: trail.name,
      url: requireCanonicalUrl(trail.canonical_url, "secondary Topic Trail URL"),
    })),
    methodology: {
      version: source.methodology.public_version,
      url: methodologyUrl,
    },
    methodology_help_links: {
      domain: createMethodologySectionUrl(methodologyUrl, METHODOLOGY_SECTION_IDS.domains),
      topic_trail: createMethodologySectionUrl(
        methodologyUrl,
        METHODOLOGY_SECTION_IDS.topicTrails,
      ),
      evidence_type: createMethodologySectionUrl(
        methodologyUrl,
        METHODOLOGY_SECTION_IDS.evidenceTypes,
      ),
      used_for: createMethodologySectionUrl(methodologyUrl, METHODOLOGY_SECTION_IDS.usedFor),
      source_role: createMethodologySectionUrl(
        methodologyUrl,
        METHODOLOGY_SECTION_IDS.sourceRoles,
      ),
      potential_significance: createMethodologySectionUrl(
        methodologyUrl,
        METHODOLOGY_SECTION_IDS.significance,
      ),
      review_reason: createMethodologySectionUrl(
        methodologyUrl,
        METHODOLOGY_SECTION_IDS.reviewStatus,
      ),
    },
    frontier_delta: {
      previous_frontier_html: renderEntryBlockMarkdown(entry.frontier_delta.previous_frontier),
      new_claim_result_html: renderEntryBlockMarkdown(entry.frontier_delta.new_claim_result),
      delta_html: renderEntryBlockMarkdown(entry.frontier_delta.delta),
    },
    details: {
      what_happened_html: renderEntryBlockMarkdown(entry.details.what_happened),
      what_evidence_shows_html: renderEntryBlockMarkdown(entry.details.what_evidence_shows),
      context_changes_interpretation_html: renderEntryBlockMarkdown(
        entry.details.context_changes_interpretation,
      ),
      reader_takeaway_html: renderEntryBlockMarkdown(entry.details.reader_takeaway),
    },
    confirmed_significance_html: renderEntryBlockMarkdown(entry.confirmed_significance),
    potential_significance_html: entry.potential_significance_if_confirmed
      ? renderEntryBlockMarkdown(entry.potential_significance_if_confirmed)
      : null,
    caveats_html: entry.caveats.map(renderEntryInlineMarkdown),
    metadata: {
      date_happened: entry.date_happened ? formatDate(entry.date_happened) : null,
      date_disclosed: entry.date_disclosed ? formatDate(entry.date_disclosed) : null,
      date_added: formatDate(source.activity.date_added),
      date_updated: formatDate(source.activity.date_updated),
      date_last_checked: formatDate(entry.date_last_checked),
      next_check_date: entry.next_check_date ? formatDate(entry.next_check_date) : null,
      entry_state_label: "Main Entry",
      evidence_type_labels: evidenceTypeLabels,
    },
    sources: entry.sources.map((citation) => ({
      citation_id: citation.citation_id,
      title: citation.title,
      publisher_or_domain: citation.publisher_or_domain,
      source_role_label: SOURCE_ROLE_LABELS[citation.source_role],
      evidence_type_labels: citation.evidence_types.map(
        (evidenceType) => EVIDENCE_TYPE_LABELS[evidenceType],
      ),
      used_for: citation.used_for,
      url: citation.url,
    })),
  };
}
