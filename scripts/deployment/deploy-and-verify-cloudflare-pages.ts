// Deploys one validated Pages artifact and restores verified production on failure.
import { createCloudflarePagesApi } from "../../src/adapters/cloudflare-pages-api";
import { loadCloudflarePagesDeploymentEnvironment } from "../../src/adapters/cloudflare-pages-environment";
import { createReleaseLogger } from "../../src/shared/release-logger";
import { loadReleaseState } from "../../src/release/release-publication";
import {
  deployPagesOutput,
  discoverHostedReleaseId,
  runArchivedHostedVerification,
  runCompleteHostedVerification,
  runCompleteHostedVerificationAfterPropagation,
} from "./hosted-verification-support";

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
  const releaseState = await loadReleaseState(filesystemRoot);
  const activeReleaseId = releaseState.descriptor.release_id;
  const previousReleaseId = releaseState.history.releases.at(-2)?.release_id;
  const explicitlyRecognizedReleaseId = process.env.VYDEX_RECOGNIZED_HOSTED_RELEASE_ID?.trim();
  const previousDeployment = (await api.getProject()).canonical_deployment;
  let previousIsKnownGood = false;
  let previousHostedReleaseId: string | undefined;

  if (!previousDeployment) throw new Error("Production upload is blocked because Cloudflare has no canonical deployment to verify.");
  try {
      previousHostedReleaseId = await discoverHostedReleaseId({
        request_origin: environment.public_site_origin,
        known_release_ids: releaseState.history.releases.map(({ release_id }) => release_id),
      });
      const allowed = previousHostedReleaseId === activeReleaseId ||
        previousHostedReleaseId === previousReleaseId ||
        (explicitlyRecognizedReleaseId === previousHostedReleaseId && releaseState.history.releases.some(({ release_id }) => release_id === previousHostedReleaseId));
      if (!allowed) throw new Error(`Hosted Release ID ${previousHostedReleaseId} is not active, the immediate predecessor, or the explicitly recognized recovery release.`);
      const verification = previousHostedReleaseId === activeReleaseId
        ? await runCompleteHostedVerification({
            filesystem_root: filesystemRoot,
            canonical_origin: environment.public_site_origin,
            request_origin: environment.public_site_origin,
            deployment_id: previousDeployment.id,
            phase: "pre-deployment-current-production",
            logger,
          })
        : await runArchivedHostedVerification({
            filesystem_root: filesystemRoot,
            canonical_origin: environment.public_site_origin,
            request_origin: environment.public_site_origin,
            deployment_id: previousDeployment.id,
            release_id: previousHostedReleaseId,
            phase: "pre-deployment-archived-production",
            logger,
          });
      previousIsKnownGood = verification.report.success;
      if (!previousIsKnownGood) throw new Error(`Hosted release ${previousHostedReleaseId} failed its archived release contract.`);
  } catch (cause) {
    await logger.critical("Production upload was blocked because the currently hosted release could not be verified.");
    throw new Error("Currently hosted production failed release-aware preflight; no upload was attempted.", { cause });
  }

  await logger.info(`Deploying VyDex release ${activeReleaseId} from workflow commit ${commitSha}.`);
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
    const intendedVerification = await runCompleteHostedVerificationAfterPropagation({
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

  if (!previousIsKnownGood) {
    await logger.critical(
      `Production deployment ${intendedDeploymentId} failed hosted verification and no earlier complete release deployment was verified as a safe fallback. Manual recovery is required.`,
    );
    throw deploymentFailure;
  }

  try {
    await logger.warning(`Restoring known-good deployment ${previousDeployment.id}.`);
    await api.rollbackProductionTo(previousDeployment.id);
    await api.waitForCanonicalDeployment(previousDeployment.id);
    if (!previousHostedReleaseId) throw new Error("The verified fallback Release ID was not retained.");
    const restored = previousHostedReleaseId === activeReleaseId
      ? await runCompleteHostedVerificationAfterPropagation({
          filesystem_root: filesystemRoot,
          canonical_origin: environment.public_site_origin,
          request_origin: environment.public_site_origin,
          deployment_id: previousDeployment.id,
          phase: "failed-deployment-restoration",
          logger,
        })
      : await runArchivedHostedVerification({
          filesystem_root: filesystemRoot,
          canonical_origin: environment.public_site_origin,
          request_origin: environment.public_site_origin,
          deployment_id: previousDeployment.id,
          release_id: previousHostedReleaseId,
          phase: "failed-deployment-archived-restoration",
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
