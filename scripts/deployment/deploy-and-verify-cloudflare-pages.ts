// Deploys one validated Pages artifact and restores verified production on failure.
import { createCloudflarePagesApi } from "../../src/adapters/cloudflare-pages-api";
import { loadCloudflarePagesDeploymentEnvironment } from "../../src/adapters/cloudflare-pages-environment";
import { createReleaseLogger } from "../../src/shared/release-logger";
import { deployPagesOutput, runCompleteHostedVerification } from "./hosted-verification-support";

function manualRecoveryCommand(deploymentId: string): string {
  return `curl --request POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/vydex/deployments/${deploymentId}/rollback" --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN"`;
}

async function main(): Promise<void> {
  const filesystemRoot = process.cwd();
  const environment = loadCloudflarePagesDeploymentEnvironment(process.env);
  const commitSha = process.env.GITHUB_SHA?.trim();
  if (!commitSha) throw new Error("GITHUB_SHA is required for a traceable production deployment.");
  const logger = await createReleaseLogger({ filesystem_root: filesystemRoot });
  const api = createCloudflarePagesApi({ environment });
  const previousDeployment = (await api.getProject()).canonical_deployment;
  let previousIsKnownGood = false;

  if (previousDeployment) {
    try {
      const verification = await runCompleteHostedVerification({
        filesystem_root: filesystemRoot,
        canonical_origin: environment.public_site_origin,
        request_origin: environment.public_site_origin,
        deployment_id: previousDeployment.id,
        phase: "pre-deployment-current-production",
        logger,
      });
      previousIsKnownGood = verification.report.success;
    } catch (error) {
      await logger.warning(
        `The previous canonical deployment could not be established as known-good: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  await logger.info(`Deploying the validated Stage 1 artifact for commit ${commitSha}.`);
  let intendedDeploymentId = "unknown";
  let deploymentFailure: unknown;
  try {
    await deployPagesOutput({
      filesystem_root: filesystemRoot,
      project_name: environment.project_name,
      commit_sha: commitSha,
      environment: process.env,
    });
    const intendedDeployment = await api.waitForCanonicalDeploymentForCommit(commitSha, {
      previous_deployment_id: previousDeployment?.id,
    });
    intendedDeploymentId = intendedDeployment.id;
    await logger.info(`Cloudflare Pages exposed deployment ${intendedDeployment.id} as canonical.`);
    const intendedVerification = await runCompleteHostedVerification({
      filesystem_root: filesystemRoot,
      canonical_origin: environment.public_site_origin,
      request_origin: environment.public_site_origin,
      deployment_id: intendedDeployment.id,
      phase: "post-deployment-production",
      logger,
    });
    if (intendedVerification.report.success) return;
    deploymentFailure = new Error(`Deployment ${intendedDeployment.id} failed hosted verification.`);
  } catch (error) {
    deploymentFailure = error;
    try {
      intendedDeploymentId = (await api.getProject()).canonical_deployment?.id ?? intendedDeploymentId;
    } catch {}
  }

  if (!previousDeployment || !previousIsKnownGood) {
    await logger.critical(
      `Production deployment ${intendedDeploymentId} failed hosted verification and no earlier complete Stage 1 deployment was verified as a safe fallback. Manual recovery is required.`,
    );
    throw deploymentFailure;
  }

  try {
    await logger.warning(`Restoring known-good deployment ${previousDeployment.id}.`);
    await api.rollbackProductionTo(previousDeployment.id);
    await api.waitForCanonicalDeployment(previousDeployment.id);
    const restored = await runCompleteHostedVerification({
      filesystem_root: filesystemRoot,
      canonical_origin: environment.public_site_origin,
      request_origin: environment.public_site_origin,
      deployment_id: previousDeployment.id,
      phase: "failed-deployment-restoration",
      logger,
    });
    if (!restored.report.success) throw new Error("The restored deployment failed hosted verification.");
  } catch (error) {
    await logger.critical(
      `Automatic restoration failed. Intended recovery deployment: ${previousDeployment.id}. Manual command: ${manualRecoveryCommand(previousDeployment.id)}. Failure: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
  throw new Error(`Deployment ${intendedDeploymentId} failed verification; production was restored to ${previousDeployment.id}.`, {
    cause: deploymentFailure,
  });
}

main().catch((error: unknown) => {
  process.stderr.write(`Cloudflare Pages production deployment failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
