// Migrates the verified legacy Stage 1 state into the immutable release archive.
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { addDetachedReleaseWorktree, readFileAtCommit, removeDetachedReleaseWorktree, requireCommitAncestor } from "../../adapters/release-git";
import { runNpmCommand } from "../../adapters/npm-command-runner";
import {
  releaseHistorySchema,
  releaseMetadataSchema,
  serializeImmutablePublicContract,
  serializeReleaseHistory,
  type ImmutablePublicContract,
} from "../../domain";
import {
  parseExistingStageOneReleaseManifest,
  verifyStageOneReleaseInventory,
} from "../stage-one-release";
import {
  RELEASE_ARCHIVE_ROOT,
  RELEASE_DESCRIPTOR_PATH,
  RELEASE_HISTORY_PATH,
  RELEASE_MANIFEST_PATH,
  releaseManifestSchema,
  serializeReleaseManifest,
  type ReleaseManifest,
} from "./manifest";
import {
  ARCHIVED_DESCRIPTOR_FILENAME,
  ARCHIVED_MANIFEST_FILENAME,
  IMMUTABLE_PUBLIC_CONTRACT_FILENAME,
  IMMUTABLE_PUBLIC_DIRECTORY,
} from "./release-state";

export const STAGE_ONE_SOURCE_COMMIT = "655b7c8bf4a8b5cbb88bbc9427735084c5f19973" as const;

