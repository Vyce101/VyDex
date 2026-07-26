// Reproduces committed release state without creating release identity.
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { addDetachedReleaseWorktree, readGitHead, removeDetachedReleaseWorktree, requireCommitAncestor, requireReleaseStateUnchanged } from "../../adapters/release-git";
import { runNpmCommand } from "../../adapters/npm-command-runner";
import type { SiteOrigin } from "../../domain";
import type { ReleaseLogger } from "../../shared/release-logger";
import { buildVerifiedReleaseOutput } from "./build-release-output";
import { verifyActiveImmutableArtifacts } from "./immutable-artifacts";
import { inventoryReleaseFiles, releaseManifestsEqual } from "./manifest";
import { STAGE_ONE_SOURCE_COMMIT } from "./migrate-stage-one";
import { promoteReproducedOutput, recoverInterruptedReleasePromotions } from "./promotion";
import { loadReleaseState, verifyAllReleaseArchives } from "./release-state";

export async function reproduceReleaseFromSource(input: {
  repository_root: string;
  site_origin: SiteOrigin;
  logger: ReleaseLogger;
}): Promise<string> {
  const runtimeRoot = resolve(input.repository_root, "runtime");
  await mkdir(runtimeRoot, { recursive: true });
  const state = await loadReleaseState(input.repository_root);
  const worktreeRoot = await mkdtemp(resolve(runtimeRoot, "release-source-"));
  await rm(worktreeRoot, { recursive: true, force: true });
  await addDetachedReleaseWorktree({ repository_root: input.repository_root, worktree_root: worktreeRoot, source_commit: state.manifest.source_commit });
  try {
    if (state.manifest.source_commit !== STAGE_ONE_SOURCE_COMMIT) {
      await rm(resolve(worktreeRoot, "generated/release-data"), { recursive: true, force: true });
      await mkdir(resolve(worktreeRoot, "generated"), { recursive: true });
      await cp(resolve(input.repository_root, "generated/release-data"), resolve(worktreeRoot, "generated/release-data"), { recursive: true, errorOnExist: true, force: false });
    }
    await input.logger.info(`Installing the pinned dependency tree for release source ${state.manifest.source_commit}.`);
    const install = await runNpmCommand({ command_arguments: ["ci"], working_directory: worktreeRoot, environment: process.env });
    await import("node:fs/promises").then(({ writeFile }) => writeFile(resolve(runtimeRoot, "source-install-output.txt"), install.output, "utf8"));
    if (install.exit_code !== 0) throw new Error("Pinned source-commit dependency installation failed.");
    const command = state.manifest.source_commit === STAGE_ONE_SOURCE_COMMIT
      ? ["run", "release:stage-1:ci"]
      : ["run", "release:ci", "--", "--internal-source-reproduction"];
    const reproduction = await runNpmCommand({
      command_arguments: command,
      working_directory: worktreeRoot,
      environment: { ...process.env, PUBLIC_SITE_ORIGIN: input.site_origin },
    });
    await import("node:fs/promises").then(({ writeFile }) => writeFile(resolve(runtimeRoot, "source-reproduction-output.txt"), reproduction.output, "utf8"));
    if (reproduction.exit_code !== 0) throw new Error("Source-commit release reproduction failed.");
    const outputRoot = await mkdtemp(resolve(runtimeRoot, "reproduced-"));
    await rm(outputRoot, { recursive: true, force: true });
    await cp(resolve(worktreeRoot, "dist"), outputRoot, { recursive: true, errorOnExist: true, force: false });
    return outputRoot;
  } finally {
    await removeDetachedReleaseWorktree({ repository_root: input.repository_root, worktree_root: worktreeRoot }).catch(() => undefined);
    await rm(worktreeRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function runReleaseCi(input: {
  repository_root: string;
  site_origin: SiteOrigin;
  logger: ReleaseLogger;
  internal_source_reproduction?: boolean;
}): Promise<{ release_id: string; manifest_file_count: number }> {
  await recoverInterruptedReleasePromotions(input.repository_root);
  const state = await loadReleaseState(input.repository_root);
  await verifyAllReleaseArchives(input.repository_root, state.history);
  const descendantCommit = await readGitHead(input.repository_root);
  for (const release of state.history.releases) {
    await requireCommitAncestor({ repository_root: input.repository_root, source_commit: release.source_commit, descendant_commit: descendantCommit });
  }
  if (!input.internal_source_reproduction) await requireReleaseStateUnchanged(input.repository_root);

  let outputRoot: string;
  let stagingRoot: string | undefined;
  if (input.internal_source_reproduction) {
    const built = await buildVerifiedReleaseOutput({
      repository_root: input.repository_root,
      site_origin: input.site_origin,
      descriptor: state.descriptor,
      source_commit: state.manifest.source_commit,
      previous_release_id: state.manifest.previous_release_id,
      retained_release_ids: state.manifest.retained_release_ids,
      retained_history: state.history,
      exclude_retained_release_id: state.descriptor.release_id,
      logger: input.logger,
    });
    outputRoot = built.output_root;
    stagingRoot = built.staging_root;
    if (!releaseManifestsEqual(state.manifest, built.manifest)) throw new Error("Reproduced manifest differs from committed active manifest.");
  } else {
    outputRoot = await reproduceReleaseFromSource(input);
  }
  try {
    const inventory = await inventoryReleaseFiles(outputRoot);
    if (JSON.stringify(inventory) !== JSON.stringify(state.manifest.files)) {
      throw new Error("Source-commit output differs from the active manifest inventory.");
    }
    await verifyActiveImmutableArtifacts({ output_root: outputRoot, repository_root: input.repository_root, release_id: state.descriptor.release_id });
    await promoteReproducedOutput({ repository_root: input.repository_root, staged_output_root: outputRoot });
  } finally {
    if (stagingRoot) await rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
    else await rm(outputRoot, { recursive: true, force: true }).catch(() => undefined);
  }
  return { release_id: state.descriptor.release_id, manifest_file_count: state.manifest.files.length };
}
