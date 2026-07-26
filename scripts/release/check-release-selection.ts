// Fails when current committed source no longer reproduces the active public artifact.
import { parseRequiredPublicSiteOrigin } from "../../src/adapters/public-site-origin";
import { inspectReleaseSelection, NEXT_RELEASE_CONFIRMATION } from "../../src/release/release-publication";
import { createReleaseLogger } from "../../src/shared/release-logger";

async function main(): Promise<void> {
  const repositoryRoot = process.cwd();
  const logger = await createReleaseLogger({ filesystem_root: repositoryRoot });
  const inspection = await inspectReleaseSelection({
    repository_root: repositoryRoot,
    site_origin: parseRequiredPublicSiteOrigin(process.env.PUBLIC_SITE_ORIGIN),
    logger,
  });
  if (inspection.status === "stale") {
    const changedPaths = inspection.changed_artifact_paths.length > 0
      ? ` Changed artifact paths: ${inspection.changed_artifact_paths.join(", ")}.`
      : " The release manifest contract changed without a file-inventory difference.";
    throw new Error(
      `Active release ${inspection.active_release_id} no longer matches committed source ${inspection.head_commit}.${changedPaths} Run npm run release:sync -- --confirm ${NEXT_RELEASE_CONFIRMATION} from a clean branch, then review and commit the generated release state.`,
    );
  }
  await logger.info(`Active release ${inspection.active_release_id} matches current public output.`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Release selection check failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
