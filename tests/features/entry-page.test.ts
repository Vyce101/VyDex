// Verifies projection of resolved Entries into complete Entry Page display models.
import { expect, test } from "vitest";
import type { ClaimStatus, ResolvedPublicEntry } from "../../src/domain";
import { constructReleaseModel } from "../../src/domain/release-construction";
import { createEntryPageViewModel } from "../../src/features/entry-page";
import {
  createLoadedCanonicalRecords,
  createValidReleaseMetadata,
} from "../domain/fixtures";

function createResolvedEntry(): ResolvedPublicEntry {
  const result = constructReleaseModel({
    records: createLoadedCanonicalRecords(),
    release_metadata: createValidReleaseMetadata(),
    site_origin: "https://vydex.example",
    mode: "production",
  });
  if (!result.success || result.mode !== "production") throw new Error("Fixture release failed.");
  return result.release.current_entries[0]!;
}

test("projects public labels, dates, relationships, metadata, and safe prose", () => {
  const model = createEntryPageViewModel(createResolvedEntry());

  expect(model).toMatchObject({
    title: "Verified frontier result",
    claim_html: "The result <strong>crosses</strong> the defined threshold.",
    claim_status: { value: "confirmed", label: "Confirmed" },
    evidence_strength_label: "Strong",
    review_status_label: "Stable",
    review_reason: null,
    caution_notice: null,
    domains: ["AI Evaluation", "AI Capabilities"],
    date_updated: { iso: "2026-07-21", label: "Jul 21, 2026" },
    primary_topic_trail: { label: "Frontier Evaluations" },
    secondary_topic_trails: [{ label: "AI Capability Thresholds" }],
    methodology: { version: "1.0.0" },
  });
  expect(model.metadata).toMatchObject({
    date_happened: { iso: "2026-01-15", label: "Jan 15, 2026" },
    date_disclosed: null,
    date_added: { iso: "2026-07-21", label: "Jul 21, 2026" },
    date_last_checked: { iso: "2026-07-21", label: "Jul 21, 2026" },
    next_check_date: null,
    entry_state_label: "Main Entry",
    evidence_type_labels: ["Peer-Reviewed Paper", "Technical Artifact"],
  });
  expect(model.caveats_html).toEqual([
    "The result applies to the <strong>published</strong> evaluation scope.",
  ]);
});

test.each([
  ["reported_but_unverified", "This claim is reported but not independently verified."],
  ["disputed", "This claim is disputed. The evidence or interpretation is materially contested."],
  ["failed_retracted", "This claim has failed later review or been retracted."],
] as const)("projects the exact %s caution notice", (status, notice) => {
  const resolved = structuredClone(createResolvedEntry()) as ResolvedPublicEntry;
  resolved.entry.claim_status = status as ClaimStatus;
  expect(createEntryPageViewModel(resolved).caution_notice).toBe(notice);
});

test.each(["confirmed", "supported", "provisional"] as const)(
  "does not add a caution notice for %s",
  (status) => {
    const resolved = structuredClone(createResolvedEntry()) as ResolvedPublicEntry;
    resolved.entry.claim_status = status;
    expect(createEntryPageViewModel(resolved).caution_notice).toBeNull();
  },
);

test("includes follow-up reason and a scheduled next check without inventing one", () => {
  const scheduled = structuredClone(createResolvedEntry()) as ResolvedPublicEntry;
  scheduled.entry.review_status = "follow_up_needed";
  scheduled.entry.review_reason = "Review when the independent replication is published.";
  scheduled.entry.next_check_date = "2026-08-15" as typeof scheduled.entry.next_check_date;
  const scheduledModel = createEntryPageViewModel(scheduled);
  expect(scheduledModel.review_reason).toBe(
    "Review when the independent replication is published.",
  );
  expect(scheduledModel.next_check_date).toEqual({ iso: "2026-08-15", label: "Aug 15, 2026" });

  scheduled.entry.next_check_date = null;
  expect(createEntryPageViewModel(scheduled).next_check_date).toBeNull();
});

test("preserves resolved source order and every attached source field", () => {
  const resolved = structuredClone(createResolvedEntry()) as ResolvedPublicEntry;
  const primary = resolved.entry.sources[0]!;
  const context = {
    ...primary,
    citation_id: "context-record" as typeof primary.citation_id,
    title: "Context record",
    source_role: "context_source" as const,
    evidence_types: ["government_report" as const],
    used_for: "Provides historical context.",
  };
  resolved.entry.sources = [context, primary];

  const model = createEntryPageViewModel(resolved);

  expect(model.sources.map(({ citation_id }) => citation_id)).toEqual([
    "context-record",
    "evaluation-paper",
  ]);
  expect(model.sources[0]).toMatchObject({
    title: "Context record",
    source_role_label: "Context Source",
    evidence_type_labels: ["Government Report"],
    used_for: "Provides historical context.",
  });
});

test("rejects Removed Entries instead of creating a public page model", () => {
  const resolved = structuredClone(createResolvedEntry()) as ResolvedPublicEntry;
  resolved.entry.entry_state = "removed";
  expect(() => createEntryPageViewModel(resolved)).toThrow(/Main Entry/);
});
