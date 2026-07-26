---
label: How To Rehearse The Production Rollback
---

# How To Rehearse The Production Rollback

Use this guide when the deployment or rollback mechanism changes or another production rehearsal is explicitly required. The protected workflow temporarily switches the live Pages deployment, verifies it, restores the intended deployment, and verifies production again.

## Before You Start

- Confirm that the intended release is committed and pushed to `main`.
- Confirm that the routine **Validate and deploy application** workflow succeeded, including its hosted verification job.
- Confirm that `https://vydex.pages.dev` currently serves the intended Release ID.
- Confirm that the GitHub `production` environment has required reviewers and that an authorized reviewer is available.
- Confirm that no deployment, rollback, restoration, or production incident is in progress.
- Be ready to use [How To Redeploy A Complete Stage 1 Release](how-to-redeploy-stage-1-release.md) if automatic restoration fails.

The initial Stage 1 launch rehearsal has passed. A new rehearsal still changes the live production deployment twice, so run it only when an explicit later check is needed; it is not part of every routine content deployment.

## Run The Protected Workflow

1. Open the repository on GitHub and select **Actions**.
2. Select the **Rehearse production rollback** workflow.
3. Select **Run workflow** and choose the `main` branch.
4. Enter `REHEARSE_PRODUCTION_ROLLBACK` in the confirmation field. Any other value stops the workflow before production mutation.
5. Select **Run workflow** to start release reproduction and artifact preflight.
6. Wait for the **Roll back and restore production** job to request approval from the protected `production` environment.
7. Before approving, confirm that the workflow run uses the intended `main` commit and that no other production operation is active.
8. Select **Review deployments**, select **production**, and approve the deployment.
9. Wait for the workflow to finish. After approval, deployment discovery, optional byte-identical redeployment, rollback, hosted verification, restoration, final verification, and evidence capture are automatic. A verification phase may run the complete suite more than once while Pages edges converge; do not cancel it during the bounded retry window.

Do not cancel the job after production mutation begins unless emergency recovery requires it. The workflow's unconditional cleanup is responsible for restoring the intended deployment after an intermediate failure.

## Confirm It Worked

1. Confirm that the **Roll back and restore production** job succeeded.
2. Download the `vydex-rollback-evidence-<run-id>-<attempt>` artifact from the workflow run.
3. Open `runtime/hosted-verification/rollback-rehearsal-evidence.json` and confirm that `earlier_deployment_id` and `intended_deployment_id` are different.
4. Confirm that the Release ID, manifest SHA-256, Dataset SHA-256, and artifact-inventory SHA-256 remain unchanged across the rollback and restoration reports.
5. Confirm that the rollback report passed against `https://vydex.pages.dev` while the earlier deployment was canonical.
6. Confirm that the restoration report passed and the intended deployment ID became canonical again.
7. Open [https://vydex.pages.dev](https://vydex.pages.dev) and confirm that its Release ID matches the intended Stage 1 descriptor.

The rehearsal is complete only when rollback verification, restoration, and final hosted verification all pass. Two deployment IDs do not represent two VyDex releases when both expose the same persisted Release ID and byte-identical artifact.

## If Something Goes Wrong

The workflow still attempts restoration when rollback polling or verification fails. Preserve the failed run and its uploaded reports, browser output, screenshots, traces, and logs.

If the logs contain `CRITICAL: restore production to deployment`, do not start another rehearsal. Copy the intended deployment ID, follow the emitted manual recovery procedure, and use [How To Redeploy A Complete Stage 1 Release](how-to-redeploy-stage-1-release.md). Never substitute a preview deployment.

If restoration succeeds but the rollback phase failed, the workflow remains failed by design. Review the failed phase report before deciding whether the mechanism is ready for another explicitly approved rehearsal.

## Next Steps

Retain the successful workflow artifact with the deployment evidence. Routine production deployments continue to run hosted verification automatically; run another rehearsal only after a relevant mechanism change or another explicit approval.

## Related Pages

- [How To Redeploy A Complete Stage 1 Release](how-to-redeploy-stage-1-release.md)
- [Hosted Release Verification](../concepts/hosted-release-verification.md)
- [Cloudflare Pages Deployment](../concepts/cloudflare-pages-deployment.md)
- [Stage 1 Release Gate](../concepts/stage-1-release-gate.md)
