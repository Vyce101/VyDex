// Produces non-secret evidence for one hosted Stage 1 verification pass.
import { hostedEvidenceChecksums, runHostedHttpChecks } from "./checks";
import type { HostedVerificationInput, HostedVerificationReport } from "./types";

export async function verifyHostedStageOneRelease(
  input: HostedVerificationInput,
): Promise<HostedVerificationReport> {
  const now = input.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const checks = await runHostedHttpChecks(input);
  const checksums = hostedEvidenceChecksums(input);
  return {
    report_version: "2.0.0",
    phase: input.phase,
    request_origin: input.request_origin,
    canonical_origin: input.canonical_origin,
    deployment_id: input.deployment_id,
    release_id: input.manifest.release_id,
    source_commit: input.manifest.source_commit,
    ...checksums,
    commit_sha: input.commit_sha ?? "local",
    workflow_run_id: input.workflow_run_id ?? "local",
    workflow_run_attempt: input.workflow_run_attempt ?? "local",
    started_at: startedAt,
    completed_at: now().toISOString(),
    success: checks.every(({ passed }) => passed),
    checks,
  };
}
