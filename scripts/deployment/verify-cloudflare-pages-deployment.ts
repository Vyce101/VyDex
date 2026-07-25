// Verifies deployment configuration and downloaded static output before Pages upload.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadCloudflarePagesDeploymentEnvironment } from "../../src/adapters/cloudflare-pages-environment";
import { readStageOneReleaseDescriptor } from "../../src/adapters/stage-one-release-descriptor";
import {
  formatReleaseDiagnostics,
  parseExistingStageOneReleaseManifest,
  STAGE_ONE_RELEASE_MANIFEST_PATH,
  validateCommittedStageOneReleaseState,
  verifyStageOneReleaseInventory,
} from "../../src/release/stage-one-release";
import { createReleaseLogger } from "../../src/shared/release-logger";

async function main(): Promise<void> {
  const filesystemRoot = process.cwd();
  const outputRoot = resolve(process.argv[2] ?? "dist");
  const logger = await createReleaseLogger({ filesystem_root: filesystemRoot });
  const environment = loadCloudflarePagesDeploymentEnvironment(process.env);
  const descriptorResult = await readStageOneReleaseDescriptor(filesystemRoot);
  if (descriptorResult.status === "missing") {
    throw new Error("The committed Stage 1 release descriptor is required before deployment.");
  }
  const manifest = parseExistingStageOneReleaseManifest(
    await readFile(resolve(filesystemRoot, STAGE_ONE_RELEASE_MANIFEST_PATH), "utf8"),
  );
  const diagnostics = [
    ...validateCommittedStageOneReleaseState({
      descriptor: descriptorResult.descriptor,
      manifest,
      site_origin: environment.public_site_origin,
    }),
    ...(await verifyStageOneReleaseInventory({ output_root: outputRoot, manifest })),
  ];
  if (diagnostics.length > 0) {
    throw new Error(formatReleaseDiagnostics(diagnostics));
  }

  await logger.info(
    [
      "Cloudflare Pages deployment preflight succeeded.",
      `Project: ${environment.project_name}`,
      `Origin: ${environment.public_site_origin}`,
      `Release ID: ${manifest.release_id}`,
      `Export filename: ${manifest.export_filename}`,
      `Static files: ${manifest.files.length}`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Cloudflare Pages deployment preflight failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
