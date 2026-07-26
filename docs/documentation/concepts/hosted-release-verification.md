---
label: Hosted Release Verification
order: 550
---

# Hosted Release Verification

Hosted release verification compares Cloudflare Pages with the matching committed VyDex release archive. It runs after deployment because local builds cannot prove that Cloudflare published the expected routes, redirects, headers, canonical URLs, and files.

## Purpose And Ownership

The system decides whether one hosted deployment exposes the complete release represented by the repository.

It owns:

- Loading the persisted release descriptor, manifest, deterministic Dataset, and Schema as the expected state.
- Checking hosted routes, sitemap availability, redirects, response headers, canonical metadata, HTML content, relationships, and public file hashes.
- Running the shared Playwright and Axe journeys against an explicit hosted origin without starting a local server.
- Producing a structured, non-secret report for each verification phase.
- Qualifying earlier production deployments before they may be used in the rollback rehearsal.
- Coordinating rollback verification and guaranteed restoration around the Cloudflare Pages adapter.

It does not own:

- Constructing or rotating the VyDex Release ID. [Release Construction](release-construction.md) and the [Stage 1 Release Gate](stage-1-release-gate.md) own release data and local promotion.
- Uploading files, authenticating to Cloudflare, discovering deployments, or calling the rollback endpoint. [Cloudflare Pages Deployment](cloudflare-pages-deployment.md) owns those hosting operations.
- Defining page content, Dataset fields, Schema rules, or public route generation.
- Treating Cloudflare deployment history as canonical evidence or permanent release storage.
- Repairing a failed hosted release in place.

## Expected State And Reports

Active verification starts from the committed descriptor and manifest. Archived verification selects the descriptor, manifest, immutable-route contract, and source provenance by hosted Release ID. Both compare the expected state with HTTP responses from the requested host.

Each JSON report records:

- The verification phase and Cloudflare deployment ID.
- The unchanged VyDex Release ID.
- SHA-256 values for the manifest, Dataset, and complete manifest inventory.
- The commit SHA and GitHub workflow run ID and attempt when available.
- Start and completion timestamps.
- One result for each hosted check, without credentials or account identifiers.

Reports, Playwright output, screenshots, traces, and release logs remain operational evidence under ignored runtime directories or GitHub Actions artifacts. They do not become public site files or canonical release records.

## Verification Flow

1. The verifier loads and validates the committed release descriptor and manifest.
2. It reconstructs the production release, Dataset, and Schema without creating new identity or changing committed state.
3. It requests every manifest route, Entry route, Topic Trail route, Methodology route, About, Changelog, Export, Schema, immutable Dataset route, `sitemap-index.xml`, and `sitemap-0.xml`.
4. It checks permanent Entry aliases, the stable Dataset redirect, and a deliberately unknown route with redirects disabled.
5. It parses delivered HTML to verify canonical URLs, core Homepage and Entry content, absent preview diagnostics, and absent Stage 2 routes or controls.
6. It compares hosted Dataset and Schema bytes with the deterministic local artifacts and validates their media types, cache policies, release metadata, counts, and relationships.
7. It requires both sitemap URLs to return HTTP `200`, then retrieves each public manifest file and compares its bytes with the committed inventory. Cloudflare consumes `_headers` and `_redirects`, so those two files are checked through response behavior instead of direct retrieval.
8. For a complete production check, it runs the shared desktop and mobile Playwright projects against the hosted origin, including Axe, keyboard, focus, overflow, downloads, and JavaScript-disabled journeys.
9. After a deployment, rollback, or restoration changes the canonical deployment, the orchestrator may rerun the unchanged complete suite up to three times with a 30-second wait between attempts. This accounts for Pages edge propagation without accepting a partial result.
10. It writes the latest phase report and returns failure when no complete attempt passes.

The same verifier can target the canonical origin or a deployment-specific production URL. Canonical tags must still point to `https://vydex.pages.dev`; a non-canonical deployment URL must also carry `X-Robots-Tag: noindex`.

Verification phases retain their own release expectations. A pre-deployment check of an earlier active or archived production release proves that release's committed contract; it does not require candidate-only metadata that first appears in the successor artifact.

## Rollback Rehearsal Integration

The protected rehearsal first verifies the intended current deployment. It then searches successful production deployments for an earlier record whose deployment-specific URL exposes the same release identity and artifact bytes. Preview, skipped, failed, wrong-project, and malformed records cannot qualify.

The rehearsal first prefers a successful deployment exposing the immediate previous archived release. When none exists, it retains the same-release fallback and may upload the same validated `dist/` artifact again. Cloudflare deployment IDs and GitHub workflow commits remain operational identities rather than replacements for VyDex Release ID or `source_commit`.

Before production changes, the workflow preserves both deployment IDs and the expected checksums. It rolls production back to the earlier deployment, waits until Cloudflare reports that ID as canonical, and runs complete hosted verification. An unconditional restoration step then selects the intended newer deployment, waits for it to become canonical, and repeats the complete verification.

## Failure Behavior

A routine deployment is unsuccessful when its new canonical deployment fails any hosted check. If the previous deployment was verified as a complete matching release before upload, the workflow restores it and verifies the restored production site. If no such fallback exists, the workflow reports a critical failure with manual recovery context rather than claiming that production is safe.

Canonical-deployment polling and hosted-surface convergence are separate checks. Cloudflare may identify the intended deployment as canonical while some edge requests still return earlier bytes. After a production switch, the orchestrator retries the entire HTTP, Playwright, and Axe suite within a fixed bound. A passing route from one attempt is never combined with a different attempt; one complete pass must succeed before the deployment qualifies.

