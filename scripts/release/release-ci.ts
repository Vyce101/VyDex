// Reproduces the committed active release without creating identity.
import { parseRequiredPublicSiteOrigin } from "../../src/adapters/public-site-origin";
import { runReleaseCi } from "../../src/release/release-publication";
import { createReleaseLogger } from "../../src/shared/release-logger";

async function main(): Promise<void> {
  const allowed = new Set(["--internal-source-reproduction"]);
  const unknown = process.argv.slice(2).find((argument) => !allowed.has(argument));
  if (unknown) throw new Error(`Unknown release reproduction argument: ${unknown}.`);
  const repositoryRoot = process.cwd();
  const logger = await createReleaseLogger({ filesystem_root: repositoryRoot });
  const siteOrigin = parseRequiredPublicSiteOrigin(process.env.PUBLIC_SITE_ORIGIN);
  const result = await runReleaseCi({
    repository_root: repositoryRoot,
    site_origin: siteOrigin,
    logger,
    internal_source_reproduction: process.argv.includes("--internal-source-reproduction"),
  });
  await logger.info([
    "Committed release reproduction succeeded.",
    `Release ID: ${result.release_id}`,
    `Static files: ${result.manifest_file_count}`,
    "Static output: dist/",
  ].join("\n"));
}

main().catch((error: unknown) => {
  process.stderr.write(`Release reproduction failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
