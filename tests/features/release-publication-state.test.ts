// Verifies the committed Stage 1 archive and v2 active-state migration.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  loadReleaseState,
  STAGE_ONE_SOURCE_COMMIT,
  verifyAllReleaseArchives,
} from "../../src/release/release-publication";

const ROOT = resolve(import.meta.dirname, "../..");

describe("committed release publication state", () => {
  test("archives Stage 1 without changing its identity or Dataset bytes", async () => {
    const state = await loadReleaseState(ROOT);
    expect(state.descriptor.release_id).toBe("019f9b40-a3a8-75ad-b2b2-05a7100bcc34");
    expect(state.descriptor.generated_at).toBe("2026-07-25T21:48:52.520Z");
    expect(state.manifest.manifest_version).toBe("2.0.0");
    expect(state.manifest.source_commit).toBe(STAGE_ONE_SOURCE_COMMIT);
    expect(state.manifest.source_commit).not.toBe("e774b55f3a164411b6b0c0e32c99713966c64de3");
    expect(state.history.releases).toHaveLength(1);
    expect(state.history.releases[0]?.previous_release_id).toBeNull();
    await verifyAllReleaseArchives(ROOT, state.history);
    const datasetRoute = state.immutable_contract.routes.find(({ public_path }) => public_path.includes("/datasets/releases/"))!;
    const archived = await readFile(resolve(state.active_archive_root, "immutable-public", datasetRoute.archive_path));
    expect(archived.byteLength).toBe(datasetRoute.bytes);
    expect(datasetRoute.public_path).toContain(state.descriptor.release_id);
  });

  test("keeps active descriptor and manifest byte-identical to archive copies", async () => {
    const state = await loadReleaseState(ROOT);
    await expect(readFile(resolve(state.active_archive_root, "release.json"), "utf8")).resolves.toBe(state.descriptor_raw);
    await expect(readFile(resolve(state.active_archive_root, "release-manifest.json"), "utf8")).resolves.toBe(state.manifest_raw);
  });
});
