// Constructs and atomically selects one explicitly confirmed successor release.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { v7 as uuidV7 } from "uuid";
import { requireCleanReleaseGitState } from "../../adapters/release-git";
import {
  releaseHistorySchema,
  releaseMetadataSchema,
  serializeImmutablePublicContract,
  serializeReleaseHistory,
  type ReleaseMetadata,
  type SiteOrigin,
} from "../../domain";
import type { ReleaseLogger } from "../../shared/release-logger";
import { buildVerifiedReleaseOutput, type RunReleaseBuildCommand } from "./build-release-output";
import { createImmutablePublicContract } from "./immutable-artifacts";
import {
  RELEASE_ARCHIVE_ROOT,
  RELEASE_DESCRIPTOR_PATH,
  RELEASE_HISTORY_PATH,
  RELEASE_MANIFEST_PATH,
  serializeReleaseManifest,
} from "./manifest";
import { promoteNextRelease, recoverInterruptedReleasePromotions } from "./promotion";
import {
  ARCHIVED_DESCRIPTOR_FILENAME,
  ARCHIVED_MANIFEST_FILENAME,
  IMMUTABLE_PUBLIC_CONTRACT_FILENAME,
  IMMUTABLE_PUBLIC_DIRECTORY,
  loadReleaseState,
} from "./release-state";
import { runReleaseCi } from "./run-release-ci";

export const NEXT_RELEASE_CONFIRMATION = "CREATE_NEXT_RELEASE" as const;

export type NextReleaseResult = {
  previous_release_id: string;
  release_id: string;
  generated_at: string;
  source_commit: string;
  dataset_public_path: string;
  manifest_path: string;
  archive_path: string;
  files_to_commit: string[];
};

