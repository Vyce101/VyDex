// Synchronizes active release selection with current committed public output when explicitly confirmed.
import { parseRequiredPublicSiteOrigin } from "../../src/adapters/public-site-origin";
import { NEXT_RELEASE_CONFIRMATION, syncReleaseSelection } from "../../src/release/release-publication";
import { createReleaseLogger } from "../../src/shared/release-logger";

function confirmationArgument(arguments_: string[]): string {
  if (arguments_.length !== 2 || arguments_[0] !== "--confirm") {
    throw new Error(`Usage: npm run release:sync -- --confirm ${NEXT_RELEASE_CONFIRMATION}`);
  }
  return arguments_[1] ?? "";
}

async function main(): Promise<void> {
  const repositoryRoot = process.cwd();
  const logger = await createReleaseLogger({ filesystem_root: repositoryRoot });
  const result = await syncReleaseSelection({
    repository_root: repositoryRoot,
    site_origin: parseRequiredPublicSiteOrigin(process.env.PUBLIC_SITE_ORIGIN),
    confirmation: confirmationArgument(process.argv.slice(2)),
    logger,
  });
  if (result.status === "current") {
    await logger.info(`Active release ${result.inspection.active_release_id} already matches current public output.`);
    return;
  }
  await logger.info([
    "Release selection synchronization created a successor.",
    `Previous Release ID: ${result.release.previous_release_id}`,
    `New Release ID: ${result.release.release_id}`,
    `Generated at: ${result.release.generated_at}`,
    `Source commit: ${result.release.source_commit}`,
    `Immutable export: ${result.release.dataset_public_path}`,
    "Files to review and commit:",
    ...result.release.files_to_commit.map((filename) => `- ${filename}`),
  ].join("\n"));
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Release selection synchronization failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
