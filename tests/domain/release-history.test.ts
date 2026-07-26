// Verifies immutable release-history ordering, provenance, and route contracts.
import { describe, expect, test } from "vitest";
import {
  gitCommitSchema,
  immutablePublicContractSchema,
  releaseHistorySchema,
} from "../../src/domain";

const FIRST = "019f9b40-a3a8-75ad-b2b2-05a7100bcc34";
const SECOND = "019f9b40-a3a8-75ad-b2b2-05a7100bcc35";

function record(releaseId: string, generatedAt: string, previousReleaseId: string | null) {
  return {
    release_id: releaseId,
    generated_at: generatedAt,
    source_commit: "a".repeat(40),
    descriptor_path: `generated/release-data/releases/${releaseId}/release.json`,
    manifest_path: `generated/release-data/releases/${releaseId}/release-manifest.json`,
    dataset_public_path: `/datasets/releases/${releaseId}/dataset.json`,
    previous_release_id: previousReleaseId,
  };
}

describe("release history", () => {
  test("accepts an ordered predecessor chain and full Git object IDs", () => {
    expect(gitCommitSchema.parse("a".repeat(40))).toHaveLength(40);
    expect(releaseHistorySchema.parse({
      history_version: "1.0.0",
      releases: [
        record(FIRST, "2026-07-25T21:48:52.520Z", null),
        record(SECOND, "2026-07-26T21:48:52.520Z", FIRST),
      ],
    }).releases).toHaveLength(2);
  });

  test.each([
    ["duplicate IDs", [record(FIRST, "2026-07-25T21:48:52.520Z", null), record(FIRST, "2026-07-26T21:48:52.520Z", FIRST)]],
    ["broken predecessor", [record(FIRST, "2026-07-25T21:48:52.520Z", null), record(SECOND, "2026-07-26T21:48:52.520Z", SECOND)]],
    ["non-increasing time", [record(FIRST, "2026-07-25T21:48:52.520Z", null), record(SECOND, "2026-07-25T21:48:52.520Z", FIRST)]],
  ])("rejects %s", (_label, releases) => {
    expect(() => releaseHistorySchema.parse({ history_version: "1.0.0", releases })).toThrow();
  });

  test("records immutable bytes and response metadata", () => {
    const contract = immutablePublicContractSchema.parse({
      contract_version: "1.0.0",
      release_id: FIRST,
      routes: [{
        public_path: `/datasets/releases/${FIRST}/dataset.json`,
        archive_path: `datasets/releases/${FIRST}/dataset.json`,
        bytes: 10,
        sha256: "b".repeat(64),
        content_type: "application/json; charset=utf-8",
        cache_control: "public, max-age=31536000, immutable",
        content_disposition: "attachment; filename=\"dataset.json\"",
      }],
    });
    expect(contract.routes[0]?.content_disposition).toContain("attachment");
  });
});
