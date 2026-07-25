// Runs the sole atomic production command for the initial VyDex Stage 1 release.
import { parseRequiredPublicSiteOrigin } from "../../src/adapters/public-site-origin";
import { formatReleaseDiagnostics, runStageOneRelease } from "../../src/release/stage-one-release";
import { createReleaseLogger } from "../../src/shared/release-logger";

async function main(): Promise<void> {
  const filesystemRoot = process.cwd();
  const logger = await createReleaseLogger({ filesystem_root: filesystemRoot });
  const allowedArguments = new Set(["--require-existing-release-state"]);
  const unknownArgument = process.argv.slice(2).find((argument) => !allowedArguments.has(argument));
  if (unknownArgument) {
    await logger.critical(`Unknown Stage 1 release argument: ${unknownArgument}`);
    process.exitCode = 1;
    return;
  }
  const releaseStatePolicy = process.argv.includes("--require-existing-release-state")
    ? "existing_only"
    : "bootstrap";
  if (process.env.CI && releaseStatePolicy === "bootstrap") {
    await logger.critical(
      "CI must use --require-existing-release-state and cannot bootstrap production release identity.",
    );
    process.exitCode = 1;
    return;
  }

  let siteOrigin;
  try {
    siteOrigin = parseRequiredPublicSiteOrigin(process.env.PUBLIC_SITE_ORIGIN);
  } catch (error) {
    await logger.critical(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }
  const result = await runStageOneRelease({
    filesystem_root: filesystemRoot,
    site_origin: siteOrigin,
    release_state_policy: releaseStatePolicy,
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
      `Export filename: ${result.manifest.export_filename}`,
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
