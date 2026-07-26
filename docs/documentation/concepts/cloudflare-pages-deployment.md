---
label: Cloudflare Pages Deployment
order: 200
---

# Cloudflare Pages Deployment

Cloudflare Pages hosts VyDex's portable static output. This page is for maintainers and coding agents changing build configuration, deployment validation, preview behavior, rollback support, or the boundary between repository evidence and hosted files.

## Purpose And Ownership

This system prevents an incomplete, mismatched, or unverified build from becoming the hosted production site while keeping hosting state separate from evidence state.

The deployment system owns:

- The Git-integrated Cloudflare Pages project named `vydex`.
- Repository-connected preview deployments for proposed changes.
- The gated GitHub Actions path that publishes production output through Wrangler.
- Validation of Cloudflare credentials, the Pages project name, and the exact approved `PUBLIC_SITE_ORIGIN` before production upload.
- Transfer of one complete validated `dist/` artifact to Cloudflare Pages.
- Discovery and validation of Cloudflare production deployment records through one REST adapter.
- Serialized production deployment, rollback, and restoration operations.
- Operational deployment history, rollback access, and retained workflow evidence.

It does not own canonical records, immutable publication snapshots, release identity, the release manifest, Dataset semantics, hosted HTTP assertions, or permanent evidence retention. [Hosted Release Verification](hosted-release-verification.md) owns the checks that decide whether a deployed release is complete. This system does not introduce Workers, Pages Functions, runtime databases, or paid service dependencies.

