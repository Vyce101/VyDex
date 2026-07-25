// Promotes verified static output and its internal manifest with rollback on failure.
import { lstat, mkdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { STAGE_ONE_RELEASE_MANIFEST_PATH } from "./manifest";

export type StageOnePromotionOperations = {
  rename: typeof rename;
};

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function assertWithinRoot(filesystemRoot: string, candidate: string): void {
  const root = resolve(filesystemRoot);
  const relativePath = relative(root, resolve(candidate));
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(`Release promotion target escapes the repository root: ${candidate}.`);
  }
}

async function removeFileIfPresent(filename: string): Promise<void> {
  try {
    await unlink(filename);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function promoteStageOneReleaseOutput(input: {
  filesystem_root: string;
  staged_output_root: string;
  serialized_manifest: string;
  transaction_id: string;
  operations?: Partial<StageOnePromotionOperations>;
}): Promise<void> {
  const renamePath = input.operations?.rename ?? rename;
  const filesystemRoot = resolve(input.filesystem_root);
  const runtimeRoot = resolve(filesystemRoot, "runtime/stage-one-release");
  const targetOutput = resolve(filesystemRoot, "dist");
  const targetManifest = resolve(filesystemRoot, STAGE_ONE_RELEASE_MANIFEST_PATH);
  const stagedManifest = resolve(runtimeRoot, `${input.transaction_id}-manifest.json`);
  const outputBackup = resolve(runtimeRoot, `${input.transaction_id}-dist-backup`);
  const manifestBackup = resolve(runtimeRoot, `${input.transaction_id}-manifest-backup.json`);
  for (const path of [runtimeRoot, targetOutput, targetManifest, stagedManifest, outputBackup, manifestBackup]) {
    assertWithinRoot(filesystemRoot, path);
  }
  if (resolve(input.staged_output_root) === targetOutput) {
    throw new Error("Release staging output must not be the promotable dist directory.");
  }

  await mkdir(runtimeRoot, { recursive: true });
  await mkdir(dirname(targetManifest), { recursive: true });
  await writeFile(stagedManifest, input.serialized_manifest, { encoding: "utf8", flag: "wx" });

  const hadOutput = await exists(targetOutput);
  const hadManifest = await exists(targetManifest);
  let backedUpOutput = false;
  let backedUpManifest = false;
  let promotedOutput = false;
  let promotedManifest = false;

  try {
    if (hadOutput) {
      await renamePath(targetOutput, outputBackup);
      backedUpOutput = true;
    }
    if (hadManifest) {
      await renamePath(targetManifest, manifestBackup);
      backedUpManifest = true;
    }
    await renamePath(resolve(input.staged_output_root), targetOutput);
    promotedOutput = true;
    await renamePath(stagedManifest, targetManifest);
    promotedManifest = true;
  } catch (error) {
    if (promotedManifest) await removeFileIfPresent(targetManifest).catch(() => undefined);
    if (promotedOutput) await rm(targetOutput, { recursive: true, force: true }).catch(() => undefined);
    if (backedUpManifest) await renamePath(manifestBackup, targetManifest).catch(() => undefined);
    if (backedUpOutput) await renamePath(outputBackup, targetOutput).catch(() => undefined);
    await removeFileIfPresent(stagedManifest).catch(() => undefined);
    throw new Error("Verified Stage 1 output could not be promoted; previous output was restored.", {
      cause: error,
    });
  }

  await rm(outputBackup, { recursive: true, force: true }).catch(() => undefined);
  await removeFileIfPresent(manifestBackup).catch(() => undefined);
}