Once a rehearsal mutation begins, restoration is attempted even when rollback polling or verification fails. A rollback-phase failure remains the job's result after successful restoration. If restoration itself fails, the workflow logs the exact intended deployment ID and a manual recovery command that uses environment-variable placeholders instead of credentials.

The verifier records failed checks but does not mutate hosted state. Only the deployment and rehearsal orchestrators may request rollback through the validated Cloudflare adapter.

## Interactions With Other VyDex Systems

- [Stage 1 Release Gate](stage-1-release-gate.md) creates the exact `dist/` and manifest that define expected release bytes. Hosted verification never weakens or replaces that local gate.
- [Cloudflare Pages Deployment](cloudflare-pages-deployment.md) supplies production deployment records, performs uploads and rollbacks, and polls `canonical_deployment` after each mutation.
- [Dataset Generation](dataset-generation.md) supplies the deterministic Dataset and immutable Schema contracts used in byte and relationship checks.
- [Static Application Foundation](static-application-foundation.md) supplies the shared Playwright projects and no-JavaScript, accessibility, keyboard, and responsive journeys.
- GitHub Actions supplies commit and run identifiers, protected-environment approval, exclusive production-operation concurrency, and retained evidence artifacts.

## Internal Edge Cases

- A route returning a branded not-found page with HTTP `200` still fails because the unknown-route check requires a genuine `404`.
- Redirect destinations and statuses are exact. Entry aliases require `301`; the stable Dataset pointer requires its existing `302`.
- A JSON body with the wrong media type, cache policy, or bytes fails even when it parses successfully.
- A page with correct visible content fails when its canonical URL uses another origin or its core Entry content depends on JavaScript.
- A sitemap route fails when it returns a branded or generic `404`; both the index and child must return HTTP `200` before a hosted release can pass.
- Candidate verification errors do not make an unverified deployment eligible; the rehearsal continues searching or creates a byte-identical deployment.
- A byte-identical redeployment that fails or cannot be verified triggers an attempt to restore and verify the original deployment before the rehearsal stops.
- Browser startup errors become failed report checks and preserve their complete output for diagnosis.

## Cross-System Edge Cases

- Cloudflare may report a successful upload before the intended deployment becomes canonical. Polling must prove the live deployment ID and commit instead of relying on Wrangler's exit status.
- Cloudflare may report the intended deployment as canonical before every edge route serves its bytes. Bounded complete-suite retries handle this propagation window; exhausted retries remain a verification failure.
- Cloudflare deployment identity and VyDex release identity are separate. Two production deployment IDs may represent the same byte-identical Stage 1 release.
- A deployment-specific production URL may be used to qualify a candidate, but it never replaces the approved canonical origin and must not be indexed.
- The production concurrency group prevents deployment and rehearsal mutations from overlapping. Validation jobs may run concurrently because they do not change production.
- A locally valid release is not a known-good hosted fallback until its hosted surface passes the required checks.
- A restored deployment is not considered recovered until the canonical deployment ID and complete hosted verification both pass.

## Invariants

- The approved canonical origin is `https://vydex.pages.dev`; Workers and `workers.dev` origins are invalid.
- Both production sitemap URLs return HTTP `200` and remain covered by the manifest-backed hosted file checks.
- Hosted verification never creates or rotates release identity.
- Every qualifying rollback target is a successful Cloudflare Pages production deployment.
- Preview deployments are never current, intended, fallback, or rollback targets.
- Complete HTTP and browser verification runs against the real production origin after routine deployment, rollback, and restoration.
- Restoration is attempted after every rehearsal failure that occurs once mutation begins.
- Credentials, authorization headers, account IDs, and secret-bearing API payloads never enter reports or logs.
- A failed check keeps the workflow non-zero even when cleanup succeeds.
- Hosted evidence remains operational and non-authoritative.

## Implementation Landmarks

- `src/release/stage-one-hosted-verification/` - HTTP verification, reports, deployment qualification, and rollback lifecycle.
- `src/adapters/cloudflare-pages-api/` - Validated Cloudflare REST boundary and canonical-deployment polling.
- `scripts/deployment/hosted-verification-support.ts` - Release loading, browser execution, report persistence, and Pages upload support.
- `scripts/deployment/verify-hosted-stage-one.ts` - Explicit hosted-verification command.
- `playwright.hosted.config.ts` and `tests/browser/playwright-config.ts` - Hosted browser mode over the shared test projects.
- `runtime/hosted-verification/` - Ignored local reports and complete browser output.
- `tests/features/stage-one-hosted-verification.test.ts` - Hosted HTTP contract coverage.
- `tests/features/stage-one-rollback-rehearsal.test.ts` - Mutation, failure, and restoration coverage.

## Before Changing Hosted Verification

Check:

- Whether every new public route or artifact is represented in the manifest and hosted checks.
- Whether both sitemap URLs still require HTTP `200` rather than accepting an error page with branded content.
- Whether redirects are requested without automatic following and retain their exact status and destination.
- Whether production and deployment-specific requests keep the canonical origin and indexing rules separate.
- Whether browser checks still run without a local server or canonical-origin proxy in hosted mode.
- Whether every failure after mutation begins still reaches restoration.
- Whether logs and reports remain free of secrets and account identifiers.
- Whether deployment selection rejects previews and incomplete production records before rollback.
- Whether tests cover HTTP failures, malformed API responses, polling timeouts, rollback failures, and restoration failures.
- Whether guide steps and manual recovery instructions still match the protected workflows.

## Related Pages

- [Cloudflare Pages Deployment](cloudflare-pages-deployment.md)
- [Stage 1 Release Gate](stage-1-release-gate.md)
- [How To Rehearse The Production Rollback](../guides/how-to-rehearse-production-rollback.md)
- [How To Redeploy A Complete Stage 1 Release](../guides/how-to-redeploy-stage-1-release.md)