export async function runNextRelease(input: {
  repository_root: string;
  site_origin: SiteOrigin;
  confirmation: string;
  environment?: NodeJS.ProcessEnv;
  logger: ReleaseLogger;
  dependencies?: {
    now?: () => Date;
    create_release_id?: () => string;
    run_command?: RunReleaseBuildCommand;
    reproduce_active?: typeof runReleaseCi;
  };
}): Promise<NextReleaseResult> {
  const environment = input.environment ?? process.env;
  if (environment.CI) throw new Error("release:next is forbidden in CI.");
  if (input.confirmation !== NEXT_RELEASE_CONFIRMATION) {
    throw new Error(`release:next requires --confirm ${NEXT_RELEASE_CONFIRMATION}.`);
  }
  const root = resolve(input.repository_root);
  const lockRoot = resolve(root, "runtime/release-next.lock");
  let ownsLock = false;
  try {
    await mkdir(lockRoot);
    ownsLock = true;
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Another next-release attempt owns ${lockRoot}. Verify no release process is running before removing a stale lock.`);
    }
    throw cause;
  }

  let stagingRoot: string | undefined;
  try {
    await recoverInterruptedReleasePromotions(root);
    const capturedGit = await requireCleanReleaseGitState(root);
    await input.logger.info(`Captured clean release source commit ${capturedGit.head} on branch ${capturedGit.branch}.`);
    const current = await loadReleaseState(root);
    const reproduceActive = input.dependencies?.reproduce_active ?? runReleaseCi;
    await reproduceActive({ repository_root: root, site_origin: input.site_origin, logger: input.logger });
    const postReproductionGit = await requireCleanReleaseGitState(root);
    if (postReproductionGit.head !== capturedGit.head || postReproductionGit.branch !== capturedGit.branch) {
      throw new Error("Git HEAD or branch changed while reproducing the active release.");
    }

    const createReleaseId = input.dependencies?.create_release_id ?? uuidV7;
    const now = input.dependencies?.now ?? (() => new Date());
    const descriptor: ReleaseMetadata = releaseMetadataSchema.parse({
      release_id: createReleaseId(),
      generated_at: now().toISOString(),
    });
    if (current.history.releases.some(({ release_id }) => release_id === descriptor.release_id)) {
      throw new Error(`Generated Release ID ${descriptor.release_id} already exists in release history.`);
    }
    if (Date.parse(descriptor.generated_at) <= Date.parse(current.descriptor.generated_at)) {
      throw new Error("The next release timestamp must be later than the active release timestamp.");
    }

    const built = await buildVerifiedReleaseOutput({
      repository_root: root,
      site_origin: input.site_origin,
      descriptor,
      source_commit: capturedGit.head,
      previous_release_id: current.descriptor.release_id,
      retained_release_ids: current.history.releases.map(({ release_id }) => release_id),
      retained_history: current.history,
      logger: input.logger,
      run_command: input.dependencies?.run_command,
    });
    stagingRoot = built.staging_root;
    if (built.manifest.source_commit !== capturedGit.head) throw new Error("Candidate source_commit changed during construction.");
    const descriptorRaw = `${JSON.stringify(descriptor, null, 2)}\n`;
    const manifestRaw = serializeReleaseManifest(built.manifest);
    const archiveRelative = `${RELEASE_ARCHIVE_ROOT}/${descriptor.release_id}`;
    const datasetPublicPath = built.prepared_export.artifact.public_path;
    const nextHistory = releaseHistorySchema.parse({
      history_version: "1.0.0",
      releases: [...current.history.releases, {
        release_id: descriptor.release_id,
        generated_at: descriptor.generated_at,
        source_commit: capturedGit.head,
        descriptor_path: `${archiveRelative}/${ARCHIVED_DESCRIPTOR_FILENAME}`,
        manifest_path: `${archiveRelative}/${ARCHIVED_MANIFEST_FILENAME}`,
        dataset_public_path: datasetPublicPath,
        previous_release_id: current.descriptor.release_id,
      }],
    });
    const contract = await createImmutablePublicContract({
      output_root: built.output_root,
      release_id: descriptor.release_id,
      dataset_public_path: datasetPublicPath,
      dataset_filename: built.prepared_export.presentation.download_filename,
      schema_public_path: built.prepared_export.artifact.schema_public_path,
    });
    const stagedArchive = resolve(stagingRoot, "archive", descriptor.release_id);
    await mkdir(resolve(stagedArchive, IMMUTABLE_PUBLIC_DIRECTORY), { recursive: true });
    await writeFile(resolve(stagedArchive, ARCHIVED_DESCRIPTOR_FILENAME), descriptorRaw, "utf8");
    await writeFile(resolve(stagedArchive, ARCHIVED_MANIFEST_FILENAME), manifestRaw, "utf8");
    await writeFile(resolve(stagedArchive, IMMUTABLE_PUBLIC_CONTRACT_FILENAME), serializeImmutablePublicContract(contract), "utf8");
    for (const route of contract.routes) {
      const destination = resolve(stagedArchive, IMMUTABLE_PUBLIC_DIRECTORY, route.archive_path);
      await mkdir(dirname(destination), { recursive: true });
      await cp(resolve(built.output_root, route.archive_path), destination, { errorOnExist: true, force: false });
    }

    const finalGit = await requireCleanReleaseGitState(root);
    if (finalGit.head !== capturedGit.head || finalGit.branch !== capturedGit.branch) {
      throw new Error("Repository inputs changed before next-release promotion.");
    }
    if ((await readFile(resolve(root, RELEASE_DESCRIPTOR_PATH), "utf8")) !== current.descriptor_raw ||
        (await readFile(resolve(root, RELEASE_MANIFEST_PATH), "utf8")) !== current.manifest_raw ||
        (await readFile(resolve(root, RELEASE_HISTORY_PATH), "utf8")) !== current.history_raw) {
      throw new Error("Active release state changed before next-release promotion.");
    }
    await promoteNextRelease({
      repository_root: root,
      staged_output_root: built.output_root,
      staged_archive_root: stagedArchive,
      archive_target_root: resolve(root, archiveRelative),
      descriptor_raw: descriptorRaw,
      manifest_raw: manifestRaw,
      history_raw: serializeReleaseHistory(nextHistory),
    });
    const filesToCommit = [RELEASE_DESCRIPTOR_PATH, RELEASE_MANIFEST_PATH, RELEASE_HISTORY_PATH, `${archiveRelative}/`];
    await input.logger.info(`Promoted release ${descriptor.release_id} from source commit ${capturedGit.head}.`);
    return {
      previous_release_id: current.descriptor.release_id,
      release_id: descriptor.release_id,
      generated_at: descriptor.generated_at,
      source_commit: capturedGit.head,
      dataset_public_path: datasetPublicPath,
      manifest_path: RELEASE_MANIFEST_PATH,
      archive_path: archiveRelative,
      files_to_commit: filesToCommit,
    };
  } finally {
    if (stagingRoot) await rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
    if (ownsLock) await rm(lockRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}
