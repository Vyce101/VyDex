// Promotes verified release state and output with rollback and transaction evidence.
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { RELEASE_ARCHIVE_ROOT, RELEASE_DESCRIPTOR_PATH, RELEASE_HISTORY_PATH, RELEASE_MANIFEST_PATH } from "./manifest";

type PromotionJournal = {
  version: "1.0.0";
  kind: "reproduction" | "next-release";
  phase: "prepared" | "committed";
  targets: Record<string, string>;
  backups: Record<string, string>;
  had_targets: Record<string, boolean>;
};

async function exists(filename: string): Promise<boolean> {
  try {
    const { lstat } = await import("node:fs/promises");
    await lstat(filename);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function validateRecoveryJournal(repositoryRoot: string, transactionRoot: string, journal: PromotionJournal): void {
  if (journal.version !== "1.0.0" || !["reproduction", "next-release"].includes(journal.kind)) {
    throw new Error(`Unsupported release promotion journal in ${transactionRoot}.`);
  }
  const allowedTargets = new Set([
    resolve(repositoryRoot, RELEASE_DESCRIPTOR_PATH),
    resolve(repositoryRoot, RELEASE_MANIFEST_PATH),
    resolve(repositoryRoot, RELEASE_HISTORY_PATH),
    resolve(repositoryRoot, "dist"),
  ]);
  for (const [key, target] of Object.entries(journal.targets)) {
    const isArchive = key === "archive" && isInside(resolve(repositoryRoot, RELEASE_ARCHIVE_ROOT), target);
    if (!allowedTargets.has(resolve(target)) && !isArchive) throw new Error(`Unsafe release recovery target ${target}.`);
  }
  for (const backup of Object.values(journal.backups)) {
    if (!isInside(transactionRoot, backup)) throw new Error(`Unsafe release recovery backup ${backup}.`);
  }
}

async function recoverPreparedTransaction(transactionRoot: string, journal: PromotionJournal): Promise<void> {
  if (journal.targets.archive && await exists(journal.targets.archive)) {
    const recoveredArchive = resolve(transactionRoot, "uncommitted-archive");
    await rm(recoveredArchive, { recursive: true, force: true });
    await rename(journal.targets.archive, recoveredArchive);
  }
  for (const key of ["descriptor", "manifest", "history", "output"] as const) {
    const target = journal.targets[key];
    const backup = journal.backups[key];
    if (!target || !backup) continue;
    if (!journal.had_targets[key]) {
      await rm(target, { recursive: true, force: true });
      continue;
    }
    if (!await exists(backup)) continue;
    await rm(target, { recursive: true, force: true });
    await rename(backup, target);
  }
}

export async function recoverInterruptedReleasePromotions(repositoryRoot: string): Promise<void> {
  const transactionParent = resolve(repositoryRoot, "runtime/release-promotion");
  if (!await exists(transactionParent)) return;
  const entries = await readdir(transactionParent, { withFileTypes: true });
  for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
    const transactionRoot = resolve(transactionParent, entry.name);
    const journalPath = resolve(transactionRoot, "transaction.json");
    if (!await exists(journalPath)) continue;
    let journal: PromotionJournal;
    try {
      journal = JSON.parse(await readFile(journalPath, "utf8")) as PromotionJournal;
      validateRecoveryJournal(repositoryRoot, transactionRoot, journal);
    } catch (cause) {
      throw new Error(`Release promotion recovery requires manual inspection of ${transactionRoot}.`, { cause });
    }
    if (journal.phase === "prepared") await recoverPreparedTransaction(transactionRoot, journal);
    await rm(transactionRoot, { recursive: true, force: true });
  }
}

export async function promoteReproducedOutput(input: {
  repository_root: string;
  staged_output_root: string;
}): Promise<void> {
  const transactionParent = resolve(input.repository_root, "runtime/release-promotion");
  await mkdir(transactionParent, { recursive: true });
  const transactionRoot = await mkdtemp(resolve(transactionParent, "reproduction-"));
  const target = resolve(input.repository_root, "dist");
  const backup = resolve(transactionRoot, "dist-backup");
  await mkdir(transactionRoot, { recursive: true });
  const hadTarget = await exists(target);
  const journal = resolve(transactionRoot, "transaction.json");
  const journalValue: PromotionJournal = {
    version: "1.0.0",
    kind: "reproduction",
    phase: "prepared",
    targets: { output: target },
    backups: { output: backup },
    had_targets: { output: hadTarget },
  };
  await writeFile(journal, `${JSON.stringify(journalValue, null, 2)}\n`, "utf8");
  try {
    if (hadTarget) await rename(target, backup);
    await rename(input.staged_output_root, target);
    await writeFile(journal, `${JSON.stringify({ ...journalValue, phase: "committed" }, null, 2)}\n`, "utf8");
  } catch (cause) {
    await rm(target, { recursive: true, force: true }).catch(() => undefined);
    if (hadTarget) await rename(backup, target).catch(() => undefined);
    throw new Error("Verified release output could not be promoted; previous dist was restored.", { cause });
  }
  await rm(transactionRoot, { recursive: true, force: true });
}

export async function promoteNextRelease(input: {
  repository_root: string;
  staged_output_root: string;
  staged_archive_root: string;
  archive_target_root: string;
  descriptor_raw: string;
  manifest_raw: string;
  history_raw: string;
  transaction_id?: string;
  operations?: { rename: typeof rename };
}): Promise<void> {
  const renamePath = input.operations?.rename ?? rename;
  const transactionParent = resolve(input.repository_root, "runtime/release-promotion");
  await mkdir(transactionParent, { recursive: true });
  const transactionRoot = input.transaction_id
    ? resolve(transactionParent, input.transaction_id)
    : await mkdtemp(resolve(transactionParent, "next-"));
  const journal = resolve(transactionRoot, "transaction.json");
  const targets = {
    descriptor: resolve(input.repository_root, RELEASE_DESCRIPTOR_PATH),
    manifest: resolve(input.repository_root, RELEASE_MANIFEST_PATH),
    history: resolve(input.repository_root, RELEASE_HISTORY_PATH),
    output: resolve(input.repository_root, "dist"),
    archive: resolve(input.archive_target_root),
  };
  const staged = {
    descriptor: resolve(transactionRoot, "release.json"),
    manifest: resolve(transactionRoot, "release-manifest.json"),
    history: resolve(transactionRoot, "release-history.json"),
  };
  const backups = {
    descriptor: resolve(transactionRoot, "release-backup.json"),
    manifest: resolve(transactionRoot, "manifest-backup.json"),
    history: resolve(transactionRoot, "history-backup.json"),
    output: resolve(transactionRoot, "dist-backup"),
  };
  const hadTargets = {
    descriptor: await exists(targets.descriptor),
    manifest: await exists(targets.manifest),
    history: await exists(targets.history),
    output: await exists(targets.output),
    archive: false,
  };
  await mkdir(transactionRoot, { recursive: true });
  await mkdir(dirname(targets.archive), { recursive: true });
  await writeFile(staged.descriptor, input.descriptor_raw, { encoding: "utf8", flag: "wx" });
  await writeFile(staged.manifest, input.manifest_raw, { encoding: "utf8", flag: "wx" });
  await writeFile(staged.history, input.history_raw, { encoding: "utf8", flag: "wx" });
  const journalValue: PromotionJournal = {
    version: "1.0.0",
    kind: "next-release",
    phase: "prepared",
    targets,
    backups,
    had_targets: hadTargets,
  };
  await writeFile(journal, `${JSON.stringify(journalValue, null, 2)}\n`, "utf8");
  if (await exists(targets.archive)) throw new Error(`Immutable release archive already exists at ${targets.archive}.`);

  const movedBackups: string[] = [];
  let archiveSelected = false;
  let outputSelected = false;
  try {
    for (const key of ["descriptor", "manifest", "history", "output"] as const) {
      if (await exists(targets[key])) {
        await renamePath(targets[key], backups[key]);
        movedBackups.push(key);
      }
    }
    await renamePath(input.staged_archive_root, targets.archive);
    archiveSelected = true;
    await renamePath(input.staged_output_root, targets.output);
    outputSelected = true;
    await renamePath(staged.descriptor, targets.descriptor);
    await renamePath(staged.manifest, targets.manifest);
    await renamePath(staged.history, targets.history);
    await writeFile(journal, `${JSON.stringify({ ...journalValue, phase: "committed" }, null, 2)}\n`, "utf8");
  } catch (cause) {
    for (const key of ["descriptor", "manifest", "history"] as const) await rm(targets[key], { force: true }).catch(() => undefined);
    if (outputSelected) await rm(targets.output, { recursive: true, force: true }).catch(() => undefined);
    if (archiveSelected) {
      await renamePath(targets.archive, input.staged_archive_root).catch(async () => {
        await writeFile(resolve(targets.archive, "INCOMPLETE"), "This archive is non-authoritative and absent from release history.\n", "utf8").catch(() => undefined);
      });
    }
    for (const key of [...movedBackups].reverse() as Array<keyof typeof backups>) {
      await renamePath(backups[key], targets[key]).catch(() => undefined);
    }
    throw new Error("Next-release promotion failed; previous active state was restored.", { cause });
  }
  await rm(transactionRoot, { recursive: true, force: true });
}
