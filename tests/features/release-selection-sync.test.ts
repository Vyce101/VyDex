// Verifies byte-based active-release inspection and conditional successor creation.
import { describe, expect, test, vi } from "vitest";
import type { ReleaseManifest } from "../../src/release/release-publication";
import {
  inspectReleaseSelection,
  syncReleaseSelection,
  type NextReleaseResult,
  type ReleaseSelectionInspection,
} from "../../src/release/release-publication";
import type { ReleaseLogger } from "../../src/shared/release-logger";

const ACTIVE_RELEASE_ID = "019fa023-d4fa-775e-af1f-25aa42de7cf9";
const SOURCE_COMMIT = "a".repeat(40);
const HEAD_COMMIT = "b".repeat(40);
const logger: ReleaseLogger = {
  filename: "",
  log: vi.fn(async () => {}),
  debug: vi.fn(async () => {}),
  info: vi.fn(async () => {}),
  warning: vi.fn(async () => {}),
  error: vi.fn(async () => {}),
  critical: vi.fn(async () => {}),
};

function manifest(files: ReleaseManifest["files"]): ReleaseManifest {
  return {
    manifest_version: "2.0.0",
    release_id: ACTIVE_RELEASE_ID,
    generated_at: "2026-07-26T20:35:30.684Z",
    source_commit: SOURCE_COMMIT,
    previous_release_id: null,
    retained_release_ids: [],
    site_origin: "https://vydex.pages.dev",
    entry_count: 0,
    topic_trail_count: 0,
    methodology_versions: ["1.0.0"],
    generated_routes: [],
    current_release_routes: [],
    retained_immutable_routes: [],
    export_filename: "dataset.json",
    json_schema_url: "https://vydex.pages.dev/schema.json",
    redirects: [],
    files,
  } as unknown as ReleaseManifest;
}

function inspection(status: ReleaseSelectionInspection["status"]): ReleaseSelectionInspection {
  return {
    status,
    active_release_id: ACTIVE_RELEASE_ID,
    selected_source_commit: SOURCE_COMMIT,
    head_commit: HEAD_COMMIT,
    changed_artifact_paths: status === "stale" ? ["sitemap-index.xml"] : [],
  };
}

function nextRelease(): NextReleaseResult {
  return {
    previous_release_id: ACTIVE_RELEASE_ID,
    release_id: "019fa100-0000-7000-8000-000000000001",
    generated_at: "2026-07-27T00:00:00.000Z",
    source_commit: HEAD_COMMIT,
    dataset_public_path: "/datasets/release.json",
    manifest_path: "generated/release-data/release-manifest.json",
    archive_path: "generated/release-data/releases/019fa100-0000-7000-8000-000000000001",
    files_to_commit: ["generated/release-data/release.json"],
  };
}

describe("release selection inspection", () => {
  test("accepts a different HEAD when its public artifact matches the active manifest", async () => {
    const activeManifest = manifest([{ path: "index.html", bytes: 10, sha256: "1".repeat(64) }]);
    const buildReleaseOutput = vi.fn(async () => ({
      staging_root: "runtime/selection",
      manifest: structuredClone(activeManifest),
    }));
    const removeStagingRoot = vi.fn(async () => {});

    const result = await inspectReleaseSelection({
      repository_root: ".",
      site_origin: "https://vydex.pages.dev" as never,
      logger,
      dependencies: {
        read_git_state: vi.fn(async () => ({ branch: "main", head: HEAD_COMMIT, status: "" })),
        load_release_state: vi.fn(async () => ({
          descriptor: { release_id: ACTIVE_RELEASE_ID },
          manifest: activeManifest,
          history: { releases: [] },
        })) as never,
        build_release_output: buildReleaseOutput as never,
        remove_staging_root: removeStagingRoot,
      },
    });

    expect(result).toMatchObject({ status: "current", head_commit: HEAD_COMMIT });
    expect(buildReleaseOutput).toHaveBeenCalledWith(expect.objectContaining({
      source_commit: SOURCE_COMMIT,
      run_quality_checks: false,
      run_browser_checks: false,
    }));
    expect(removeStagingRoot).toHaveBeenCalledWith("runtime/selection");
  });

  test("reports exact artifact paths when current source changes public bytes", async () => {
    const activeManifest = manifest([{ path: "index.html", bytes: 10, sha256: "1".repeat(64) }]);
    const changedManifest = manifest([
      { path: "index.html", bytes: 11, sha256: "2".repeat(64) },
      { path: "sitemap-index.xml", bytes: 12, sha256: "3".repeat(64) },
    ]);

    const result = await inspectReleaseSelection({
      repository_root: ".",
      site_origin: "https://vydex.pages.dev" as never,
      logger,
      dependencies: {
        read_git_state: vi.fn(async () => ({ branch: "main", head: HEAD_COMMIT, status: "" })),
        load_release_state: vi.fn(async () => ({
          descriptor: { release_id: ACTIVE_RELEASE_ID },
          manifest: activeManifest,
          history: { releases: [] },
        })) as never,
        build_release_output: vi.fn(async () => ({
          staging_root: "runtime/selection",
          manifest: changedManifest,
        })) as never,
        remove_staging_root: vi.fn(async () => {}),
      },
    });

    expect(result).toMatchObject({
      status: "stale",
      changed_artifact_paths: ["index.html", "sitemap-index.xml"],
    });
  });

  test("rejects dirty source before building", async () => {
    const buildReleaseOutput = vi.fn();
    await expect(inspectReleaseSelection({
      repository_root: ".",
      site_origin: "https://vydex.pages.dev" as never,
      logger,
      dependencies: {
        read_git_state: vi.fn(async () => ({ branch: "main", head: HEAD_COMMIT, status: " M src/file.ts" })),
        build_release_output: buildReleaseOutput as never,
      },
    })).rejects.toThrow("requires a clean Git working tree");
    expect(buildReleaseOutput).not.toHaveBeenCalled();
  });
});

describe("release selection synchronization", () => {
  test("does not create a release when public output is unchanged", async () => {
    const runNextRelease = vi.fn();
    const result = await syncReleaseSelection({
      repository_root: ".",
      site_origin: "https://vydex.pages.dev" as never,
      confirmation: "",
      logger,
      dependencies: {
        inspect_selection: vi.fn(async () => inspection("current")),
        run_next_release: runNextRelease as never,
      },
    });
    expect(result.status).toBe("current");
    expect(runNextRelease).not.toHaveBeenCalled();
  });

  test("requires explicit confirmation when public output changed", async () => {
    await expect(syncReleaseSelection({
      repository_root: ".",
      site_origin: "https://vydex.pages.dev" as never,
      confirmation: "yes",
      logger,
      dependencies: {
        inspect_selection: vi.fn(async () => inspection("stale")),
      },
    })).rejects.toThrow("--confirm CREATE_NEXT_RELEASE");
  });

  test("creates one successor for stale public output", async () => {
    const release = nextRelease();
    const runNextRelease = vi.fn(async () => release);
    const result = await syncReleaseSelection({
      repository_root: ".",
      site_origin: "https://vydex.pages.dev" as never,
      confirmation: "CREATE_NEXT_RELEASE",
      environment: {},
      logger,
      dependencies: {
        inspect_selection: vi.fn(async () => inspection("stale")),
        run_next_release: runNextRelease as never,
      },
    });
    expect(result).toEqual({ status: "created", inspection: inspection("stale"), release });
    expect(runNextRelease).toHaveBeenCalledWith(expect.objectContaining({
      confirmation: "CREATE_NEXT_RELEASE",
      environment: {},
    }));
  });
});
