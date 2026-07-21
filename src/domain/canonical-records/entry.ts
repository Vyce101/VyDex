// Defines Entry and entry-local source citation contracts with semantic field rules.
import { z } from "zod";
import {
  claimStatusSchema,
  domainSchema,
  entryStateSchema,
  evidenceStrengthSchema,
  evidenceTypeSchema,
  reviewStatusSchema,
  sourceRoleSchema,
} from "./controlled-values";
import {
  blockMarkdownSchema,
  inlineMarkdownSchema,
  plainTextSchema,
  reviewReasonSchema,
  singleLineInlineMarkdownSchema,
} from "./markdown";
import { calendarDateSchema, slugSchema, sourceUrlSchema, uuidV7Schema } from "./primitives";
import { addDuplicateValueIssues } from "./unique-values";

const POTENTIAL_SIGNIFICANCE_STATUSES = new Set(["provisional", "reported_but_unverified", "disputed"]);
const POTENTIAL_SIGNIFICANCE_EVIDENCE_TYPES = new Set([
  "preprint",
  "developer_vendor_claim",
  "leaked_internal_claim",
]);

export const entrySourceCitationSchema = z
  .strictObject({
    citation_id: slugSchema,
    title: plainTextSchema,
    publisher_or_domain: plainTextSchema,
    url: sourceUrlSchema,
    evidence_types: z.array(evidenceTypeSchema).min(1, { error: "At least one Evidence Type is required." }),
    source_role: sourceRoleSchema,
    used_for: plainTextSchema,
  })
  .superRefine((source, context) => {
    addDuplicateValueIssues(context, source.evidence_types, ["evidence_types"], "Evidence Type");
  });
export type EntrySourceCitation = z.infer<typeof entrySourceCitationSchema>;

const frontierDeltaSchema = z.strictObject({
  previous_frontier: blockMarkdownSchema,
  new_claim_result: blockMarkdownSchema,
  delta: blockMarkdownSchema,
});

const entryDetailsSchema = z.strictObject({
  what_happened: blockMarkdownSchema,
  what_evidence_shows: blockMarkdownSchema,
  context_changes_interpretation: blockMarkdownSchema,
  reader_takeaway: blockMarkdownSchema,
});

export const entrySchema = z
  .strictObject({
    id: uuidV7Schema,
    slug: slugSchema,
    aliases: z.array(slugSchema),
    title: plainTextSchema,
    claim: singleLineInlineMarkdownSchema,
    claim_status: claimStatusSchema,
    evidence_strength: evidenceStrengthSchema,
    review_status: reviewStatusSchema,
    review_reason: z.union([reviewReasonSchema, z.null()]),
    entry_state: entryStateSchema,
    domains: z.array(domainSchema).min(1, { error: "At least one Domain is required." }),
    primary_topic_trail_id: uuidV7Schema,
    secondary_topic_trail_ids: z.array(uuidV7Schema),
    methodology_id: uuidV7Schema,
    date_happened: z.union([calendarDateSchema, z.null()]),
    date_disclosed: z.union([calendarDateSchema, z.null()]),
    date_last_checked: calendarDateSchema,
    next_check_date: z.union([calendarDateSchema, z.null()]),
    frontier_delta: frontierDeltaSchema,
    details: entryDetailsSchema,
    confirmed_significance: blockMarkdownSchema,
    potential_significance_if_confirmed: z.union([blockMarkdownSchema, z.null()]),
    caveats: z.array(inlineMarkdownSchema).min(1, { error: "At least one Caveat is required." }),
    sources: z.array(entrySourceCitationSchema).min(1, { error: "At least one source is required." }),
  })
  .superRefine((entry, context) => {
    addDuplicateValueIssues(context, entry.aliases, ["aliases"], "Alias");
    entry.aliases.forEach((alias, index) => {
      if (alias !== entry.slug) return;
      context.addIssue({
        code: "custom",
        path: ["aliases", index],
        message: "An Entry alias must not equal its current slug.",
        params: { diagnosticCode: "slug_alias_collision" },
      });
    });
    addDuplicateValueIssues(context, entry.domains, ["domains"], "Domain");
    addDuplicateValueIssues(
      context,
      entry.secondary_topic_trail_ids,
      ["secondary_topic_trail_ids"],
      "Secondary Topic Trail ID",
    );
    entry.secondary_topic_trail_ids.forEach((topicTrailId, index) => {
      if (topicTrailId !== entry.primary_topic_trail_id) return;
      context.addIssue({
        code: "custom",
        path: ["secondary_topic_trail_ids", index],
        message: "The primary Topic Trail must not also be a secondary Topic Trail.",
        params: { diagnosticCode: "duplicate_topic_trail_relationship" },
      });
    });

    const citationIds = entry.sources.map((source) => source.citation_id);
    addDuplicateValueIssues(context, citationIds, ["sources"], "Source citation ID", ["citation_id"]);

    if (entry.review_status === "follow_up_needed" && entry.review_reason === null) {
      context.addIssue({
        code: "custom",
        path: ["review_reason"],
        message: "Review reason is required when follow-up is needed.",
        params: { diagnosticCode: "conditional_field_required" },
      });
    }
    if (entry.review_status === "stable" && entry.review_reason !== null) {
      context.addIssue({
        code: "custom",
        path: ["review_reason"],
        message: "Review reason must be null when review status is stable.",
        params: { diagnosticCode: "conditional_field_forbidden" },
      });
    }

    const hasTriggeringEvidenceType = entry.sources.some((source) =>
      source.evidence_types.some((type) => POTENTIAL_SIGNIFICANCE_EVIDENCE_TYPES.has(type)),
    );
    const requiresPotentialSignificance =
      POTENTIAL_SIGNIFICANCE_STATUSES.has(entry.claim_status) ||
      entry.evidence_strength === "thin" ||
      hasTriggeringEvidenceType;

    if (requiresPotentialSignificance && entry.potential_significance_if_confirmed === null) {
      context.addIssue({
        code: "custom",
        path: ["potential_significance_if_confirmed"],
        message: "Potential significance is required for provisional, disputed, thin, or specified source evidence.",
        params: { diagnosticCode: "conditional_field_required" },
      });
    }
  });
export type Entry = z.infer<typeof entrySchema>;
