// Verifies stable values, primitives, and complete canonical record schemas.
import { describe, expect, expectTypeOf, test } from "vitest";
import {
  CLAIM_STATUSES,
  DOMAIN_LABELS,
  DOMAINS,
  ENTRY_REVISION_CATEGORIES,
  ENTRY_STATES,
  EVIDENCE_STRENGTHS,
  EVIDENCE_STRENGTH_SCORES,
  EVIDENCE_TYPE_LABELS,
  EVIDENCE_TYPES,
  MATERIALITIES,
  METHODOLOGY_VERSION_TYPES,
  PUBLIC_CHANGELOG_TYPES,
  REVISION_CATEGORIES,
  REVIEW_STATUSES,
  SOURCE_ROLES,
  SOURCE_ROLE_LABELS,
  calendarDateSchema,
  claimStatusSchema,
  domainSchema,
  entryPublicationSnapshotSchema,
  entryRevisionCategorySchema,
  entrySchema,
  entryStateSchema,
  evidenceStrengthSchema,
  evidenceTypeSchema,
  materialitySchema,
  methodologySchema,
  methodologyVersionSchema,
  methodologyVersionTypeSchema,
  publicChangelogTypeSchema,
  releaseMetadataSchema,
  revisionCategorySchema,
  reviewStatusSchema,
  rfc3339UtcTimestampSchema,
  slugSchema,
  sourceRoleSchema,
  sourceUrlSchema,
  topicTrailSchema,
  uuidV7Schema,
  type Entry,
  type EntryPublicationSnapshot,
  type Methodology,
  type MethodologyMarkdown,
  type NonEmptyArray,
  type ReleaseMetadata,
  type TopicTrail,
} from "../../src/domain/canonical-records";
import {
  IDS,
  createValidEntry,
  createValidMethodology,
  createValidReleaseMetadata,
  createValidSnapshot,
  createValidTopicTrail,
} from "./fixtures";

describe("stable controlled values", () => {
  test("exports every required machine value and derived evidence score", () => {
    expect(CLAIM_STATUSES).toEqual([
      "confirmed",
      "supported",
      "provisional",
      "reported_but_unverified",
      "disputed",
      "failed_retracted",
    ]);
    expect(EVIDENCE_STRENGTHS).toEqual(["thin", "moderate", "strong", "very_strong"]);
    expect(REVIEW_STATUSES).toEqual(["stable", "follow_up_needed"]);
    expect(ENTRY_STATES).toEqual(["main_entry", "removed"]);
    expect(PUBLIC_CHANGELOG_TYPES).toEqual(["added", "updated", "removed", "methodology_change"]);
    expect(MATERIALITIES).toEqual(["material", "non_material"]);
    expect(REVISION_CATEGORIES).toContain("methodology_publication");
    expect(ENTRY_REVISION_CATEGORIES).not.toContain("methodology_publication");
    expect(METHODOLOGY_VERSION_TYPES).toEqual(["major", "minor", "patch"]);
    expect(EVIDENCE_STRENGTH_SCORES).toEqual({ thin: 1, moderate: 2, strong: 3, very_strong: 4 });
  });

  test("keeps public label maps exhaustive and authoritative", () => {
    expect(Object.keys(DOMAIN_LABELS)).toEqual([...DOMAINS]);
    expect(Object.keys(EVIDENCE_TYPE_LABELS)).toEqual([...EVIDENCE_TYPES]);
    expect(Object.keys(SOURCE_ROLE_LABELS)).toEqual([...SOURCE_ROLES]);
    expect(DOMAIN_LABELS.ai_evaluation).toBe("AI Evaluation");
    expect(EVIDENCE_TYPE_LABELS.developer_vendor_claim).toBe("Developer / Vendor Claim");
    expect(SOURCE_ROLE_LABELS.primary_evidence).toBe("Primary Evidence");
  });

  test("rejects unknown controlled values", () => {
    const schemas = [
      [CLAIM_STATUSES, claimStatusSchema],
      [EVIDENCE_STRENGTHS, evidenceStrengthSchema],
      [REVIEW_STATUSES, reviewStatusSchema],
      [ENTRY_STATES, entryStateSchema],
      [DOMAINS, domainSchema],
      [EVIDENCE_TYPES, evidenceTypeSchema],
      [PUBLIC_CHANGELOG_TYPES, publicChangelogTypeSchema],
      [MATERIALITIES, materialitySchema],
      [SOURCE_ROLES, sourceRoleSchema],
      [REVISION_CATEGORIES, revisionCategorySchema],
      [ENTRY_REVISION_CATEGORIES, entryRevisionCategorySchema],
      [METHODOLOGY_VERSION_TYPES, methodologyVersionTypeSchema],
    ] as const;

    for (const [values, schema] of schemas) {
      expect(values.every((value) => schema.safeParse(value).success)).toBe(true);
      expect(schema.safeParse("unknown_value").success).toBe(false);
    }
  });
});

