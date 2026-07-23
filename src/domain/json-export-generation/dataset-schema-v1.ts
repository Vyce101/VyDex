// Builds the exact public Dataset 1.0.0 JSON Schema from a validated site origin.
import type { ValidationDiagnostic, ValidationResult } from "../cross-record-validation";
import {
  DATASET_SCHEMA_PUBLIC_PATH,
  toCanonicalUrl,
  validateSiteOrigin,
} from "../route-generation";
import type { GeneratedDatasetSchemaArtifactV1, JsonSchemaDocument } from "./dataset-contract-v1";
import { serializeJsonDocument } from "./deterministic-serialization";

const JSON_SCHEMA_DRAFT = "https://json-schema.org/draft/2020-12/schema";

function schemaDiagnostic(diagnostics: ValidationDiagnostic[]): ValidationResult<never> {
  return { success: false, diagnostics };
}

function buildSchema(schemaUrl: string): JsonSchemaDocument {
  const sourceRolePairs = [
    ["primary_evidence", "Primary Evidence"],
    ["independent_replication", "Independent Replication"],
    ["official_record", "Official Record"],
    ["strong_artifact", "Strong Artifact"],
    ["context_source", "Context Source"],
    ["media_report", "Media Report"],
  ].map(([sourceRole, sourceRoleLabel]) => ({
    properties: {
      source_role: { const: sourceRole },
      source_role_label: { const: sourceRoleLabel },
    },
    required: ["source_role", "source_role_label"],
  }));

  const evidenceStrengthPairs = [
    ["thin", 1],
    ["moderate", 2],
    ["strong", 3],
    ["very_strong", 4],
  ].map(([strength, score]) => ({
    properties: {
      evidence_strength: { const: strength },
      evidence_strength_score: { const: score },
    },
    required: ["evidence_strength", "evidence_strength_score"],
  }));

  return {
    $schema: JSON_SCHEMA_DRAFT,
    $id: schemaUrl,
    title: "VyDex Dataset 1.0.0",
    description: "The immutable public contract for current VyDex Entry versions in one release.",
    type: "object",
    additionalProperties: false,
    required: [
      "$schema",
      "dataset_name",
      "dataset_schema_version",
      "release_id",
      "generated_at",
      "scope",
      "entry_count",
      "methodology_versions",
      "entries",
    ],
    properties: {
      $schema: { const: schemaUrl },
      dataset_name: { const: "VyDex" },
      dataset_schema_version: { const: "1.0.0" },
      release_id: { $ref: "#/$defs/uuidV7" },
      generated_at: { $ref: "#/$defs/rfc3339UtcTimestamp" },
      scope: { const: "latest_entry_versions" },
      entry_count: { type: "integer", minimum: 1 },
      methodology_versions: {
        type: "array",
        minItems: 1,
        maxItems: 1,
        uniqueItems: true,
        items: { $ref: "#/$defs/methodologyVersion" },
      },
      entries: {
        type: "array",
        minItems: 1,
        items: { $ref: "#/$defs/entry" },
      },
    },
    $defs: {
      uuidV7: {
        type: "string",
        format: "uuid",
        pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
      },
      slug: {
        type: "string",
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      },
      calendarDate: {
        type: "string",
        format: "date",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
      },
      rfc3339UtcTimestamp: {
        type: "string",
        format: "date-time",
        pattern: "Z$",
      },
      absoluteCanonicalUrl: {
        type: "string",
        format: "uri",
        pattern: "^https://[^?#]+$",
      },
      sourceUrl: {
        type: "string",
        format: "uri",
        pattern: "^https?://",
      },
      plainText: {
        type: "string",
        minLength: 1,
        pattern: "^[^\\r\\n]+$",
      },
      markdown: {
        type: "string",
        minLength: 1,
      },
      claimStatus: {
        enum: [
          "confirmed",
          "supported",
          "provisional",
          "reported_but_unverified",
          "disputed",
          "failed_retracted",
        ],
      },
      evidenceStrength: {
        enum: ["thin", "moderate", "strong", "very_strong"],
      },
      reviewStatus: {
        enum: ["stable", "follow_up_needed"],
      },
      domain: {
        enum: [
          "ai_capabilities",
          "ai_evaluation",
          "robotics",
          "biology",
          "mathematics",
          "physical_sciences",
          "cybersecurity",
          "hardware",
          "economics",
          "governance",
          "national_security",
          "space",
        ],
      },
      evidenceType: {
        enum: [
          "preprint",
          "peer_reviewed_paper",
          "independent_replication",
          "official_claim",
          "developer_vendor_claim",
          "benchmark_result",
          "technical_artifact",
          "government_report",
          "court_filing",
          "audit",
          "media_report",
          "leaked_internal_claim",
        ],
      },
      sourceRole: {
        enum: [
          "primary_evidence",
          "independent_replication",
          "official_record",
          "strong_artifact",
          "context_source",
          "media_report",
        ],
      },
      methodologyVersion: {
        const: "1.0.0",
      },
      topicTrailReference: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "slug", "canonical_url"],
        properties: {
          id: { $ref: "#/$defs/uuidV7" },
          name: { $ref: "#/$defs/plainText" },
          slug: { $ref: "#/$defs/slug" },
          canonical_url: { $ref: "#/$defs/absoluteCanonicalUrl" },
        },
      },
      methodologyReference: {
        type: "object",
        additionalProperties: false,
        required: ["id", "version", "canonical_url"],
        properties: {
          id: { $ref: "#/$defs/uuidV7" },
          version: { $ref: "#/$defs/methodologyVersion" },
          canonical_url: { $ref: "#/$defs/absoluteCanonicalUrl" },
        },
      },
      dates: {
        type: "object",
        additionalProperties: false,
        required: [
          "date_happened",
          "date_disclosed",
          "date_added",
          "date_updated",
          "date_last_checked",
          "next_check_date",
        ],
        properties: {
          date_happened: {
            description: "The calendar date the event happened; null means unknown.",
            anyOf: [{ $ref: "#/$defs/calendarDate" }, { type: "null" }],
          },
          date_disclosed: {
            description: "The calendar date the event was disclosed; null means unknown.",
            anyOf: [{ $ref: "#/$defs/calendarDate" }, { type: "null" }],
          },
          date_added: { $ref: "#/$defs/calendarDate" },
          date_updated: { $ref: "#/$defs/calendarDate" },
          date_last_checked: { $ref: "#/$defs/calendarDate" },
          next_check_date: {
            description: "The next scheduled review date; null means no check is scheduled.",
            anyOf: [{ $ref: "#/$defs/calendarDate" }, { type: "null" }],
          },
        },
      },
      frontierDelta: {
        type: "object",
        additionalProperties: false,
        required: ["previous_frontier", "new_claim_result", "delta"],
        properties: {
          previous_frontier: { $ref: "#/$defs/markdown" },
          new_claim_result: { $ref: "#/$defs/markdown" },
          delta: { $ref: "#/$defs/markdown" },
        },
      },
      details: {
        type: "object",
        additionalProperties: false,
        required: [
          "what_happened",
          "what_evidence_shows",
          "context_changes_interpretation",
          "reader_takeaway",
        ],
        properties: {
          what_happened: { $ref: "#/$defs/markdown" },
          what_evidence_shows: { $ref: "#/$defs/markdown" },
          context_changes_interpretation: { $ref: "#/$defs/markdown" },
          reader_takeaway: { $ref: "#/$defs/markdown" },
        },
      },
      source: {
        type: "object",
        additionalProperties: false,
        required: [
          "citation_id",
          "title",
          "publisher_or_domain",
          "url",
          "evidence_types",
          "source_role",
          "source_role_label",
          "used_for",
        ],
        properties: {
          citation_id: { $ref: "#/$defs/slug" },
          title: { $ref: "#/$defs/plainText" },
          publisher_or_domain: { $ref: "#/$defs/plainText" },
          url: { $ref: "#/$defs/sourceUrl" },
          evidence_types: {
            type: "array",
            minItems: 1,
            uniqueItems: true,
            items: { $ref: "#/$defs/evidenceType" },
          },
          source_role: { $ref: "#/$defs/sourceRole" },
          source_role_label: { $ref: "#/$defs/plainText" },
          used_for: { $ref: "#/$defs/plainText" },
        },
        oneOf: sourceRolePairs,
      },
      entry: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "slug",
          "canonical_url",
          "revision_id",
          "revision_number",
          "revision_published_at",
          "latest_update_summary",
          "title",
          "claim",
          "claim_status",
          "evidence_strength",
          "evidence_strength_score",
          "review_status",
          "review_reason",
          "entry_state",
          "domains",
          "primary_topic_trail",
          "secondary_topic_trails",
          "methodology",
          "dates",
          "frontier_delta",
          "details",
          "confirmed_significance",
          "potential_significance_if_confirmed",
          "caveats",
          "evidence_types",
          "sources",
        ],
        properties: {
          id: { $ref: "#/$defs/uuidV7" },
          slug: { $ref: "#/$defs/slug" },
          canonical_url: { $ref: "#/$defs/absoluteCanonicalUrl" },
          revision_id: { $ref: "#/$defs/uuidV7" },
          revision_number: { type: "integer", minimum: 1 },
          revision_published_at: { $ref: "#/$defs/rfc3339UtcTimestamp" },
          latest_update_summary: { $ref: "#/$defs/plainText" },
          title: { $ref: "#/$defs/plainText" },
          claim: { $ref: "#/$defs/markdown" },
          claim_status: { $ref: "#/$defs/claimStatus" },
          evidence_strength: { $ref: "#/$defs/evidenceStrength" },
          evidence_strength_score: { type: "integer", minimum: 1, maximum: 4 },
          review_status: { $ref: "#/$defs/reviewStatus" },
          review_reason: {
            anyOf: [{ $ref: "#/$defs/plainText" }, { type: "null" }],
          },
          entry_state: { const: "main_entry" },
          domains: {
            type: "array",
            minItems: 1,
            uniqueItems: true,
            items: { $ref: "#/$defs/domain" },
          },
          primary_topic_trail: { $ref: "#/$defs/topicTrailReference" },
          secondary_topic_trails: {
            type: "array",
            uniqueItems: true,
            items: { $ref: "#/$defs/topicTrailReference" },
          },
          methodology: { $ref: "#/$defs/methodologyReference" },
          dates: { $ref: "#/$defs/dates" },
          frontier_delta: { $ref: "#/$defs/frontierDelta" },
          details: { $ref: "#/$defs/details" },
          confirmed_significance: { $ref: "#/$defs/markdown" },
          potential_significance_if_confirmed: {
            description: "Potential significance if the claim is confirmed; null means not applicable.",
            anyOf: [{ $ref: "#/$defs/markdown" }, { type: "null" }],
          },
          caveats: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/$defs/markdown" },
          },
          evidence_types: {
            type: "array",
            minItems: 1,
            uniqueItems: true,
            items: { $ref: "#/$defs/evidenceType" },
          },
          sources: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/$defs/source" },
          },
        },
        allOf: [
          { oneOf: evidenceStrengthPairs },
          {
            if: {
              properties: { review_status: { const: "stable" } },
              required: ["review_status"],
            },
            then: { properties: { review_reason: { type: "null" } } },
            else: { properties: { review_reason: { $ref: "#/$defs/plainText" } } },
          },
          {
            if: {
              anyOf: [
                {
                  properties: {
                    claim_status: {
                      enum: ["provisional", "reported_but_unverified", "disputed"],
                    },
                  },
                  required: ["claim_status"],
                },
                {
                  properties: { evidence_strength: { const: "thin" } },
                  required: ["evidence_strength"],
                },
                {
                  properties: {
                    sources: {
                      type: "array",
                      contains: {
                        type: "object",
                        properties: {
                          evidence_types: {
                            type: "array",
                            contains: {
                              enum: ["preprint", "developer_vendor_claim", "leaked_internal_claim"],
                            },
                          },
                        },
                        required: ["evidence_types"],
                      },
                    },
                  },
                  required: ["sources"],
                },
              ],
            },
            then: {
              properties: {
                potential_significance_if_confirmed: { $ref: "#/$defs/markdown" },
              },
            },
          },
        ],
      },
    },
  };
}

export function generateVyDexDatasetSchemaV1(input: {
  site_origin: unknown;
}): ValidationResult<GeneratedDatasetSchemaArtifactV1> {
  const originResult = validateSiteOrigin(input.site_origin, "production");
  if (!originResult.success) return schemaDiagnostic(originResult.diagnostics);

  const schemaUrl = toCanonicalUrl(
    originResult.data,
    DATASET_SCHEMA_PUBLIC_PATH as Parameters<typeof toCanonicalUrl>[1],
  );
  const schema = buildSchema(schemaUrl);
  return {
    success: true,
    data: {
      schema,
      serialized_json: serializeJsonDocument(schema),
      public_path: DATASET_SCHEMA_PUBLIC_PATH,
    },
    diagnostics: [],
  };
}
