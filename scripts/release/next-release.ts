// Creates one explicitly confirmed successor release without deploying or committing it.
import { parseRequiredPublicSiteOrigin } from "../../src/adapters/public-site-origin";
import { NEXT_RELEASE_CONFIRMATION, runNextRelease } from "../../src/release/release-publication";
import { createReleaseLogger } from "../../src/shared/release-logger";

function confirmationArgument(arguments_: string[]): string {
  if (arguments_.length !== 2 || arguments_[0] !== "--confirm") {
    throw new Error(`Usage: npm run release:next -- --confirm ${NEXT_RELEASE_CONFIRMATION}`);
  }
  return arguments_[1] ?? "";
}

async function main(): Promise<void> {
  const repositoryRoot = process.cwd();
  const logger = await createReleaseLogger({ filesystem_root: repositoryRoot });
  const result = await runNextRelease({
    repository_root: repositoryRoot,
    site_origin: parseRequiredPublicSiteOrigin(process.env.PUBLIC_SITE_ORIGIN),
    confirmation: confirmationArgument(process.argv.slice(2)),
    logger,
  });
  await logger.info([
    "Next release construction succeeded.",
    `Previous Release ID: ${result.previous_release_id}`,
    `New Release ID: ${result.release_id}`,
    `Generated at: ${result.generated_at}`,
    `Source commit: ${result.source_commit}`,
    `Immutable export: ${result.dataset_public_path}`,
    `Active manifest: ${result.manifest_path}`,
    `Archive: ${result.archive_path}`,
    "Files to review and commit:",
    ...result.files_to_commit.map((filename) => `- ${filename}`),
  ].join("\n"));
}

main().catch((error: unknown) => {
  process.stderr.write(`Next release creation failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
