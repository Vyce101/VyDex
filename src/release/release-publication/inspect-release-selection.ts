// Compares current source output with the active committed release without changing release state.
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { readReleaseGitState } from "../../adapters/release-git";
import type { SiteOrigin } from "../../domain";
import type { ReleaseLogger } from "../../shared/release-logger";
import { buildVerifiedReleaseOutput } from "./build-release-output";
import { releaseManifestsEqual, type ReleaseManifest } from "./manifest";
import { loadReleaseState } from "./release-state";

export type ReleaseSelectionInspection = {
  status: "current" | "stale";
  active_release_id: string;
  selected_source_commit: string;
  head_commit: string;
  changed_artifact_paths: string[];
};

function changedArtifactPaths(expected: ReleaseManifest, actual: ReleaseManifest): string[] {
  const expectedFiles = new Map(expected.files.map((file) => [file.path, file]));
  const actualFiles = new Map(actual.files.map((file) => [file.path, file]));
  const paths = new Set([...expectedFiles.keys(), ...actualFiles.keys()]);
  return [...paths]
    .filter((path) => {
      const expectedFile = expectedFiles.get(path);
      const actualFile = actualFiles.get(path);
      return expectedFile?.bytes !== actualFile?.bytes || expectedFile?.sha256 !== actualFile?.sha256;
    })
    .sort((left, right) => left.localeCompare(right, "en"));
}

export async function inspectReleaseSelection(input: {
  repository_root: string;
  site_origin: SiteOrigin;
  logger: ReleaseLogger;
  dependencies?: {
    read_git_state?: typeof readReleaseGitState;
    load_release_state?: typeof loadReleaseState;
    build_release_output?: typeof buildVerifiedReleaseOutput;
    remove_staging_root?: (path: string) => Promise<void>;
  };
}): Promise<ReleaseSelectionInspection> {
  const root = resolve(input.repository_root);
  const readGitState = input.dependencies?.read_git_state ?? readReleaseGitState;
  const gitState = await readGitState(root);
  if (gitState.status) {
    throw new Error(`Release selection inspection requires a clean Git working tree.\n${gitState.status}`);
  }

  const loadState = input.dependencies?.load_release_state ?? loadReleaseState;
  const state = await loadState(root);
  const buildOutput = input.dependencies?.build_release_output ?? buildVerifiedReleaseOutput;
  const removeStagingRoot = input.dependencies?.remove_staging_root ??
    ((path: string) => rm(path, { recursive: true, force: true }));
  let stagingRoot: string | undefined;
  try {
    await input.logger.info(`Comparing current source ${gitState.head} with active release ${state.descriptor.release_id}.`);
    const built = await buildOutput({
      repository_root: root,
      site_origin: input.site_origin,
      descriptor: state.descriptor,
      source_commit: state.manifest.source_commit,
      previous_release_id: state.manifest.previous_release_id,
      retained_release_ids: state.manifest.retained_release_ids,
      retained_history: state.history,
      exclude_retained_release_id: state.descriptor.release_id,
      logger: input.logger,
      run_quality_checks: false,
      run_browser_checks: false,
    });
    stagingRoot = built.staging_root;
    const status = releaseManifestsEqual(state.manifest, built.manifest) ? "current" : "stale";
    return {
      status,
      active_release_id: state.descriptor.release_id,
      selected_source_commit: state.manifest.source_commit,
      head_commit: gitState.head,
      changed_artifact_paths: changedArtifactPaths(state.manifest, built.manifest),
    };
  } finally {
    if (stagingRoot) await removeStagingRoot(stagingRoot);
  }
}
