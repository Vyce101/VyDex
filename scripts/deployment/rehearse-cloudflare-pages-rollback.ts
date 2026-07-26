// Runs the protected Cloudflare Pages rollback and guaranteed-restoration rehearsal.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCloudflarePagesApi } from "../../src/adapters/cloudflare-pages-api";
import { loadCloudflarePagesDeploymentEnvironment } from "../../src/adapters/cloudflare-pages-environment";
import {
  runStageOneRollbackRehearsal,
  type RollbackRehearsalEvidence,
} from "../../src/release/stage-one-hosted-verification";
import { createReleaseLogger } from "../../src/shared/release-logger";
import {
  deployPagesOutput,
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
  if (!commitSha) throw new Error("GITHUB_SHA is required for rollback rehearsal evidence.");
  const logger = await createReleaseLogger({ filesystem_root: filesystemRoot });
  const api = createCloudflarePagesApi({ environment });
  const evidenceDirectory = resolve(filesystemRoot, "runtime/hosted-verification");
  await mkdir(evidenceDirectory, { recursive: true });

  const result = await runStageOneRollbackRehearsal({
    confirmation: process.env.ROLLBACK_CONFIRMATION?.trim() ?? "",
    branch: process.env.GITHUB_REF_NAME?.trim() ?? "",
    commit_sha: commitSha,
    public_origin: environment.public_site_origin,
    api,
    logger,
    verify: async ({ deployment, request_origin, phase, include_browser }) => {
      const verification = await (
        request_origin === environment.public_site_origin
          ? runCompleteHostedVerificationAfterPropagation
          : runCompleteHostedVerification
      )({
        filesystem_root: filesystemRoot,
        canonical_origin: environment.public_site_origin,
        request_origin,
        deployment_id: deployment.id,
        phase,
        include_browser,
        logger,
      });
      return verification.report;
    },
    create_byte_identical_deployment: async (previousDeploymentId) => {
      await deployPagesOutput({
        filesystem_root: filesystemRoot,
        project_name: environment.project_name,
        commit_sha: commitSha,
        environment: process.env,
      });
      return api.waitForCanonicalDeploymentForCommit(commitSha, {
        previous_deployment_id: previousDeploymentId,
      });
    },
    preserve_evidence: async (evidence: RollbackRehearsalEvidence) => {
      await writeFile(
        resolve(evidenceDirectory, "rollback-rehearsal-evidence.json"),
        `${JSON.stringify(evidence, null, 2)}\n`,
        "utf8",
      );
    },
    manual_recovery_procedure: manualRecoveryCommand,
  });
  await writeFile(
    resolve(evidenceDirectory, "rollback-rehearsal-result.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  await logger.info(
    `Rollback rehearsal succeeded for earlier deployment ${result.evidence.earlier_deployment_id} and restored deployment ${result.evidence.intended_deployment_id}.`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`Cloudflare Pages rollback rehearsal failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
