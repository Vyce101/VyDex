// Verifies Entry preview projection, public labels, escaping, and fail-closed behavior.
import { describe, expect, test } from "vitest";
import {
  CLAIM_STATUS_LABELS,
  CLAIM_STATUSES,
  EVIDENCE_STRENGTH_LABELS,
  EVIDENCE_STRENGTHS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUSES,
  constructReleaseModel,
  type ResolvedPublicEntry,
} from "../../src/domain";
import {
  projectEntryPreview,
  type EntryPreviewSource,
} from "../../src/components/entry-preview/project-entry-preview";
import { createLoadedCanonicalRecords, createValidReleaseMetadata } from "../domain/fixtures";

function createResolvedEntry(): ResolvedPublicEntry {
  const result = constructReleaseModel({
    records: createLoadedCanonicalRecords(),
    release_metadata: createValidReleaseMetadata(),
    site_origin: "https://example.com",
    mode: "production",
  });
  if (result.mode !== "production" || !result.success) {
    throw new Error("Entry preview test fixture requires a valid production release.");
  }
  return result.release.current_entries[0]!;
}

function cloneSource(source: EntryPreviewSource): EntryPreviewSource {
  return structuredClone(source);
}

describe("Entry preview public labels", () => {
  test("keeps every displayed status map exhaustive", () => {
    expect(Object.keys(CLAIM_STATUS_LABELS)).toEqual([...CLAIM_STATUSES]);
    expect(Object.keys(EVIDENCE_STRENGTH_LABELS)).toEqual([...EVIDENCE_STRENGTHS]);
    expect(Object.keys(REVIEW_STATUS_LABELS)).toEqual([...REVIEW_STATUSES]);
    expect(CLAIM_STATUS_LABELS.reported_but_unverified).toBe("Reported But Unverified");
    expect(EVIDENCE_STRENGTH_LABELS.very_strong).toBe("Very Strong");
    expect(REVIEW_STATUS_LABELS.follow_up_needed).toBe("Follow-Up Needed");
  });
});

describe("projectEntryPreview", () => {
  test("projects the exact preview fields and only the first authored Domain", () => {
    const source = createResolvedEntry();
    const originalDomains = [...source.entry.domains];

    const preview = projectEntryPreview(source);

    expect(preview).toMatchObject({
      domain_label: "AI Evaluation",
      date_updated: "2026-07-21",
      title: "Verified frontier result",
      claim_status: { value: "confirmed", label: "Confirmed" },
      evidence_strength: { value: "strong", label: "Strong" },
      review_status: { value: "stable", label: "Stable" },
      primary_topic_trail: {
        name: "Frontier Evaluations",
        canonical_url: "https://example.com/topic-trails/frontier-evaluations/",
      },
      canonical_url: "https://example.com/entries/verified-frontier-result/",
    });
    expect(preview.domain_label).not.toContain("AI Capabilities");
    expect(source.entry.domains).toEqual(originalDomains);
    expect(source.entry.domains).toEqual(["ai_evaluation", "ai_capabilities"]);
  });

  test("renders supported inline Markdown without exposing raw HTML", () => {
    const source = cloneSource(createResolvedEntry());
    source.entry.claim = "`<script>alert(1)</script>` and a **strong** [result](https://example.com/result)." as typeof source.entry.claim;

    const preview = projectEntryPreview(source);

    expect(preview.claim_html).toBe(
      '<code>&lt;script&gt;alert(1)&lt;/script&gt;</code> and a <strong>strong</strong> <a href="https://example.com/result">result</a>.',
    );
    expect(preview.claim_html).not.toContain("<script>");
  });

  test("allows a list host to identify the current Topic Trail without mutating the Entry", () => {
    const source = createResolvedEntry();
    const original = structuredClone(source);

    const preview = projectEntryPreview(source, {
      topic_trail: {
        name: "Secondary Trail",
        canonical_url: "https://example.com/topic-trails/secondary-trail/" as ResolvedPublicEntry["primary_topic_trail"]["canonical_url"],
      },
    });

    expect(preview.primary_topic_trail).toEqual({
      name: "Secondary Trail",
      canonical_url: "https://example.com/topic-trails/secondary-trail/",
    });
    expect(source).toEqual(original);
  });

  test.each([
    {
      name: "has no Domain",
      change: (source: EntryPreviewSource) => {
        source.entry.domains = [];
      },
      error: "at least one mapped Domain",
    },
    {
      name: "has no title",
      change: (source: EntryPreviewSource) => {
        Reflect.deleteProperty(source.entry, "title");
      },
      error: "an Entry title",
    },
    {
      name: "has no Date Updated",
      change: (source: EntryPreviewSource) => {
        Reflect.deleteProperty(source.activity, "date_updated");
      },
      error: "Date Updated",
    },
    {
      name: "has an unmapped Claim Status",
      change: (source: EntryPreviewSource) => {
        source.entry.claim_status = "unknown" as typeof source.entry.claim_status;
      },
      error: "mapped Claim Status",
    },
    {
      name: "has an invalid Entry URL",
      change: (source: EntryPreviewSource) => {
        source.canonical_url = "/relative" as typeof source.canonical_url;
      },
      error: "valid Entry canonical URL",
    },
    {
      name: "has invalid claim Markdown",
      change: (source: EntryPreviewSource) => {
        source.entry.claim = "<script>alert(1)</script>" as typeof source.entry.claim;
      },
      error: "valid claim",
    },
  ])("throws instead of projecting partial data when the source $name", ({ change, error }) => {
    const source = cloneSource(createResolvedEntry());
    change(source);

    expect(() => projectEntryPreview(source)).toThrow(error);
  });

  test("rejects an absent source", () => {
    expect(() => projectEntryPreview(undefined as unknown as EntryPreviewSource)).toThrow(
      "validated source",
    );
  });
});
