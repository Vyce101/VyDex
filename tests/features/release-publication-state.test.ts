// Verifies the committed Stage 1 archive and current active release state.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  loadArchivedReleaseState,
  loadReleaseState,
  STAGE_ONE_SOURCE_COMMIT,
  verifyAllReleaseArchives,
} from "../../src/release/release-publication";

const ROOT = resolve(import.meta.dirname, "../..");
const STAGE_ONE_RELEASE_ID = "019f9b40-a3a8-75ad-b2b2-05a7100bcc34";

describe("committed release publication state", () => {
  test("archives Stage 1 without changing its identity or Dataset bytes", async () => {
    const activeState = await loadReleaseState(ROOT);
    const stageOne = await loadArchivedReleaseState(ROOT, STAGE_ONE_RELEASE_ID);
    expect(stageOne.descriptor.release_id).toBe(STAGE_ONE_RELEASE_ID);
    expect(stageOne.descriptor.generated_at).toBe("2026-07-25T21:48:52.520Z");
    expect(stageOne.manifest.manifest_version).toBe("2.0.0");
    expect(stageOne.manifest.source_commit).toBe(STAGE_ONE_SOURCE_COMMIT);
    expect(stageOne.manifest.source_commit).not.toBe("e774b55f3a164411b6b0c0e32c99713966c64de3");
    expect(activeState.history.releases[0]?.release_id).toBe(STAGE_ONE_RELEASE_ID);
    expect(activeState.history.releases[0]?.previous_release_id).toBeNull();
    await verifyAllReleaseArchives(ROOT, activeState.history);
    const datasetRoute = stageOne.immutable_contract.routes.find(({ public_path }) => public_path.includes("/datasets/releases/"))!;
    const archived = await readFile(resolve(stageOne.archive_root, "immutable-public", datasetRoute.archive_path));
    expect(archived.byteLength).toBe(datasetRoute.bytes);
    expect(datasetRoute.public_path).toContain(STAGE_ONE_RELEASE_ID);
  });

  test("keeps active descriptor and manifest byte-identical to archive copies", async () => {
    const state = await loadReleaseState(ROOT);
    await expect(readFile(resolve(state.active_archive_root, "release.json"), "utf8")).resolves.toBe(state.descriptor_raw);
    await expect(readFile(resolve(state.active_archive_root, "release-manifest.json"), "utf8")).resolves.toBe(state.manifest_raw);
  });
});
