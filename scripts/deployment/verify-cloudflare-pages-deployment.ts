// Verifies deployment configuration and downloaded static output before Pages upload.
import { resolve } from "node:path";
import { loadCloudflarePagesDeploymentEnvironment } from "../../src/adapters/cloudflare-pages-environment";
import { readGitHead, requireCommitAncestor } from "../../src/adapters/release-git";
import {
  inventoryReleaseFiles,
  loadReleaseState,
  verifyAllReleaseArchives,
} from "../../src/release/release-publication";
import { createReleaseLogger } from "../../src/shared/release-logger";

async function main(): Promise<void> {
  const filesystemRoot = process.cwd();
  const outputRoot = resolve(process.argv[2] ?? "dist");
  const logger = await createReleaseLogger({ filesystem_root: filesystemRoot });
  const environment = loadCloudflarePagesDeploymentEnvironment(process.env);
  const state = await loadReleaseState(filesystemRoot);
  await verifyAllReleaseArchives(filesystemRoot, state.history);
  const head = await readGitHead(filesystemRoot);
  for (const release of state.history.releases) {
    await requireCommitAncestor({ repository_root: filesystemRoot, source_commit: release.source_commit, descendant_commit: head });
  }
  if (state.manifest.site_origin !== environment.public_site_origin) throw new Error("The active manifest origin does not match the deployment origin.");
  const inventory = await inventoryReleaseFiles(outputRoot);
  if (JSON.stringify(inventory) !== JSON.stringify(state.manifest.files)) throw new Error("Downloaded static output differs from the active release inventory.");

  await logger.info(
    [
      "Cloudflare Pages deployment preflight succeeded.",
      `Project: ${environment.project_name}`,
      `Origin: ${environment.public_site_origin}`,
      `Release ID: ${state.manifest.release_id}`,
      `Source commit: ${state.manifest.source_commit}`,
      `Export filename: ${state.manifest.export_filename}`,
      `Static files: ${state.manifest.files.length}`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Cloudflare Pages deployment preflight failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
