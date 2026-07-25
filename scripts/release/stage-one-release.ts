// Runs the sole atomic production command for the initial VyDex Stage 1 release.
import { formatReleaseDiagnostics, runStageOneRelease } from "../../src/release/stage-one-release";
import { createReleaseLogger } from "../../src/shared/release-logger";

async function main(): Promise<void> {
  const filesystemRoot = process.cwd();
  const logger = await createReleaseLogger({ filesystem_root: filesystemRoot });
  const result = await runStageOneRelease({
    filesystem_root: filesystemRoot,
    dependencies: { logger },
  });
  if (!result.success) {
    const report = formatReleaseDiagnostics(result.diagnostics);
    await logger.critical(`Stage 1 release failed.\n${report}`);
    process.exitCode = 1;
    return;
  }

  await logger.info(
    [
      "Stage 1 release gate succeeded.",
      `Release ID: ${result.manifest.release_id}`,
      `Generated at: ${result.manifest.generated_at}`,
      `Manifest: generated/release-data/release-manifest.json`,
      `Static output: dist/`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Stage 1 release command failed unexpectedly: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