The [Stage 1 Release Gate](stage-1-release-gate.md) owns release construction and local verification. [Repository Data Boundaries](https://github.com/Vyce101/VyDex/blob/main/docs/architecture/repository-boundaries.md) defines which files remain authoritative.

## Inputs And Outputs

Preview builds use the committed repository state, the pinned Node.js and npm toolchain, `npm run build:pages-preview`, and the exact production `PUBLIC_SITE_ORIGIN`. The build produces static HTML, CSS, JavaScript, JSON, `_headers`, and generated `_redirects` under `dist/`.

Production deployment requires:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_PAGES_PROJECT_NAME=vydex`
- `PUBLIC_SITE_ORIGIN=https://vydex.pages.dev`
- Committed `generated/release-data/release.json`
- Committed `generated/release-data/release-manifest.json`
- The validated workflow artifact produced from the same commit

Secrets are consumed by the protected deployment job and must not appear in tracked files or logs.

The production workflow also reads the commit SHA and GitHub run identifiers supplied by Actions. The rollback rehearsal requires the exact `REHEARSE_PRODUCTION_ROLLBACK` confirmation through `workflow_dispatch`; that input is not a substitute for approval by the protected `production` environment.

## Preview Flow

1. Cloudflare's Git integration receives a repository branch or pull-request change.
2. The Pages build runs `npm run build:pages-preview` and writes output to `dist/`.
3. The production release descriptor remains read-only; preview builds cannot create a release identity.
4. Canonical URLs and the Dataset Schema `$id` use `https://vydex.pages.dev`, not the temporary preview hostname.
5. The preview preparation step derives `_redirects` from the validated release and writes them beside the static output.
6. A blocking production-data, origin, build, or redirect error fails the preview build instead of publishing incomplete authoritative-looking output.

A Cloudflare preview URL is a review surface, never a canonical public origin. The diagnostic `PreviewReleaseModel` described in [Release Construction](release-construction.md) is an application validation model; the current Git-integrated Pages preview path builds production-shaped static content and does not publish that diagnostic model.

Temporary Pages hostnames must remain non-indexable. Hosted qualification checks require `X-Robots-Tag: noindex` when a production deployment is requested through its deployment-specific URL.

## Production Flow

1. A pull request or push starts the validation job. Production deployment is considered only for `main`; Cloudflare's automatic production-branch deployment remains disabled.
2. GitHub Actions checks out the commit, installs the immutable dependency tree and pinned Chromium runtime, then runs `npm run release:stage-1:ci`.
3. Strict release mode requires the committed descriptor and manifest, verifies their shared identity and origin, and regenerates the release without creating a UUID or timestamp.
4. Type checking, Vitest, release validation, static generation, Playwright journeys, and Axe checks must all pass.
5. The workflow uploads the complete validated `dist/` directory as an artifact retained for 30 days. The artifact supports operations; it is not canonical state.
6. The production job downloads that exact artifact, validates the four deployment environment values, and checks every file against the committed manifest.
7. Before upload, the job records the current canonical production deployment and checks whether it is a complete matching hosted release that can serve as a fallback.
8. Wrangler deploys the verified directory to the Pages project `vydex` with the `main` branch and Git commit hash attached.
9. The Cloudflare API adapter waits for a distinct successful production deployment with that commit hash to become `canonical_deployment`.
10. [Hosted Release Verification](hosted-release-verification.md) checks the complete production site at `https://vydex.pages.dev`, including browser and accessibility behavior. If Pages edges have not converged after the canonical deployment changes, the orchestrator waits 30 seconds and retries the complete suite, up to three attempts.
11. GitHub Actions retains the hosted report, complete browser output, failure screenshots or traces, and rotating logs even when verification fails.

The deployment job uses the non-cancelling `vydex-cloudflare-pages-production` concurrency group. It does not combine output from different commits or rebuild after artifact validation.

## Protected Rollback Rehearsal

The rollback rehearsal is a separate manually dispatched workflow. Its production job uses the same concurrency group as routine deployment and the protected GitHub `production` environment, so an approved rehearsal cannot overlap another production mutation.

The workflow reproduces and preflights the committed artifact before it enters the production job. After approval, it verifies the current canonical deployment and finds an earlier successful production deployment that exposes the same Release ID and bytes. If only one qualifying deployment exists, it uploads the validated `dist/` again to create a second Cloudflare deployment ID for the same artifact.

The rehearsal preserves both IDs and the release checksums before rollback. It makes the earlier deployment canonical, verifies the real production origin, restores the intended newer deployment in unconditional cleanup, and verifies production again. Deployment discovery, byte-identical redeployment, rollback, verification, restoration, and evidence capture remain automated after approval.

Cloudflare deployment IDs identify hosting records. They do not replace or rotate the VyDex Release ID, even when two records contain identical bytes.

## Failure And Recovery Behavior

A validation failure prevents artifact publication and skips production deployment. A missing secret, wrong project name, missing descriptor or manifest, origin mismatch, added file, missing file, or changed byte fails deployment preflight before Wrangler uploads anything.

An upload may become canonical before hosted verification finishes, and individual Pages edges may briefly serve different artifact versions after that API change. The job requires one complete hosted pass and retries the whole suite within a fixed propagation window. When all attempts fail and the previous deployment was established as known-good, the routine job restores the previous deployment and verifies the restored production site. On the first launch, or whenever no matching fallback was verified, the job fails critically with recovery information instead of assuming that an older deployment is safe.

Once the rehearsal changes production, restoration is attempted even when rollback polling or verification fails. A restoration failure emits a critical message with the exact intended deployment ID and a safe manual procedure. Maintainers must then follow [How To Redeploy A Complete Stage 1 Release](../how-to-redeploy-stage-1-release.md) and must not start another rehearsal until the intended production deployment is restored.

Cloudflare history is not the evidence archive. History retention and hosted deployment availability are operational concerns, while canonical records, immutable snapshots, the lockfile, pinned toolchain, descriptor, and manifest provide the durable inputs needed to reproduce a release.

## Internal Edge Cases

- `PUBLIC_SITE_ORIGIN` must equal `https://vydex.pages.dev`. A suffixed Pages hostname or the revoked `workers.dev` origin is rejected rather than treated as a fallback.
- A project name other than `vydex` is rejected before deployment.
- Empty or whitespace-only environment values are treated as missing.
- A preview URL must not enter canonical tags, Schema identifiers, export URLs, or release metadata.
- Preview, skipped, failed, wrong-project, and malformed deployment records are rejected before rollback.
- A successful API rollback response is not proof that the target is live; the adapter polls `canonical_deployment.id` after rollback and restoration.
- A matching `canonical_deployment.id` is not proof that all Pages edges serve one artifact yet; post-switch verification retries the complete suite instead of accepting mixed results.
- `dist/` may exist locally after a failed or test build; its presence alone does not make it deployable.

## Cross-System Edge Cases

- If the descriptor and manifest identify different releases, the release gate and deployment preflight both block publication.
- If `PUBLIC_SITE_ORIGIN` differs from the manifest origin, Pages preview preparation, CI reproduction, or deployment fails rather than rewriting canonical URLs.
- If an artifact differs from the manifest inventory, the deployment job rejects it even when the earlier validation job succeeded.
- A Cloudflare rollback changes hosting state but not repository state. The next successful `main` deployment can make the committed release current again.
- Two successful production deployments can have different Cloudflare IDs while exposing the same VyDex Release ID, manifest, Dataset, and complete artifact bytes.
- A deployment-specific URL can qualify a production record before rollback, but it remains non-canonical and must not be indexable.
- Validation jobs may overlap, but jobs that upload, roll back, or restore production share one exclusive concurrency group.
- A future custom domain requires an approved change to the Pages environment boundary and committed release state; changing the environment value alone is rejected. Route paths and record IDs can remain unchanged.

## Invariants

- Production publication consumes one complete artifact that passed every required check.
- Preview hostnames never become canonical origins.
- CI and deployment never create or rotate release identity.
- Routine deployments run complete hosted verification after the intended deployment becomes canonical.
- Rehearsal rollback and restoration both run complete verification against the actual production origin.
- No preview deployment can become a rollback target or known-good fallback.
- A failed production operation restores the verified known-good deployment when one exists; restoration failure is reported as critical.
- Cloudflare remains a host, not a canonical data store or evidence archive.
- Workers, Pages Functions, runtime databases, and unapproved paid dependencies remain absent.
- Failed production checks restore the verified known-good deployment when one exists; otherwise the workflow stops with critical recovery information.
- Static output remains portable across compatible static hosts.

## Implementation Landmarks

- `.github/workflows/rehearse-production-rollback.yml` - Protected manual rollback and restoration rehearsal.
- `src/adapters/cloudflare-pages-api/` - Validated production deployment discovery, rollback, and canonical polling.
- `src/release/stage-one-hosted-verification/` - Hosted release checks, evidence reports, and rollback lifecycle.
- `playwright.hosted.config.ts` - Browser verification against an explicit hosted origin without a local server.
- `.github/workflows/validate-application.yml` — Validation, artifact transfer, deployment preflight, production publication, automatic hosted verification, and fallback restoration.
- `wrangler.jsonc` — Pages project name and static output directory.
- `scripts/deployment/` — Preview preparation, artifact preflight, hosted verification, production deployment, and rehearsal entry points.
- `src/adapters/cloudflare-pages-environment/` — Required deployment environment validation.
- `src/adapters/public-site-origin/` — Required production-origin validation.
- `src/release/stage-one-release/` — Committed release-state and byte-inventory verification.
- `tests/foundation/cloudflare-pages-deployment.test.ts` — Pages configuration and workflow boundary coverage.

## Before Changing Deployment

Check:

- Whether previews still use the production origin for every canonical URL.
- Whether production still consumes the artifact created by the successful validation job.
- Whether descriptor, manifest, origin, and file inventory mismatches fail closed.
- Whether logs omit tokens, account identifiers, and other secrets.
- Whether every post-upload failure restores the verified previous deployment when one exists.
- Whether every rehearsal failure after mutation begins still attempts restoration.
- Whether deployment discovery rejects previews and incomplete records before mutation.
- Whether the routine and rehearsal workflows still share the same non-cancelling production concurrency group.
- Whether evidence artifacts contain the deployment IDs and checksums needed for recovery without containing secrets.
- Whether a proposed Cloudflare feature introduces a Worker, Function, runtime store, or paid dependency.
- Whether rollback instructions still match Cloudflare's current Pages controls.