export async function reproduceStageOneMigrationSource(input: {
  repository_root: string;
  site_origin: string;
}): Promise<string> {
  const root = resolve(input.repository_root);
  await mkdir(resolve(root, "runtime"), { recursive: true });
  const worktreeRoot = await mkdtemp(resolve(root, "runtime/stage-one-source-"));
  const outputRoot = await mkdtemp(resolve(root, "runtime/stage-one-source-output-"));
  await rm(worktreeRoot, { recursive: true, force: true });
  await rm(outputRoot, { recursive: true, force: true });
  await addDetachedReleaseWorktree({ repository_root: root, worktree_root: worktreeRoot, source_commit: STAGE_ONE_SOURCE_COMMIT });
  try {
    const install = await runNpmCommand({ command_arguments: ["ci"], working_directory: worktreeRoot, environment: process.env });
    await writeFile(resolve(root, "runtime/stage-one-migration-install-output.txt"), install.output, "utf8");
    if (install.exit_code !== 0) throw new Error(`Pinned Stage 1 dependency installation failed at ${STAGE_ONE_SOURCE_COMMIT}.`);
    const reproduction = await runNpmCommand({
      command_arguments: ["run", "release:stage-1:ci"],
      working_directory: worktreeRoot,
      environment: { ...process.env, PUBLIC_SITE_ORIGIN: input.site_origin },
    });
    await writeFile(resolve(root, "runtime/stage-one-migration-reproduction-output.txt"), reproduction.output, "utf8");
    if (reproduction.exit_code !== 0) throw new Error(`Stage 1 cannot be reproduced from ${STAGE_ONE_SOURCE_COMMIT}.`);
    await cp(resolve(worktreeRoot, "dist"), outputRoot, { recursive: true, errorOnExist: true, force: false });
    return outputRoot;
  } catch (cause) {
    await rm(outputRoot, { recursive: true, force: true }).catch(() => undefined);
    throw cause;
  } finally {
    await removeDetachedReleaseWorktree({ repository_root: root, worktree_root: worktreeRoot }).catch(() => undefined);
    await rm(worktreeRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

function sha256(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

async function pathExists(filename: string): Promise<boolean> {
  try {
    await import("node:fs/promises").then(({ stat }) => stat(filename));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function immutableRoute(input: {
  output_root: string;
  public_path: string;
  content_type: string;
  content_disposition?: string;
}): Promise<ImmutablePublicContract["routes"][number]> {
  const archivePath = input.public_path.replace(/^\/+/, "");
  const contents = await readFile(resolve(input.output_root, archivePath));
  return {
    public_path: input.public_path,
    archive_path: archivePath,
    bytes: contents.byteLength,
    sha256: sha256(contents),
    content_type: input.content_type,
    cache_control: "public, max-age=31536000, immutable",
    ...(input.content_disposition ? { content_disposition: input.content_disposition } : {}),
  };
}

export async function migrateStageOneRelease(input: {
  repository_root: string;
  output_root?: string;
  descendant_commit: string;
}): Promise<{ manifest: ReleaseManifest; archive_root: string }> {
  const root = resolve(input.repository_root);
  const outputRoot = resolve(input.output_root ?? resolve(root, "dist"));
  await requireCommitAncestor({
    repository_root: root,
    source_commit: STAGE_ONE_SOURCE_COMMIT,
    descendant_commit: input.descendant_commit,
  });
  const descriptorRaw = await readFile(resolve(root, RELEASE_DESCRIPTOR_PATH), "utf8");
  const legacyManifestRaw = await readFile(resolve(root, RELEASE_MANIFEST_PATH), "utf8");
  const sourceDescriptorRaw = await readFileAtCommit({ repository_root: root, source_commit: STAGE_ONE_SOURCE_COMMIT, repository_path: RELEASE_DESCRIPTOR_PATH });
  const sourceManifestRaw = await readFileAtCommit({ repository_root: root, source_commit: STAGE_ONE_SOURCE_COMMIT, repository_path: RELEASE_MANIFEST_PATH });
  if (descriptorRaw !== sourceDescriptorRaw || legacyManifestRaw !== sourceManifestRaw) {
    throw new Error(`Stage 1 migration requires descriptor and final manifest bytes from ${STAGE_ONE_SOURCE_COMMIT}.`);
  }
  const descriptor = releaseMetadataSchema.parse(JSON.parse(descriptorRaw));
  const legacy = parseExistingStageOneReleaseManifest(legacyManifestRaw);
  const inventoryDiagnostics = await verifyStageOneReleaseInventory({ output_root: outputRoot, manifest: legacy });
  if (inventoryDiagnostics.length > 0) throw new Error("Stage 1 public output does not reproduce its final manifest inventory.");

  const datasetPath = `/datasets/releases/${descriptor.release_id}/${legacy.export_filename}`;
  const schemaPath = new URL(legacy.json_schema_url).pathname;
  const contract: ImmutablePublicContract = {
    contract_version: "1.0.0",
    release_id: descriptor.release_id,
    routes: [
      await immutableRoute({ output_root: outputRoot, public_path: datasetPath, content_type: "application/json; charset=utf-8", content_disposition: `attachment; filename=\"${legacy.export_filename}\"` }),
      await immutableRoute({ output_root: outputRoot, public_path: schemaPath, content_type: "application/schema+json; charset=utf-8" }),
    ].sort((left, right) => left.public_path.localeCompare(right.public_path, "en")),
  };
  const manifest = releaseManifestSchema.parse({
    ...legacy,
    manifest_version: "2.0.0",
    source_commit: STAGE_ONE_SOURCE_COMMIT,
    previous_release_id: null,
    retained_release_ids: [],
    current_release_routes: legacy.generated_routes,
    retained_immutable_routes: [],
  });
  const manifestRaw = serializeReleaseManifest(manifest);
  const archiveRelative = `${RELEASE_ARCHIVE_ROOT}/${descriptor.release_id}`;
  const history = releaseHistorySchema.parse({
    history_version: "1.0.0",
    releases: [{
      release_id: descriptor.release_id,
      generated_at: descriptor.generated_at,
      source_commit: STAGE_ONE_SOURCE_COMMIT,
      descriptor_path: `${archiveRelative}/${ARCHIVED_DESCRIPTOR_FILENAME}`,
      manifest_path: `${archiveRelative}/${ARCHIVED_MANIFEST_FILENAME}`,
      dataset_public_path: datasetPath,
      previous_release_id: null,
    }],
  });

  const stagingRoot = resolve(root, "runtime/stage-one-archive-migration");
  const stagedArchive = resolve(stagingRoot, descriptor.release_id);
  const archiveRoot = resolve(root, archiveRelative);
  const stagedManifest = resolve(stagingRoot, "release-manifest.json");
  const stagedHistory = resolve(stagingRoot, "release-history.json");
  const manifestBackup = resolve(stagingRoot, "release-manifest-v1-backup.json");
  await rm(stagingRoot, { recursive: true, force: true });
  await mkdir(resolve(stagedArchive, IMMUTABLE_PUBLIC_DIRECTORY), { recursive: true });
  await writeFile(resolve(stagedArchive, ARCHIVED_DESCRIPTOR_FILENAME), descriptorRaw, "utf8");
  await writeFile(resolve(stagedArchive, ARCHIVED_MANIFEST_FILENAME), manifestRaw, "utf8");
  await writeFile(resolve(stagedArchive, IMMUTABLE_PUBLIC_CONTRACT_FILENAME), serializeImmutablePublicContract(contract), "utf8");
  for (const route of contract.routes) {
    const destination = resolve(stagedArchive, IMMUTABLE_PUBLIC_DIRECTORY, route.archive_path);
    await mkdir(dirname(destination), { recursive: true });
    await cp(resolve(outputRoot, route.archive_path), destination, { errorOnExist: true, force: false });
  }
  await writeFile(stagedManifest, manifestRaw, { encoding: "utf8", flag: "wx" });
  await writeFile(stagedHistory, serializeReleaseHistory(history), { encoding: "utf8", flag: "wx" });
  await mkdir(resolve(root, RELEASE_ARCHIVE_ROOT), { recursive: true });
  if (await pathExists(archiveRoot)) {
    throw new Error(`Stage 1 archive already exists at ${archiveRelative}; migration will not rewrite it.`);
  }
  const historyTarget = resolve(root, RELEASE_HISTORY_PATH);
  if (await pathExists(historyTarget)) {
    throw new Error("Stage 1 release history already exists; migration will not rewrite it.");
  }
  let archiveSelected = false;
  let historySelected = false;
  let manifestBackedUp = false;
  try {
    await rename(resolve(root, RELEASE_MANIFEST_PATH), manifestBackup);
    manifestBackedUp = true;
    await rename(stagedArchive, archiveRoot);
    archiveSelected = true;
    await rename(stagedHistory, historyTarget);
    historySelected = true;
    await rename(stagedManifest, resolve(root, RELEASE_MANIFEST_PATH));
  } catch (cause) {
    if (historySelected) await rm(historyTarget, { force: true }).catch(() => undefined);
    if (archiveSelected) await rm(archiveRoot, { recursive: true, force: true }).catch(() => undefined);
    if (manifestBackedUp) {
      await rm(resolve(root, RELEASE_MANIFEST_PATH), { force: true }).catch(() => undefined);
      await rename(manifestBackup, resolve(root, RELEASE_MANIFEST_PATH)).catch(() => undefined);
    }
    throw new Error("Stage 1 archive migration failed; the legacy active state was restored.", { cause });
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
  return { manifest, archive_root: archiveRoot };
}
