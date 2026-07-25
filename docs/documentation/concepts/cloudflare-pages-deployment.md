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
- Validation of Cloudflare credentials, the Pages project name, and `PUBLIC_SITE_ORIGIN` before production upload.
- Transfer of one complete validated `dist/` artifact to Cloudflare Pages.
- Operational deployment history and rollback access.

It does not own canonical records, immutable publication snapshots, release identity, the release manifest, Dataset semantics, or permanent evidence retention. It also does not introduce Workers, Pages Functions, runtime databases, or paid service dependencies.

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

## Preview Flow

1. Cloudflare's Git integration receives a repository branch or pull-request change.
2. The Pages build runs `npm run build:pages-preview` and writes output to `dist/`.
3. The production release descriptor remains read-only; preview builds cannot create a release identity.
4. Canonical URLs and the Dataset Schema `$id` use `https://vydex.pages.dev`, not the temporary preview hostname.
5. The preview preparation step derives `_redirects` from the validated release and writes them beside the static output.
6. A blocking production-data, origin, build, or redirect error fails the preview build instead of publishing incomplete authoritative-looking output.

A Cloudflare preview URL is a review surface, never a canonical public origin. The diagnostic `PreviewReleaseModel` described in [Release Construction](release-construction.md) is an application validation model; the current Git-integrated Pages preview path builds production-shaped static content and does not publish that diagnostic model.

## Production Flow

1. A pull request or push starts the validation job. Production deployment is considered only for `main`; Cloudflare's automatic production-branch deployment remains disabled.
2. GitHub Actions checks out the commit, installs the immutable dependency tree and pinned Chromium runtime, then runs `npm run release:stage-1:ci`.
3. Strict release mode requires the committed descriptor and manifest, verifies their shared identity and origin, and regenerates the release without creating a UUID or timestamp.
4. Type checking, Vitest, release validation, static generation, Playwright journeys, and Axe checks must all pass.
5. The workflow uploads the complete validated `dist/` directory as an artifact retained for 30 days. The artifact supports operations; it is not canonical state.
6. The production job downloads that exact artifact, validates the four deployment environment values, and checks every file against the committed manifest.
7. Wrangler deploys the verified directory to the Pages project `vydex` with the `main` branch and Git commit hash attached.

The deployment job uses a non-cancelling production concurrency group. It does not combine output from different commits or rebuild after artifact validation.

## Failure And Recovery Behavior

A validation failure prevents artifact publication and skips production deployment. A missing secret, wrong project name, missing descriptor or manifest, origin mismatch, added file, missing file, or changed byte fails deployment preflight before Wrangler uploads anything.

Cloudflare Pages changes production only after it receives the complete upload. If a check or upload fails, the previously successful production deployment remains current. Maintainers can restore an earlier successful production deployment through Cloudflare Pages history by following [How To Redeploy A Complete Stage 1 Release](../how-to-redeploy-stage-1-release.md).

Cloudflare history is not the evidence archive. History retention and hosted deployment availability are operational concerns, while canonical records, immutable snapshots, the lockfile, pinned toolchain, descriptor, and manifest provide the durable inputs needed to reproduce a release.

## Internal Edge Cases

- An unavailable `vydex.pages.dev` hostname would have required a suffixed Pages hostname. The chosen production origin is therefore stored in `PUBLIC_SITE_ORIGIN` rather than inferred from the project name.
- A project name other than `vydex` is rejected before deployment.
- Empty or whitespace-only environment values are treated as missing.
- A preview URL must not enter canonical tags, Schema identifiers, export URLs, or release metadata.
- `dist/` may exist locally after a failed or test build; its presence alone does not make it deployable.

## Cross-System Edge Cases

- If the descriptor and manifest identify different releases, the release gate and deployment preflight both block publication.
- If `PUBLIC_SITE_ORIGIN` differs from the manifest origin, Pages preview preparation, CI reproduction, or deployment fails rather than rewriting canonical URLs.
- If an artifact differs from the manifest inventory, the deployment job rejects it even when the earlier validation job succeeded.
- A Cloudflare rollback changes hosting state but not repository state. The next successful `main` deployment can make the committed release current again.
- A future custom domain may replace the Pages origin after the environment value and committed release state are updated through an approved release workflow; route paths and record IDs remain unchanged.

## Invariants

- Production publication consumes one complete artifact that passed every required check.
- Preview hostnames never become canonical origins.
- CI and deployment never create or rotate release identity.
- Cloudflare remains a host, not a canonical data store or evidence archive.
- Workers, Pages Functions, runtime databases, and unapproved paid dependencies remain absent.
- Failed checks and failed deployments leave the current production release unchanged.
- Static output remains portable across compatible static hosts.

## Implementation Landmarks

- `.github/workflows/validate-application.yml` — Validation, artifact transfer, deployment preflight, and production publication.
- `wrangler.jsonc` — Pages project name and static output directory.
- `scripts/deployment/` — Preview redirect preparation and production artifact verification.
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
- Whether the previous production deployment survives every failure path.
- Whether a proposed Cloudflare feature introduces a Worker, Function, runtime store, or paid dependency.
- Whether rollback instructions still match Cloudflare's current Pages controls.
