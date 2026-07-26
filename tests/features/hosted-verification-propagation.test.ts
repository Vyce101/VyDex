// Verifies bounded complete-suite retries while Cloudflare Pages edges converge.
import { describe, expect, test, vi } from "vitest";
import { runCompleteHostedVerificationAfterPropagation } from "../../scripts/deployment/hosted-verification-support";
import type { HostedVerificationReport } from "../../src/release/stage-one-hosted-verification";
import type { ReleaseLogger } from "../../src/shared/release-logger";

type PropagationInput = Parameters<typeof runCompleteHostedVerificationAfterPropagation>[0];
type RunVerification = NonNullable<PropagationInput["run_verification"]>;

function report(success: boolean, failedCheck = "hosted file entry.html"): HostedVerificationReport {
  return {
    report_version: "2.0.0",
    phase: "post-deployment-production",
    request_origin: "https://vydex.pages.dev",
    canonical_origin: "https://vydex.pages.dev",
    deployment_id: "deployment",
    release_id: "01900000-0000-7000-8000-000000000001",
    source_commit: "a".repeat(40),
    manifest_sha256: "a".repeat(64),
    dataset_sha256: "b".repeat(64),
    artifact_inventory_sha256: "c".repeat(64),
    commit_sha: "commit",
    workflow_run_id: "run",
    workflow_run_attempt: "1",
    started_at: "2026-07-26T00:00:00.000Z",
    completed_at: "2026-07-26T00:01:00.000Z",
    success,
    checks: [{ name: failedCheck, passed: success }],
  };
}

function input(runVerification: RunVerification) {
  const warning = vi.fn(async () => {});
  const sleep = vi.fn(async () => {});
  return {
    values: {
      filesystem_root: process.cwd(),
      canonical_origin: "https://vydex.pages.dev",
      request_origin: "https://vydex.pages.dev",
      deployment_id: "deployment",
      phase: "post-deployment-production",
      logger: { warning } as unknown as ReleaseLogger,
      run_verification: runVerification,
      sleep,
    },
    warning,
    sleep,
  };
}

describe("hosted verification propagation retries", () => {
  test("returns immediately when the complete suite passes", async () => {
    const runVerification = vi.fn(async () => ({ report: report(true), report_filename: "report.json" }));
    const fixture = input(runVerification);

    await expect(runCompleteHostedVerificationAfterPropagation(fixture.values)).resolves.toMatchObject({
      report: { success: true },
    });
    expect(runVerification).toHaveBeenCalledTimes(1);
    expect(fixture.sleep).not.toHaveBeenCalled();
    expect(fixture.warning).not.toHaveBeenCalled();
  });

  test("retries the complete suite after an incomplete edge response", async () => {
    const runVerification = vi.fn()
      .mockResolvedValueOnce({ report: report(false), report_filename: "failed.json" })
      .mockResolvedValueOnce({ report: report(true), report_filename: "passed.json" });
    const fixture = input(runVerification);

    await expect(runCompleteHostedVerificationAfterPropagation(fixture.values)).resolves.toMatchObject({
      report_filename: "passed.json",
      report: { success: true },
    });
    expect(runVerification).toHaveBeenCalledTimes(2);
    expect(fixture.sleep).toHaveBeenCalledWith(30_000);
    expect(fixture.warning).toHaveBeenCalledWith(expect.stringContaining("hosted file entry.html"));
  });

  test("returns the final failed report after exhausting the bound", async () => {
    const runVerification = vi.fn(async () => ({ report: report(false), report_filename: "failed.json" }));
    const fixture = input(runVerification);

    await expect(runCompleteHostedVerificationAfterPropagation({
      ...fixture.values,
      max_attempts: 2,
      retry_delay_ms: 5,
    })).resolves.toMatchObject({ report: { success: false } });
    expect(runVerification).toHaveBeenCalledTimes(2);
    expect(fixture.sleep).toHaveBeenCalledTimes(1);
    expect(fixture.sleep).toHaveBeenCalledWith(5);
  });

  test("does not copy thrown error details into propagation warnings", async () => {
    const runVerification = vi.fn()
      .mockRejectedValueOnce(new Error("secret-bearing-response"))
      .mockResolvedValueOnce({ report: report(true), report_filename: "passed.json" });
    const fixture = input(runVerification);

    await expect(runCompleteHostedVerificationAfterPropagation(fixture.values)).resolves.toMatchObject({
      report: { success: true },
    });
    expect(fixture.warning).toHaveBeenCalledWith(expect.not.stringContaining("secret-bearing-response"));
  });
});
