// Orchestrates protected production rollback verification with guaranteed restoration.
import type {
  CloudflarePagesApi,
  CloudflarePagesDeployment,
} from "../../adapters/cloudflare-pages-api";
import type { ReleaseLogger } from "../../shared/release-logger";
import type { HostedVerificationReport } from "./types";

export const PRODUCTION_ROLLBACK_CONFIRMATION = "REHEARSE_PRODUCTION_ROLLBACK" as const;

export type RollbackRehearsalEvidence = {
  evidence_version: "1.0.0";
  earlier_deployment_id: string;
  intended_deployment_id: string;
  release_id: string;
  manifest_sha256: string;
  dataset_sha256: string;
  artifact_inventory_sha256: string;
  commit_sha: string;
  workflow_run_id: string;
  workflow_run_attempt: string;
};

export type RollbackRehearsalResult = {
  evidence: RollbackRehearsalEvidence;
  rollback_verification: HostedVerificationReport;
  restoration_verification: HostedVerificationReport;
};

export async function runStageOneRollbackRehearsal(input: {
  confirmation: string;
  branch: string;
  commit_sha: string;
  public_origin: string;
  api: CloudflarePagesApi;
  logger: ReleaseLogger;
  verify: (input: {
    deployment: CloudflarePagesDeployment;
    request_origin: string;
    phase: string;
    include_browser: boolean;
  }) => Promise<HostedVerificationReport>;
  create_byte_identical_deployment: (
    previousDeploymentId: string,
  ) => Promise<CloudflarePagesDeployment>;
  preserve_evidence: (evidence: RollbackRehearsalEvidence) => Promise<void>;
  manual_recovery_procedure: (deploymentId: string) => string;
}): Promise<RollbackRehearsalResult> {
  if (input.confirmation !== PRODUCTION_ROLLBACK_CONFIRMATION) {
    throw new Error(`Rollback rehearsal requires the exact confirmation ${PRODUCTION_ROLLBACK_CONFIRMATION}.`);
  }
  if (input.branch !== "main") throw new Error("Rollback rehearsal may run only from the main branch.");

  const initialProject = await input.api.getProject();
  if (initialProject.production_branch !== "main") {
    throw new Error("The Cloudflare Pages production branch is not main.");
  }
  const initialCurrent = initialProject.canonical_deployment;
  if (!initialCurrent) throw new Error("Cloudflare Pages has no canonical production deployment to rehearse.");
  if (initialCurrent.deployment_trigger.metadata.branch !== "main") {
    throw new Error("The canonical production deployment was not created from main.");
  }
  if (initialCurrent.deployment_trigger.metadata.commit_hash !== input.commit_sha) {
    throw new Error("The canonical production deployment does not match the dispatched main commit.");
  }
  const initialVerification = await input.verify({
    deployment: initialCurrent,
    request_origin: input.public_origin,
    phase: "rehearsal-intended-current",
    include_browser: true,
  });
  if (!initialVerification.success) {
    throw new Error("The intended current deployment failed verification before rollback mutation.");
  }

  const restoreInitialAfterRedeploymentFailure = async (): Promise<void> => {
    await input.api.rollbackProductionTo(initialCurrent.id);
    await input.api.waitForCanonicalDeployment(initialCurrent.id);
    const recovered = await input.verify({
      deployment: initialCurrent,
      request_origin: input.public_origin,
      phase: "rehearsal-redeployment-recovery",
      include_browser: true,
    });
    if (!recovered.success) throw new Error("The original deployment failed recovery verification.");
  };

  const deployments = await input.api.listSuccessfulProductionDeployments();
  let earlierDeployment: CloudflarePagesDeployment | undefined;
  for (const candidate of deployments.filter(
    ({ id, created_on }) => id !== initialCurrent.id && created_on < initialCurrent.created_on,
  )) {
    try {
      const candidateVerification = await input.verify({
        deployment: candidate,
        request_origin: candidate.url,
        phase: `rehearsal-candidate-${candidate.id}`,
        include_browser: false,
      });
      if (candidateVerification.success) {
        earlierDeployment = candidate;
        break;
      }
    } catch (error) {
      await input.logger.warning(
        `Production deployment ${candidate.id} could not qualify as a rollback target: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  let intendedDeployment = initialCurrent;
  let intendedVerification = initialVerification;
  if (!earlierDeployment) {
    await input.logger.info("No earlier matching production deployment exists; creating one byte-identical deployment record.");
    try {
      intendedDeployment = await input.create_byte_identical_deployment(initialCurrent.id);
      intendedVerification = await input.verify({
        deployment: intendedDeployment,
        request_origin: input.public_origin,
        phase: "rehearsal-byte-identical-redeployment",
        include_browser: true,
      });
      if (!intendedVerification.success) {
        throw new Error("The byte-identical redeployment failed hosted verification.");
      }
      earlierDeployment = initialCurrent;
    } catch (redeploymentError) {
      try {
        await restoreInitialAfterRedeploymentFailure();
      } catch (recoveryError) {
        const procedure = input.manual_recovery_procedure(initialCurrent.id);
        await input.logger.critical(
          `Byte-identical redeployment and automatic recovery failed. Intended recovery deployment: ${initialCurrent.id}. Manual recovery: ${procedure}. Failure: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
        );
        throw new Error(
          `CRITICAL: restore production to deployment ${initialCurrent.id}. ${procedure}`,
          { cause: recoveryError },
        );
      }
      throw new Error("The byte-identical redeployment failed; the original deployment was restored.", {
        cause: redeploymentError,
      });
    }
  }

  const evidence: RollbackRehearsalEvidence = {
    evidence_version: "1.0.0",
    earlier_deployment_id: earlierDeployment.id,
    intended_deployment_id: intendedDeployment.id,
    release_id: intendedVerification.release_id,
    manifest_sha256: intendedVerification.manifest_sha256,
    dataset_sha256: intendedVerification.dataset_sha256,
    artifact_inventory_sha256: intendedVerification.artifact_inventory_sha256,
    commit_sha: intendedVerification.commit_sha,
    workflow_run_id: intendedVerification.workflow_run_id,
    workflow_run_attempt: intendedVerification.workflow_run_attempt,
  };
  await input.preserve_evidence(evidence);

  let rollbackVerification: HostedVerificationReport | undefined;
  let rollbackFailure: unknown;
  let restorationVerification: HostedVerificationReport | undefined;
  try {
    await input.logger.warning(`Rolling production back to deployment ${earlierDeployment.id}.`);
    await input.api.rollbackProductionTo(earlierDeployment.id);
    await input.api.waitForCanonicalDeployment(earlierDeployment.id);
    rollbackVerification = await input.verify({
      deployment: earlierDeployment,
      request_origin: input.public_origin,
      phase: "rehearsal-rollback-production",
      include_browser: true,
    });
    if (!rollbackVerification.success) {
      throw new Error("The rolled-back production deployment failed hosted verification.");
    }
  } catch (error) {
    rollbackFailure = error;
  } finally {
    try {
      await input.logger.warning(`Restoring intended production deployment ${intendedDeployment.id}.`);
      await input.api.rollbackProductionTo(intendedDeployment.id);
      await input.api.waitForCanonicalDeployment(intendedDeployment.id);
      restorationVerification = await input.verify({
        deployment: intendedDeployment,
        request_origin: input.public_origin,
        phase: "rehearsal-restored-production",
        include_browser: true,
      });
      if (!restorationVerification.success) {
        throw new Error("The restored intended deployment failed final hosted verification.");
      }
    } catch (error) {
      const procedure = input.manual_recovery_procedure(intendedDeployment.id);
      await input.logger.critical(
        `Automatic restoration failed. Intended deployment: ${intendedDeployment.id}. Manual recovery: ${procedure}. Failure: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `CRITICAL: restore production to deployment ${intendedDeployment.id}. ${procedure}`,
        { cause: error },
      );
    }
  }

  if (rollbackFailure) throw rollbackFailure;
  if (!rollbackVerification || !restorationVerification) {
    throw new Error("Rollback rehearsal did not produce both required verification reports.");
  }
  return { evidence, rollback_verification: rollbackVerification, restoration_verification: restorationVerification };
}
