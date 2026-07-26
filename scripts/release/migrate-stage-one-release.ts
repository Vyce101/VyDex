// Performs the one-time, explicitly confirmed Stage 1 archive migration.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { rm } from "node:fs/promises";
import { migrateStageOneRelease, reproduceStageOneMigrationSource } from "../../src/release/release-publication";

const executeFile = promisify(execFile);

async function main(): Promise<void> {
  if (process.env.CI) throw new Error("Stage 1 archive migration cannot run in CI.");
  if (!process.argv.includes("--confirm") || process.argv.at(-1) !== "MIGRATE_STAGE_ONE_RELEASE") {
    throw new Error("Stage 1 archive migration requires --confirm MIGRATE_STAGE_ONE_RELEASE.");
  }
  const repositoryRoot = process.cwd();
  const { stdout } = await executeFile("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" });
  const outputRoot = await reproduceStageOneMigrationSource({ repository_root: repositoryRoot, site_origin: "https://vydex.pages.dev" });
  try {
    const result = await migrateStageOneRelease({
      repository_root: repositoryRoot,
      output_root: outputRoot,
      descendant_commit: stdout.trim(),
    });
    process.stdout.write(`Migrated Stage 1 release ${result.manifest.release_id} to ${result.archive_root}.\n`);
  } finally {
    await rm(outputRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Stage 1 migration failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
