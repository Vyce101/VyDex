// Adds validated Stage 1 redirects to disposable static browser-test output.
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prepareApplicationExport } from "../../src/adapters/application-export";
import { loadFixedMetadataDevelopmentApplicationRelease } from "../../src/adapters/application-release";
import { collectStageOneRedirects, serializeStageOneRedirects } from "../../src/release/stage-one-release";

async function main(): Promise<void> {
  const filesystemRoot = process.cwd();
  const release = await loadFixedMetadataDevelopmentApplicationRelease({
    filesystem_root: filesystemRoot,
    site_origin: process.env.PUBLIC_SITE_ORIGIN,
  });
  const prepared = prepareApplicationExport(release);
  if (!prepared.success) {
    throw new Error(
      `Browser output redirects require a valid export: ${prepared.diagnostics.map(({ code }) => code).join(", ")}.`,
    );
  }

  const redirects = collectStageOneRedirects(release, prepared.data);
  await writeFile(
    resolve(filesystemRoot, "dist/_redirects"),
    serializeStageOneRedirects(redirects),
    "utf8",
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Browser output preparation failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
