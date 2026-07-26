---
label: How To Redeploy A Complete Stage 1 Release
---

# How To Redeploy A Complete Stage 1 Release

Use this guide to restore a known-good VyDex production deployment after an unsuccessful release or failed automatic restoration. You need maintainer access to the Cloudflare Pages project `vydex` and the matching repository release state.

This is an emergency recovery task. To test rollback and restoration under normal conditions, use [How To Rehearse The Production Rollback](how-to-rehearse-production-rollback.md).

## Before You Start

- Stop other production deployments and rollback attempts.
- Find the exact intended Cloudflare deployment ID in the failed GitHub Actions run or its `vydex-rollback-evidence-*` artifact.
- Confirm that the target is a successful **Production** deployment for the Pages project `vydex`. Never select a preview deployment.
- Match the deployment's commit to `generated/release-data/release.json` and `generated/release-data/release-manifest.json` in GitHub.
- Confirm the expected VyDex Release ID, canonical origin, Entry count, immutable Dataset path, routes, redirects, and file inventory before changing production.
- In a clean checkout of the matching commit, run `npm ci` and install the pinned Chromium runtime with `npm run test:browser:install` before using the hosted verifier.

Do not choose a deployment because its Homepage looks correct. The target must represent one complete committed release. Cloudflare deployment IDs may differ while the VyDex Release ID and artifact bytes remain the same.

## Restore The Deployment

1. Open the Cloudflare dashboard and select **Workers & Pages**.
2. Open the Pages project named **vydex**, then open **Deployments**.
3. Find the successful production deployment with the intended deployment ID and matching commit.
4. Open that deployment's actions menu and select **Rollback to this deployment**.
5. Review the target ID before you confirm. This action changes the live production site.
6. Confirm the rollback, then wait until Cloudflare marks the selected deployment as the current production deployment.

If the failed workflow printed a manual recovery command, you may use that command instead of the dashboard. Keep `$CLOUDFLARE_ACCOUNT_ID` and `$CLOUDFLARE_API_TOKEN` as environment-provided values; do not paste either secret into a tracked file, issue, report, or chat message.

## Confirm The Restored Release

1. Confirm in Cloudflare that `canonical_deployment.id` matches the intended deployment ID.
2. Open [https://vydex.pages.dev](https://vydex.pages.dev) and confirm that the Homepage loads.
3. Open the [Export JSON page](https://vydex.pages.dev/export/) and confirm that its Release ID, Entry count, and immutable download URL match the selected manifest.
4. Open the immutable Dataset and Schema URLs from the manifest. Confirm that each returns JSON rather than an error page.
5. Use the matching repository commit to run the hosted verifier with `VYDEX_EXPECTED_DEPLOYMENT_ID` set to the restored Cloudflare deployment ID:

   ```powershell
   $env:PUBLIC_SITE_ORIGIN = "https://vydex.pages.dev"
   $env:VYDEX_EXPECTED_DEPLOYMENT_ID = "replace-with-production-deployment-id"
   npm run verify:hosted-stage-1
   ```

The command also requires the Cloudflare Pages environment values described in `.env.example`. It may run the complete HTTP, Playwright, and Axe suite up to three times with 30-second waits while Pages edges converge. Success still requires one complete pass against the real production origin; the command does not combine partial results across attempts.

## If Something Goes Wrong

Do not repeatedly choose different deployments. Preserve the intended deployment ID and the failed workflow artifacts, then check whether the target is a successful production record for the correct project and commit.

If Cloudflare cannot make the intended ID canonical, keep the production incident open and do not start the rollback rehearsal. The [Hosted Release Verification](../concepts/hosted-release-verification.md) concept explains the evidence and restoration contract; the [Cloudflare Pages Deployment](../concepts/cloudflare-pages-deployment.md) concept explains deployment selection and identity boundaries.

## Next Steps

After production is restored and complete hosted verification passes, record the recovered deployment ID and retain the GitHub Actions evidence. Run a new rehearsal only when the deployment and rollback mechanism are stable and another rehearsal is explicitly needed.

## Related Pages

- [How To Rehearse The Production Rollback](how-to-rehearse-production-rollback.md)
- [Hosted Release Verification](../concepts/hosted-release-verification.md)
- [Cloudflare Pages Deployment](../concepts/cloudflare-pages-deployment.md)
- [Stage 1 Release Gate](../concepts/stage-1-release-gate.md)
- [Quickstart](https://github.com/Vyce101/VyDex/blob/main/docs/QUICKSTART.md)
