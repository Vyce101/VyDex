// Verifies protected rollback selection, byte-identical redeployment, and guaranteed restoration.
import { describe, expect, test, vi } from "vitest";
import type {
  CloudflarePagesApi,
  CloudflarePagesDeployment,
} from "../../src/adapters/cloudflare-pages-api";
import {
  PRODUCTION_ROLLBACK_CONFIRMATION,
  runStageOneRollbackRehearsal,
  type HostedVerificationReport,
} from "../../src/release/stage-one-hosted-verification";
import type { ReleaseLogger } from "../../src/shared/release-logger";

function deployment(id: string, createdOn: string): CloudflarePagesDeployment {
  return {
    id,
    created_on: createdOn,
    environment: "production",
    is_skipped: false,
    latest_stage: { status: "success" },
    project_name: "vydex",
    url: `https://${id}.vydex.pages.dev`,
    deployment_trigger: { metadata: { branch: "main", commit_hash: "commit" } },
  };
}

function report(
  deploymentId: string,
  success = true,
  releaseId = "01900000-0000-7000-8000-000000000006",
): HostedVerificationReport {
  return {
    report_version: "2.0.0",
    phase: "test",
    request_origin: "https://vydex.pages.dev",
    canonical_origin: "https://vydex.pages.dev",
    deployment_id: deploymentId,
    release_id: releaseId,
    source_commit: "a".repeat(40),
    manifest_sha256: "a".repeat(64),
    dataset_sha256: "b".repeat(64),
    artifact_inventory_sha256: "c".repeat(64),
    commit_sha: "commit",
    workflow_run_id: "run",
    workflow_run_attempt: "1",
    started_at: "2026-07-26T00:00:00Z",
    completed_at: "2026-07-26T00:00:01Z",
    success,
    checks: [{ name: "test", passed: success }],
  };
}

function logger(): ReleaseLogger {
  return {
    filename: "logs_1.txt",
    log: vi.fn(async () => {}),
    debug: vi.fn(async () => {}),
    info: vi.fn(async () => {}),
    warning: vi.fn(async () => {}),
    error: vi.fn(async () => {}),
    critical: vi.fn(async () => {}),
  };
}

function api(current: CloudflarePagesDeployment, deployments: CloudflarePagesDeployment[]): CloudflarePagesApi {
  return {
    getProject: vi.fn(async () => ({ name: "vydex", production_branch: "main", canonical_deployment: current })),
    getProductionDeployment: vi.fn(async () => current),
    listSuccessfulProductionDeployments: vi.fn(async () => deployments),
    rollbackProductionTo: vi.fn(async (id) => deployments.find((item) => item.id === id) ?? current),
    waitForCanonicalDeployment: vi.fn(async (id) => deployments.find((item) => item.id === id) ?? current),
    waitForCanonicalDeploymentForCommit: vi.fn(async () => current),
  };
}

function input(overrides: Partial<Parameters<typeof runStageOneRollbackRehearsal>[0]> = {}) {
  const intended = deployment("intended", "2026-07-26T00:00:02Z");
  const earlier = deployment("earlier", "2026-07-26T00:00:01Z");
  const pagesApi = api(intended, [intended, earlier]);
  return {
    confirmation: PRODUCTION_ROLLBACK_CONFIRMATION,
    branch: "main",
    commit_sha: "commit",
    intended_release_id: "01900000-0000-7000-8000-000000000006",
    public_origin: "https://vydex.pages.dev",
    api: pagesApi,
    logger: logger(),
    verify: vi.fn(async ({ deployment: value }) => report(value.id)),
    create_byte_identical_deployment: vi.fn(async () => deployment("duplicate", "2026-07-26T00:00:03Z")),
    preserve_evidence: vi.fn(async () => {}),
    manual_recovery_procedure: (id: string) => `restore ${id}`,
    ...overrides,
  };
}

