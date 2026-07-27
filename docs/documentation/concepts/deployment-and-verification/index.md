---
label: Deployment And Verification
order: 500
---

# Deployment And Verification

Deployment And Verification is VyDex's boundary between a complete repository-controlled release and the production surface served by Cloudflare Pages. This page is for maintainers and coding agents changing production publication, hosted checks, rollback selection, restoration, or operational evidence.

## Purpose And Ownership

The system ensures that only one complete verified static artifact reaches production and that the hosted result is checked against its matching committed release.

It owns Cloudflare Pages deployment operations, hosted route and byte verification, rollback qualification, restoration attempts, and retained operational reports. It does not own canonical content, release identity, local release construction, public-page meaning, or permanent evidence storage.

## Child Concepts

- [Cloudflare Pages Deployment](cloudflare-pages-deployment.md) owns preview and production upload, deployment discovery, rollback calls, restoration, concurrency, and Cloudflare credential boundaries.
- [Hosted Release Verification](hosted-release-verification.md) owns comparison of the live surface with the committed descriptor, manifest, Dataset, Schema, routes, browser behavior, and accessibility contract.

## Normal Flow

1. [Repeatable Release Publication](../release-lifecycle/repeatable-release-publication.md) produces and verifies one complete local artifact.
2. The production workflow transfers that exact artifact between jobs and validates its inventory before upload.
3. Cloudflare Pages creates a deployment record without changing the VyDex Release ID.
4. Hosted verification compares the canonical production surface with the matching repository archive.
5. A failed new deployment triggers restoration of a previously qualified production deployment and verifies the restored state.

## Internal Edge Cases

- Preview deployments never qualify as production rollback targets.
- Cloudflare may expose two deployment IDs for one byte-identical VyDex release.
- Edge convergence may require bounded repetition of the complete hosted-verification suite.
- Restoration is attempted even when rollback polling or intermediate verification fails.

## Cross-System Edge Cases

- Deployment rejects an artifact whose inventory differs from the committed release manifest.
- Hosted verification may select active or archived expected state, but it cannot create or alter release identity.
- Operational reports and Cloudflare history support recovery without becoming authoritative Evidence Ledger or release records.

## Invariants

- Cloudflare Pages is the production host; Workers and `workers.dev` origins are not deployment alternatives.
- Production, rollback, and restoration operations share one exclusive concurrency boundary.
- The canonical origin remains `https://vydex.pages.dev`.
- A successful deployment is not accepted until hosted verification proves the complete matching release.
- Recovery preserves the intended VyDex Release ID even when deployment IDs change.

## Implementation Landmarks

- `.github/workflows/validate-application.yml`
- `.github/workflows/rehearse-production-rollback.yml`
- `src/adapters/cloudflare-pages-api/`
- `scripts/deployment/`
- `runtime/hosted-verification/`

## Before Changing Deployment Or Verification

Read both child concepts and the [Production Operations guides](../../guides/production-operations/). Preserve artifact inventory checks, credential isolation, preview exclusions, bounded hosted retries, unconditional restoration, and the distinction between deployment identity and VyDex release identity.
