---
label: Repeatable Release Publication
order: 300
permalink: /concepts/repeatable-release-publication/
---

# Repeatable Release Publication

Repeatable release publication detects release-selection drift, reproduces the active release, and constructs a verified successor only when explicitly requested. This page is for maintainers, technical users, and coding agents changing release selection, immutable archives, provenance, promotion, or recovery behavior.

## Purpose And Ownership

The system keeps release identity repository-controlled while allowing clean environments to reproduce an existing release and maintainers to create its successor safely. It owns:

- Read-only comparison between current committed source and the active public artifact.
- Strict reproduction of the complete committed release without creating identity.
- Explicit construction of one successor release when public output changed or a successor is intentionally required.
- Retention and validation of immutable release archives.
- Source-commit provenance, exclusive local locking, journaling, backup, and atomic promotion.
- Structured failure diagnostics and restoration of previous authoritative state.

It does not own:

- Authoring canonical records or publishing Entry snapshots.
- Repairing rejected records, relationships, manifests, or archives.
- Building page-specific presentation models or defining Dataset fields.
- Deploying to Cloudflare Pages, changing production, or performing hosted verification.
- Committing, tagging, pushing, or creating release identity in CI.

## Inputs And Outputs

Publication consumes a clean repository commit, the active descriptor and manifest, release history, immutable archives, accepted ledger inputs, the approved production origin, and the pinned build toolchain.

Read-only checks return whether the selected release still matches current public output. Strict reproduction replaces only ignored `dist/`. Successor construction returns reviewed changes to the descriptor, manifest, history, release archive, and `dist/`; it does not publish those changes to Git or Cloudflare.

## Normal Flow

1. Selection checking rebuilds current committed source with the active descriptor and compares the complete candidate inventory with committed release state.
2. If public output is unchanged, the existing release remains selected and no identity is created.
3. If output changed and explicit confirmation is present, successor construction first reproduces the active release, then creates one later UUIDv7 and timestamp.
4. The candidate retains earlier immutable public artifacts, builds and verifies the new complete surface, and records the clean source commit that supplied its inputs.
5. Promotion journals and backs up prior state before replacing the active descriptor, manifest, history, archives, and `dist/` as one local transaction.
6. CI repeats selection checking and strict reproduction, but it never creates or repairs authoritative release state.

The exact maintainer commands and prerequisites belong in the [Quickstart](https://github.com/Vyce101/VyDex/blob/main/docs/QUICKSTART.md).

## Durable State And Provenance

The active descriptor and manifest remain under `generated/release-data/`. Versioned release history and `releases/{release-id}/` archives retain byte-identical descriptors, manifests, Dataset bytes, Schema bytes, public paths, hashes, content types, cache policy, and download behavior.

For Release 2 onward, `source_commit` is the clean repository input commit captured before successor construction. It is not the later commit that contains generated release state, because embedding that later commit would make release identity circular. Deployment evidence separately records the GitHub Actions commit and Cloudflare deployment ID.

Stage 1 is the migration exception. Its archived source commit is `655b7c8bf4a8b5cbb88bbc9427735084c5f19973`. Later commits and Cloudflare deployments may reproduce those same release bytes without replacing that provenance.

## Failure And Recovery Behavior

Selection checking fails before deployment when current public bytes differ from active committed state. Dirty worktrees fail before comparison so uncommitted changes cannot become provenance.

Successor construction rechecks the branch, commit, clean status, input bytes, and active state before promotion. A failed promotion restores the prior descriptor, manifest, history, archives, and `dist/` and leaves no authoritative partial release.

After a deployment failure, repository state may be newer than production. Deployment recovery identifies the hosted Release ID, verifies it against its archive, and restores a qualified Cloudflare deployment. Cloudflare history remains operational support rather than the permanent release archive.

## Internal Edge Cases

- A later commit may reproduce the active release when its complete public bytes and manifest remain identical.
- Reproduction never calls the clock or UUID generator.
- Synchronization creates no identity when the preliminary comparison finds no public change.
- Immutable archive paths accept only the bytes recorded for that release.
- An interrupted promotion restores the prior complete selection through its journal and backup.

## Cross-System Edge Cases

- Unpublished canonical Entry edits do not enter a release; only authoritative snapshots supply current public Entry state.
- Dataset and page output must agree on release identity, route inventory, counts, and immutable artifact paths.
- CI may detect stale selection but cannot invoke successor creation.
- Cloudflare deployment IDs may change without changing the selected VyDex Release ID or its bytes.
- Hosted verification uses committed active or archived release state without modifying local publication records.

## Invariants

- The stable latest Dataset path redirects to the active immutable Dataset.
- Earlier Dataset and Schema routes retain their paths, bytes, headers, and download behavior.
- Manifests and history remain internal; no public archive browser or API exists.
- Local construction, Git commit, CI reproduction, deployment, and hosted verification remain separate boundaries.
- CI detects stale release selection but never creates authoritative release state.
- Failed selection or promotion leaves the previous complete release authoritative.

## Implementation Landmarks

- `scripts/release/check-release-selection.ts`
- `scripts/release/sync-release-selection.ts`
- `scripts/release/next-release.ts`
- `scripts/release/release-ci.ts`
- `generated/release-data/`
- `runtime/`

## Before Changing Repeatable Publication

Read [Release Construction](release-construction.md), [Dataset Generation](dataset-generation.md), [Cloudflare Pages Deployment](../deployment-and-verification/cloudflare-pages-deployment.md), and [Hosted Release Verification](../deployment-and-verification/hosted-release-verification.md). Preserve clean-source provenance, immutable archives, strict CI behavior, atomic promotion, and recovery of the previous complete state.