describe("Stage 1 production rollback rehearsal", () => {
  test("refuses mutation without exact confirmation", async () => {
    const values = input({ confirmation: "yes" });
    await expect(runStageOneRollbackRehearsal(values)).rejects.toThrow("exact confirmation");
    expect(values.api.getProject).not.toHaveBeenCalled();
  });

  test("refuses a Cloudflare project whose production branch is not main", async () => {
    const values = input();
    vi.mocked(values.api.getProject).mockResolvedValueOnce({
      name: "vydex",
      production_branch: "preview",
      canonical_deployment: deployment("intended", "2026-07-26T00:00:02Z"),
    });

    await expect(runStageOneRollbackRehearsal(values)).rejects.toThrow("production branch is not main");
    expect(values.verify).not.toHaveBeenCalled();
  });

  test("rolls back to an earlier verified production deployment and restores intended production", async () => {
    const values = input();
    const result = await runStageOneRollbackRehearsal(values);

    expect(result.evidence).toMatchObject({
      earlier_deployment_id: "earlier",
      intended_deployment_id: "intended",
      earlier_release_id: "01900000-0000-7000-8000-000000000006",
      intended_release_id: "01900000-0000-7000-8000-000000000006",
    });
    expect(values.api.rollbackProductionTo).toHaveBeenNthCalledWith(1, "earlier");
    expect(values.api.rollbackProductionTo).toHaveBeenNthCalledWith(2, "intended");
    expect(values.preserve_evidence).toHaveBeenCalledOnce();
  });

  test("prefers and records an earlier deployment exposing another archived release", async () => {
    const previousReleaseId = "01900000-0000-7000-8000-000000000005";
    const values = input({
      verify: vi.fn(async ({ deployment: value }) => report(
        value.id,
        true,
        value.id === "earlier" ? previousReleaseId : "01900000-0000-7000-8000-000000000006",
      )),
    });
    const result = await runStageOneRollbackRehearsal(values);
    expect(result.evidence.earlier_release_id).toBe(previousReleaseId);
    expect(result.evidence.intended_release_id).toBe("01900000-0000-7000-8000-000000000006");
    expect(result.evidence.earlier_deployment_id).toBe("earlier");
  });

  test("creates a second byte-identical deployment when only one qualifying deployment exists", async () => {
    const intended = deployment("original", "2026-07-26T00:00:01Z");
    const values = input({ api: api(intended, [intended]) });
    const result = await runStageOneRollbackRehearsal(values);

    expect(values.create_byte_identical_deployment).toHaveBeenCalledWith("original");
    expect(result.evidence).toMatchObject({
      earlier_deployment_id: "original",
      intended_deployment_id: "duplicate",
    });
  });

  test("skips an unreadable earlier deployment and creates a second deployment", async () => {
    const verify = vi.fn(async ({ deployment: value, phase }: Parameters<Parameters<typeof runStageOneRollbackRehearsal>[0]["verify"]>[0]) => {
      if (phase.startsWith("rehearsal-candidate")) throw new Error("candidate unavailable");
      return report(value.id);
    });
    const values = input({ verify });

    const result = await runStageOneRollbackRehearsal(values);

    expect(result.evidence).toMatchObject({
      earlier_deployment_id: "intended",
      intended_deployment_id: "duplicate",
    });
    expect(values.logger.warning).toHaveBeenCalledWith(expect.stringContaining("candidate unavailable"));
  });

  test("restores the original deployment when byte-identical redeployment throws", async () => {
    const intended = deployment("original", "2026-07-26T00:00:01Z");
    const pagesApi = api(intended, [intended]);
    const values = input({
      api: pagesApi,
      create_byte_identical_deployment: vi.fn(async () => {
        throw new Error("redeployment failed");
      }),
    });

    await expect(runStageOneRollbackRehearsal(values)).rejects.toThrow("original deployment was restored");
    expect(pagesApi.rollbackProductionTo).toHaveBeenCalledWith("original");
    expect(values.verify).toHaveBeenCalledWith(expect.objectContaining({ phase: "rehearsal-redeployment-recovery" }));
  });

  test("attempts restoration when rollback verification fails", async () => {
    const verify = vi.fn(async ({ deployment: value, phase }: Parameters<Parameters<typeof runStageOneRollbackRehearsal>[0]["verify"]>[0]) =>
      report(value.id, phase !== "rehearsal-rollback-production"));
    const values = input({ verify });

    await expect(runStageOneRollbackRehearsal(values)).rejects.toThrow("rolled-back production deployment failed");
    expect(values.api.rollbackProductionTo).toHaveBeenNthCalledWith(2, "intended");
    expect(values.verify).toHaveBeenCalledWith(expect.objectContaining({ phase: "rehearsal-restored-production" }));
  });

  test("reports critical manual recovery when restoration fails", async () => {
    const values = input();
    vi.mocked(values.api.rollbackProductionTo)
      .mockResolvedValueOnce(deployment("earlier", "2026-07-26T00:00:01Z"))
      .mockRejectedValueOnce(new Error("restore failed"));

    await expect(runStageOneRollbackRehearsal(values)).rejects.toThrow("CRITICAL: restore production to deployment intended");
    expect(values.logger.critical).toHaveBeenCalledWith(expect.stringContaining("restore intended"));
  });
});
