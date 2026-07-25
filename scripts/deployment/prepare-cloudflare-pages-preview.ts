// Adds validated production-shaped redirects to a Cloudflare Pages preview build.
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prepareApplicationExport } from "../../src/adapters/application-export";
import { loadPersistedProductionApplicationRelease } from "../../src/adapters/application-release";
import { parseRequiredPublicSiteOrigin } from "../../src/adapters/public-site-origin";
import { collectStageOneRedirects, serializeStageOneRedirects } from "../../src/release/stage-one-release";
import { createReleaseLogger } from "../../src/shared/release-logger";

async function main(): Promise<void> {
  const filesystemRoot = process.cwd();
  const logger = await createReleaseLogger({ filesystem_root: filesystemRoot });
  const siteOrigin = parseRequiredPublicSiteOrigin(process.env.PUBLIC_SITE_ORIGIN);
  const release = await loadPersistedProductionApplicationRelease({
    filesystem_root: filesystemRoot,
    site_origin: siteOrigin,
  });
  const prepared = prepareApplicationExport(release);
  if (!prepared.success) {
    throw new Error(
      `Cloudflare Pages preview redirects require a valid export: ${prepared.diagnostics.map(({ code }) => code).join(", ")}.`,
    );
  }

  const redirects = collectStageOneRedirects(release, prepared.data);
  await writeFile(
    resolve(filesystemRoot, "dist/_redirects"),
    serializeStageOneRedirects(redirects),
    "utf8",
  );
  await logger.info(
    `Prepared Cloudflare Pages preview output for ${siteOrigin} with ${redirects.length} redirects.`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Cloudflare Pages preview preparation failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