describe("canonical primitives", () => {
  test.each([
    [uuidV7Schema, IDS.entry, true],
    [uuidV7Schema, "550e8400-e29b-41d4-a716-446655440000", false],
    [slugSchema, "frontier-result", true],
    [slugSchema, "Frontier_Result", false],
    [calendarDateSchema, "2024-02-29", true],
    [calendarDateSchema, "2025-02-29", false],
    [methodologyVersionSchema, "1.0.0", true],
    [methodologyVersionSchema, "v1.0.0", false],
    [methodologyVersionSchema, "01.0.0", false],
    [rfc3339UtcTimestampSchema, "2026-07-21T20:30:00Z", true],
    [rfc3339UtcTimestampSchema, "2025-02-29T20:30:00Z", false],
    [rfc3339UtcTimestampSchema, "2026-07-21T22:30:00+02:00", false],
    [sourceUrlSchema, "https://example.com/source", true],
    [sourceUrlSchema, "http://archive.example.com/source", true],
    [sourceUrlSchema, "/relative/source", false],
    [sourceUrlSchema, "ftp://example.com/source", false],
  ])("validates %j", (schema, value, expected) => {
    expect(schema.safeParse(value).success).toBe(expected);
  });
});

describe("durable record schemas", () => {
  test("parses complete valid records into typed and trimmed values", () => {
    const entry = entrySchema.parse(createValidEntry());
    const topicTrail = topicTrailSchema.parse(createValidTopicTrail());
    const methodology = methodologySchema.parse(createValidMethodology());
    const snapshot = entryPublicationSnapshotSchema.parse(createValidSnapshot());
    const release = releaseMetadataSchema.parse(createValidReleaseMetadata());

    expectTypeOf(entry).toEqualTypeOf<Entry>();
    expectTypeOf(topicTrail).toEqualTypeOf<TopicTrail>();
    expectTypeOf(methodology).toEqualTypeOf<Methodology>();
    expectTypeOf(methodology.content.entry_fields.caveats.examples).toEqualTypeOf<
      NonEmptyArray<MethodologyMarkdown>
    >();
    expectTypeOf(snapshot).toEqualTypeOf<EntryPublicationSnapshot>();
    expectTypeOf(release).toEqualTypeOf<ReleaseMetadata>();
    expect(entry.title).toBe("Verified frontier result");
    expect(entry.sources[0]?.evidence_types).toEqual(["peer_reviewed_paper", "technical_artifact"]);
  });

  test("rejects unknown fields instead of stripping authored data", () => {
    const entry = { ...createValidEntry(), evidence_strength_score: 3 };
    expect(entrySchema.safeParse(entry).success).toBe(false);
  });

  test("enforces Entry uniqueness and source requirements", () => {
    const duplicateDomains = createValidEntry();
    duplicateDomains.domains = ["ai_evaluation", "ai_evaluation"];
    const duplicateEvidenceTypes = createValidEntry();
    duplicateEvidenceTypes.sources[0]!.evidence_types = ["technical_artifact", "technical_artifact"];
    const duplicateCitationIds = createValidEntry();
    duplicateCitationIds.sources.push({ ...duplicateCitationIds.sources[0]! });

    expect(entrySchema.safeParse(duplicateDomains).success).toBe(false);
    expect(entrySchema.safeParse(duplicateEvidenceTypes).success).toBe(false);
    expect(entrySchema.safeParse(duplicateCitationIds).success).toBe(false);
  });

  test("enforces alias and Topic Trail relationship uniqueness", () => {
    const duplicateAliases = createValidEntry();
    duplicateAliases.aliases = ["old-result", "old-result"];
    const currentSlugAlias = createValidEntry();
    currentSlugAlias.aliases = [currentSlugAlias.slug];
    const duplicateSecondaryTrail = createValidEntry();
    duplicateSecondaryTrail.secondary_topic_trail_ids = [IDS.secondaryTopicTrail, IDS.secondaryTopicTrail];
    const primaryAsSecondary = createValidEntry();
    primaryAsSecondary.secondary_topic_trail_ids = [IDS.topicTrail];

    expect(entrySchema.safeParse(duplicateAliases).success).toBe(false);
    expect(entrySchema.safeParse(currentSlugAlias).success).toBe(false);
    expect(entrySchema.safeParse(duplicateSecondaryTrail).success).toBe(false);
    expect(entrySchema.safeParse(primaryAsSecondary).success).toBe(false);
  });

  test("rejects empty required Entry sections", () => {
    const entries = [createValidEntry(), createValidEntry(), createValidEntry(), createValidEntry()];
    entries[0]!.domains = [];
    entries[1]!.caveats = [];
    entries[2]!.sources = [];
    entries[3]!.confirmed_significance = "   ";

    expect(entries.every((entry) => !entrySchema.safeParse(entry).success)).toBe(true);
  });

  test("enforces review reason semantics", () => {
    const missingReason = createValidEntry();
    missingReason.review_status = "follow_up_needed";
    const staleReason = createValidEntry();
    staleReason.review_reason = "Review after replication.";

    expect(entrySchema.safeParse(missingReason).success).toBe(false);
    expect(entrySchema.safeParse(staleReason).success).toBe(false);
  });

  test.each([
    { claim_status: "provisional", evidence_strength: "strong", evidence_type: "audit" },
    { claim_status: "reported_but_unverified", evidence_strength: "strong", evidence_type: "audit" },
    { claim_status: "disputed", evidence_strength: "strong", evidence_type: "audit" },
    { claim_status: "confirmed", evidence_strength: "thin", evidence_type: "audit" },
    { claim_status: "confirmed", evidence_strength: "strong", evidence_type: "preprint" },
    { claim_status: "confirmed", evidence_strength: "strong", evidence_type: "developer_vendor_claim" },
    { claim_status: "confirmed", evidence_strength: "strong", evidence_type: "leaked_internal_claim" },
  ])("requires potential significance for $claim_status/$evidence_strength/$evidence_type", (condition) => {
    const entry = createValidEntry();
    entry.claim_status = condition.claim_status;
    entry.evidence_strength = condition.evidence_strength;
    entry.sources[0]!.evidence_types = [condition.evidence_type];
    expect(entrySchema.safeParse(entry).success).toBe(false);

    entry.potential_significance_if_confirmed = "This could materially extend the demonstrated frontier.";
    expect(entrySchema.safeParse(entry).success).toBe(true);
  });

  test("requires complete non-empty Methodology content", () => {
    const emptyExamples = createValidMethodology();
    emptyExamples.content.entry_fields.caveats.examples = [];
    const missingDefinition = createValidMethodology();
    delete missingDefinition.content.public_labels.claim_status_definitions.confirmed;

    expect(methodologySchema.safeParse(emptyExamples).success).toBe(false);
    expect(methodologySchema.safeParse(missingDefinition).success).toBe(false);
  });

  test("keeps Topic Trail descriptions plain, single-line, and free of sentence heuristics", () => {
    const noTerminalPunctuation = createValidTopicTrail();
    const multiline = createValidTopicTrail();
    multiline.description = "First line\nSecond line";

    expect(topicTrailSchema.safeParse(noTerminalPunctuation).success).toBe(true);
    expect(topicTrailSchema.safeParse(multiline).success).toBe(false);
  });

  test("restricts snapshot revision fields and validates embedded identity", () => {
    const wrongCategory = createValidSnapshot();
    wrongCategory.revision_category = "methodology_publication";
    const wrongEntryId = createValidSnapshot();
    wrongEntryId.entry_id = IDS.alternateEntry;
    const invalidRevisionNumber = createValidSnapshot();
    invalidRevisionNumber.revision_number = 0;

    expect(entryPublicationSnapshotSchema.safeParse(wrongCategory).success).toBe(false);
    expect(entryPublicationSnapshotSchema.safeParse(wrongEntryId).success).toBe(false);
    expect(entryPublicationSnapshotSchema.safeParse(invalidRevisionNumber).success).toBe(false);
  });
});
