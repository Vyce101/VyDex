// Defines the complete structured Methodology record and public content contract.
import { z } from "zod";
import {
  claimStatusSchema,
  domainSchema,
  entryStateSchema,
  evidenceStrengthSchema,
  evidenceTypeSchema,
  methodologyVersionTypeSchema,
  reviewStatusSchema,
  sourceRoleSchema,
} from "./controlled-values";
import { methodologyMarkdownSchema, plainTextSchema } from "./markdown";
import { calendarDateSchema, methodologyVersionSchema, uuidV7Schema } from "./primitives";

export type NonEmptyArray<T> = readonly [T, ...T[]];

const nonEmptyMethodologyMarkdownArraySchema = z
  .tuple([methodologyMarkdownSchema], methodologyMarkdownSchema)
  .readonly();
const twoMethodologyValuesSchema = z
  .tuple([methodologyMarkdownSchema, methodologyMarkdownSchema])
  .readonly();
const fourMethodologyValuesSchema = z
  .tuple([
    methodologyMarkdownSchema,
    methodologyMarkdownSchema,
    methodologyMarkdownSchema,
    methodologyMarkdownSchema,
  ])
  .readonly();
const sixMethodologyValuesSchema = z
  .tuple([
    methodologyMarkdownSchema,
    methodologyMarkdownSchema,
    methodologyMarkdownSchema,
    methodologyMarkdownSchema,
    methodologyMarkdownSchema,
    methodologyMarkdownSchema,
  ])
  .readonly();

const claimStatusDefinitionsSchema = z.record(claimStatusSchema, methodologyMarkdownSchema);
const entryStateDefinitionsSchema = z.record(entryStateSchema, methodologyMarkdownSchema);
const evidenceTypeDefinitionsSchema = z.record(evidenceTypeSchema, methodologyMarkdownSchema);
const sourceRoleDefinitionsSchema = z.record(sourceRoleSchema, methodologyMarkdownSchema);
const domainDefinitionsSchema = z.record(domainSchema, methodologyMarkdownSchema);
const methodologyVersionDefinitionsSchema = z.record(methodologyVersionTypeSchema, methodologyMarkdownSchema);

const evidenceStrengthDefinitionsSchema = z.record(
  evidenceStrengthSchema,
  z.strictObject({
    meaning: methodologyMarkdownSchema,
    typical_evidence: methodologyMarkdownSchema,
  }),
);

const reviewStatusDefinitionsSchema = z.record(
  reviewStatusSchema,
  z.strictObject({
    meaning: methodologyMarkdownSchema,
    used_when: methodologyMarkdownSchema,
  }),
);

export const methodologyContentSchema = z.strictObject({
  inclusion_rule: z.strictObject({
    paragraphs: twoMethodologyValuesSchema,
  }),
  inclusion_standard: z.strictObject({
    opening: methodologyMarkdownSchema,
    checks: fourMethodologyValuesSchema,
    included_example: methodologyMarkdownSchema,
    excluded_example: methodologyMarkdownSchema,
  }),
  claim_appraisal: z.strictObject({
    opening: methodologyMarkdownSchema,
    questions: sixMethodologyValuesSchema,
  }),
  public_labels: z.strictObject({
    intro: methodologyMarkdownSchema,
    claim_status_definitions: claimStatusDefinitionsSchema,
    evidence_strength: z.strictObject({
      intro: methodologyMarkdownSchema,
      definitions: evidenceStrengthDefinitionsSchema,
    }),
    review_status: z.strictObject({
      intro: methodologyMarkdownSchema,
      definitions: reviewStatusDefinitionsSchema,
      review_reason_definition: methodologyMarkdownSchema,
    }),
    entry_state_definitions: entryStateDefinitionsSchema,
  }),
  entry_fields: z.strictObject({
    frontier_delta: z.strictObject({
      definition: methodologyMarkdownSchema,
      previous_frontier: methodologyMarkdownSchema,
      new_claim_result: methodologyMarkdownSchema,
      delta: methodologyMarkdownSchema,
    }),
    significance: z.strictObject({
      confirmed_significance: methodologyMarkdownSchema,
      potential_significance_if_confirmed: methodologyMarkdownSchema,
    }),
    caveats: z.strictObject({
      definition: methodologyMarkdownSchema,
      examples: nonEmptyMethodologyMarkdownArraySchema,
    }),
  }),
  sources_and_evidence_types: z.strictObject({
    intro: methodologyMarkdownSchema,
    evidence_type_definitions: evidenceTypeDefinitionsSchema,
    used_for: z.strictObject({
      definition: methodologyMarkdownSchema,
      public_statement: methodologyMarkdownSchema,
      example: methodologyMarkdownSchema,
    }),
    source_ordering: methodologyMarkdownSchema,
    source_role_definitions: sourceRoleDefinitionsSchema,
    source_role_vs_evidence_type: methodologyMarkdownSchema,
  }),
  dates_and_evidence_monitoring: z.strictObject({
    date_definitions: z.strictObject({
      date_happened: methodologyMarkdownSchema,
      date_disclosed: methodologyMarkdownSchema,
      date_added: methodologyMarkdownSchema,
      date_updated: methodologyMarkdownSchema,
      date_last_checked: methodologyMarkdownSchema,
      next_check_date: methodologyMarkdownSchema,
    }),
    evidence_monitoring: methodologyMarkdownSchema,
    review_triggers: nonEmptyMethodologyMarkdownArraySchema,
  }),
  topic_trails_and_domains: z.strictObject({
    topic_trails: z.strictObject({
      definition: methodologyMarkdownSchema,
      rules: nonEmptyMethodologyMarkdownArraySchema,
      naming_rule: methodologyMarkdownSchema,
      good_examples: nonEmptyMethodologyMarkdownArraySchema,
      bad_examples: nonEmptyMethodologyMarkdownArraySchema,
    }),
    domain_definitions: domainDefinitionsSchema,
  }),
  entry_titles: z.strictObject({
    rule: methodologyMarkdownSchema,
    pattern: methodologyMarkdownSchema,
    hype_word_rule: methodologyMarkdownSchema,
    examples: twoMethodologyValuesSchema,
  }),
  versioning: z.strictObject({
    introduction: methodologyMarkdownSchema,
    definitions: methodologyVersionDefinitionsSchema,
    closing_line: methodologyMarkdownSchema,
  }),
});
export type MethodologyContent = z.infer<typeof methodologyContentSchema>;

export const methodologySchema = z.strictObject({
  id: uuidV7Schema,
  public_version: methodologyVersionSchema,
  version_type: methodologyVersionTypeSchema,
  effective_date: calendarDateSchema,
  title: plainTextSchema,
  intro: methodologyMarkdownSchema,
  content: methodologyContentSchema,
});
export type Methodology = z.infer<typeof methodologySchema>;
