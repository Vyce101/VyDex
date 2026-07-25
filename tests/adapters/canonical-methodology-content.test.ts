// Verifies the repository's canonical Methodology content and publication event.
import { beforeAll, describe, expect, test } from "vitest";
import { loadCanonicalRecords, type LoadedCanonicalRecords } from "../../src/adapters/canonical-record-loader";
import {
  CLAIM_STATUSES,
  DOMAINS,
  ENTRY_STATES,
  EVIDENCE_STRENGTHS,
  EVIDENCE_TYPES,
  METHODOLOGY_VERSION_TYPES,
  REVIEW_STATUSES,
  SOURCE_ROLES,
  methodologyPublicationEventSchema,
  methodologySchema,
} from "../../src/domain/canonical-records";

const METHODOLOGY_ID = "019f9593-391e-79d1-8f4a-3c88e68fc069";
const EFFECTIVE_DATE = "2026-07-24";
const PUBLICATION_TIMESTAMP = "2026-07-24T19:21:21.438Z";
const APPROVED_INTRO =
  "How VyDex decides what enters the ledger, how claims are judged, and what each public label means.";
const APPROVED_REVIEW_REASON_DEFINITION =
  "Review Reason explains why an Entry is marked Follow-Up Needed and identifies the evidence, uncertainty, or review trigger that warrants another review.";
const PUBLICATION_TITLE = "Methodology v1.0.0 Published";
const PUBLICATION_SUMMARY = "Published the initial public judgment standard for Stage 1 entries.";

function withoutProperty(value: unknown, path: readonly string[]): unknown {
  const copy = structuredClone(value);
  let parent = copy as Record<string, unknown>;

  for (const segment of path.slice(0, -1)) {
    parent = parent[segment] as Record<string, unknown>;
  }

  Reflect.deleteProperty(parent, path.at(-1)!);
  return copy;
}

describe("canonical Methodology 1.0.0 content", () => {
  let records: LoadedCanonicalRecords;

  beforeAll(async () => {
    records = await loadCanonicalRecords({ filesystem_root: process.cwd() });
  });

  test("loads one valid Methodology and its matching publication event", () => {
    expect(records.diagnostics).toEqual([]);
    expect(records.methodologies).toHaveLength(1);
    expect(records.methodology_publication_events).toHaveLength(1);

    const methodology = methodologySchema.parse(records.methodologies[0]!.value);
    const publicationEvent = methodologyPublicationEventSchema.parse(
      records.methodology_publication_events[0]!.value,
    );

    expect(methodology).toMatchObject({
      id: METHODOLOGY_ID,
      public_version: "1.0.0",
      version_type: "major",
      effective_date: EFFECTIVE_DATE,
      title: "Methodology",
      intro: APPROVED_INTRO,
    });
    expect(publicationEvent).toEqual({
      type: "methodology_change",
      methodology_id: methodology.id,
      published_at: PUBLICATION_TIMESTAMP,
      title: PUBLICATION_TITLE,
      summary: PUBLICATION_SUMMARY,
    });
    expect(methodology.content.public_labels.review_status.review_reason_definition).toBe(
      APPROVED_REVIEW_REASON_DEFINITION,
    );
  });

  test("stores every exhaustive public definition set", () => {
    const methodology = methodologySchema.parse(records.methodologies[0]!.value);

    expect(Object.keys(methodology.content.public_labels.claim_status_definitions)).toEqual([
      ...CLAIM_STATUSES,
    ]);
    expect(Object.keys(methodology.content.public_labels.evidence_strength.definitions)).toEqual([
      ...EVIDENCE_STRENGTHS,
    ]);
    expect(Object.keys(methodology.content.public_labels.review_status.definitions)).toEqual([
      ...REVIEW_STATUSES,
    ]);
    expect(Object.keys(methodology.content.public_labels.entry_state_definitions)).toEqual([
      ...ENTRY_STATES,
    ]);
    expect(Object.keys(methodology.content.sources_and_evidence_types.evidence_type_definitions)).toEqual([
      ...EVIDENCE_TYPES,
    ]);
    expect(Object.keys(methodology.content.sources_and_evidence_types.source_role_definitions)).toEqual([
      ...SOURCE_ROLES,
    ]);
    expect(Object.keys(methodology.content.topic_trails_and_domains.domain_definitions)).toEqual([
      ...DOMAINS,
    ]);
    expect(Object.keys(methodology.content.versioning.definitions)).toEqual([
      ...METHODOLOGY_VERSION_TYPES,
    ]);
  });

  test.each([
    "id",
    "public_version",
    "version_type",
    "effective_date",
    "title",
    "intro",
    "content",
  ])("rejects a Methodology missing root field %s", (field) => {
    const incomplete = withoutProperty(records.methodologies[0]!.value, [field]);
    expect(methodologySchema.safeParse(incomplete).success).toBe(false);
  });

  test.each([
    "inclusion_rule",
    "inclusion_standard",
    "claim_appraisal",
    "public_labels",
    "entry_fields",
    "sources_and_evidence_types",
    "dates_and_evidence_monitoring",
    "topic_trails_and_domains",
    "entry_titles",
    "versioning",
  ])("rejects a Methodology missing named content section %s", (section) => {
    const incomplete = withoutProperty(records.methodologies[0]!.value, ["content", section]);
    expect(methodologySchema.safeParse(incomplete).success).toBe(false);
  });

  test.each(EVIDENCE_TYPES)("rejects a Methodology missing Evidence Type definition %s", (evidenceType) => {
    const incomplete = withoutProperty(records.methodologies[0]!.value, [
      "content",
      "sources_and_evidence_types",
      "evidence_type_definitions",
      evidenceType,
    ]);
    expect(methodologySchema.safeParse(incomplete).success).toBe(false);
  });

  test.each(["type", "methodology_id", "published_at", "title", "summary"])(
    "rejects a publication event missing field %s",
    (field) => {
      const incomplete = withoutProperty(records.methodology_publication_events[0]!.value, [field]);
      expect(methodologyPublicationEventSchema.safeParse(incomplete).success).toBe(false);
    },
  );
});
