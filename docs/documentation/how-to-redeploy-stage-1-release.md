---
label: How To Redeploy A Complete Stage 1 Release
---

# How To Redeploy A Complete Stage 1 Release

Use this guide when the current production site must return to a previously successful Stage 1 deployment. You need maintainer access to the Cloudflare Pages project `vydex`.

## Before You Start

- Confirm that the target is a successful **Production** deployment. Cloudflare Pages cannot roll production back to a preview deployment.
- Identify the deployment's commit hash in Cloudflare Pages.
- Open that commit in GitHub and inspect `generated/release-data/release.json` and `generated/release-data/release-manifest.json`.
- Confirm that both files describe the release you intend to restore. The manifest contains the release ID, canonical origin, immutable export filename, routes, redirects, and file inventory.

Do not use a deployment merely because its page looks correct. A valid rollback target must correspond to complete committed release state and a successful production deployment.

## Restore The Deployment

1. Open the Cloudflare dashboard and select **Workers & Pages**.
2. Open the Pages project named **vydex**, then open **Deployments**.
3. Find the successful production deployment whose commit hash matches the release you verified.
4. Open the three-dot actions menu for that deployment.
5. Select **Rollback to this deployment**.
6. Review the confirmation window, then confirm the rollback.
7. Wait for Cloudflare Pages to make the selected deployment current.

Cloudflare changes the hosted production deployment; it does not rewrite Git history, canonical records, snapshots, the release descriptor, or the release manifest. A later successful deployment from `main` can replace the rollback.

## Confirm It Worked

1. Open [https://vydex.pages.dev](https://vydex.pages.dev).
2. Open the [Export JSON page](https://vydex.pages.dev/export/).
3. Confirm that the immutable download URL contains the expected release ID and export filename from the selected manifest.
4. Open the download and confirm that it returns JSON rather than an error page.

## If Something Goes Wrong

Stop if the target is a preview, a failed build, or cannot be matched to committed release state. Review the Cloudflare deployment details and the corresponding GitHub Actions run before choosing another target.

Cloudflare deployment history and retained GitHub workflow artifacts are short-term operational support. They are not the permanent evidence archive; canonical records, immutable snapshots, and committed release metadata remain authoritative.

For Cloudflare's current dashboard behavior, see [Rollbacks in Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/rollbacks/).

## Related Pages

- [Cloudflare Pages Deployment](concepts/cloudflare-pages-deployment.md)
- [Stage 1 Release Gate](concepts/stage-1-release-gate.md)
- [Quickstart](https://github.com/Vyce101/VyDex/blob/main/docs/QUICKSTART.md)
