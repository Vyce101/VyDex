// Projects a validated resolved Entry into the reusable preview display contract.
import {
  CLAIM_STATUS_LABELS,
  DOMAIN_LABELS,
  EVIDENCE_STRENGTH_LABELS,
  REVIEW_STATUS_LABELS,
  calendarDateSchema,
  plainTextSchema,
  singleLineInlineMarkdownSchema,
  type Domain,
  type Entry,
  type ResolvedPublicEntry,
} from "../../domain";
import { renderEntryInlineMarkdown } from "../../shared/entry-markdown";

export type EntryPreviewSource = {
  entry: Pick<
    Entry,
    "title" | "claim" | "claim_status" | "evidence_strength" | "review_status"
  > & {
    domains: readonly Domain[];
  };
  activity: Pick<ResolvedPublicEntry["activity"], "date_updated">;
  canonical_url: ResolvedPublicEntry["canonical_url"];
  primary_topic_trail: Pick<ResolvedPublicEntry["primary_topic_trail"], "name" | "canonical_url">;
};

export type EntryPreviewViewModel = {
  domain_label: string;
  date_updated: string;
  title: string;
  claim_html: string;
  claim_status: { value: Entry["claim_status"]; label: string };
  evidence_strength: { value: Entry["evidence_strength"]; label: string };
  review_status: { value: Entry["review_status"]; label: string };
  primary_topic_trail: { name: string; canonical_url: string };
  canonical_url: string;
};

function requirePlainText(value: unknown, field: string): string {
  const result = plainTextSchema.safeParse(value);
  if (!result.success) throw new Error(`Entry preview requires ${field}.`);
  return result.data;
}

function requireCanonicalUrl(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`Entry preview requires ${field}.`);
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    throw new Error(`Entry preview requires a valid ${field}.`);
  }
  return value;
}

function requireMappedLabel<Value extends string>(
  value: unknown,
  labels: Readonly<Record<Value, string>>,
  field: string,
): { value: Value; label: string } {
  if (typeof value !== "string" || !Object.hasOwn(labels, value)) {
    throw new Error(`Entry preview requires a mapped ${field}.`);
  }
  const typedValue = value as Value;
  return { value: typedValue, label: labels[typedValue] };
}

export function projectEntryPreview(source: EntryPreviewSource): EntryPreviewViewModel {
  if (!source || typeof source !== "object") {
    throw new Error("Entry preview requires a validated source.");
  }

  const domain = source.entry?.domains?.[0];
  if (!domain || !Object.hasOwn(DOMAIN_LABELS, domain)) {
    throw new Error("Entry preview requires at least one mapped Domain.");
  }

  const dateUpdated = calendarDateSchema.safeParse(source.activity?.date_updated);
  if (!dateUpdated.success) throw new Error("Entry preview requires Date Updated.");

  const claim = singleLineInlineMarkdownSchema.safeParse(source.entry?.claim);
  if (!claim.success) throw new Error("Entry preview requires a valid claim.");

  return {
    domain_label: DOMAIN_LABELS[domain],
    date_updated: dateUpdated.data,
    title: requirePlainText(source.entry?.title, "an Entry title"),
    claim_html: renderEntryInlineMarkdown(claim.data),
    claim_status: requireMappedLabel(
      source.entry?.claim_status,
      CLAIM_STATUS_LABELS,
      "Claim Status",
    ),
    evidence_strength: requireMappedLabel(
      source.entry?.evidence_strength,
      EVIDENCE_STRENGTH_LABELS,
      "Evidence Strength",
    ),
    review_status: requireMappedLabel(
      source.entry?.review_status,
      REVIEW_STATUS_LABELS,
      "Review Status",
    ),
    primary_topic_trail: {
      name: requirePlainText(source.primary_topic_trail?.name, "a Topic Trail name"),
      canonical_url: requireCanonicalUrl(
        source.primary_topic_trail?.canonical_url,
        "Topic Trail canonical URL",
      ),
    },
    canonical_url: requireCanonicalUrl(source.canonical_url, "Entry canonical URL"),
  };
}
