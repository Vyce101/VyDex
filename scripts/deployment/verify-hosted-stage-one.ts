// Runs complete Stage 1 verification against one explicit hosted production surface.
import { loadCloudflarePagesDeploymentEnvironment } from "../../src/adapters/cloudflare-pages-environment";
import { createReleaseLogger } from "../../src/shared/release-logger";
import { runCompleteHostedVerification } from "./hosted-verification-support";

async function main(): Promise<void> {
  const filesystemRoot = process.cwd();
  const environment = loadCloudflarePagesDeploymentEnvironment(process.env);
  const requestOrigin = process.env.VYDEX_HOSTED_REQUEST_ORIGIN?.trim() || environment.public_site_origin;
  const deploymentId = process.env.VYDEX_EXPECTED_DEPLOYMENT_ID?.trim();
  if (!deploymentId) throw new Error("VYDEX_EXPECTED_DEPLOYMENT_ID is required for hosted verification evidence.");
  const logger = await createReleaseLogger({ filesystem_root: filesystemRoot });
  const result = await runCompleteHostedVerification({
    filesystem_root: filesystemRoot,
    canonical_origin: environment.public_site_origin,
    request_origin: requestOrigin,
    deployment_id: deploymentId,
    phase: process.env.VYDEX_HOSTED_VERIFICATION_PHASE?.trim() || "hosted-production",
    logger,
  });
  if (!result.report.success) process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`Hosted Stage 1 verification failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
