---
label: Release Lifecycle
order: 300
---

# Release Lifecycle

The Release Lifecycle turns accepted Evidence Ledger state into one reproducible, versioned public release. This page is for maintainers, technical users, and coding agents that need to understand where release values are resolved, where public artifacts are generated, and how active and historical releases remain reproducible.

## Purpose And Ownership

The lifecycle owns the boundary from validated repository inputs to selected release metadata, deterministic public artifacts, immutable archives, and verified local output.

It does not own record authoring, publication-snapshot creation, public page composition, Cloudflare deployment state, or hosted verification.

## Child Concepts

- [Release Construction](release-construction.md) resolves validated records, immutable histories, routes, relationships, activity, and public URLs into one release model.
- [Dataset Generation](dataset-generation.md) projects that model into Dataset `1.0.0`, validates it against its Schema, and produces deterministic immutable bytes.
- [Repeatable Release Publication](repeatable-release-publication.md) detects selection drift, reproduces the active release, constructs a successor, retains immutable history, and promotes verified local state atomically.
- [Stage 1 Release Gate (Historical)](stage-1-release-gate.md) records the retired one-time bootstrap design and is not the current release workflow.

## Normal Flow

1. Release construction loads accepted records, histories, and explicit release metadata into one validated public model.
2. Dataset generation derives the public JSON and Schema contract from that model.
3. Release publication checks whether the active committed selection still represents current public output.
4. Reproduction verifies existing identity without rotating it, while successor construction creates new identity only through the explicit local workflow.
5. Verified output and immutable archives are promoted together before [Deployment And Verification](../deployment-and-verification/) may consume them.

## Internal Edge Cases

- A clean rebuild may come from a later commit while remaining byte-identical to the active release.
- Existing immutable paths accept identical bytes but reject different replacement bytes.
- Failed promotion restores previous release state instead of leaving partial authoritative state.
- Stage 1 retains exceptional bootstrap provenance without reopening the retired bootstrap path.

## Cross-System Edge Cases

- Unpublished canonical edits must not leak into a release; current Entries come from accepted immutable snapshots.
- Page models and downloadable artifacts must consume the same resolved release rather than reconstructing metadata separately.
- Deployment IDs may change while the VyDex Release ID and bytes remain unchanged.
- Hosted verification reports operational evidence but never replaces repository-controlled release state.

## Invariants

- Release construction, Dataset generation, local publication, deployment, and hosted verification remain separate boundaries.
- Release identity is explicit, immutable, and never created by an ordinary build or CI reproduction.
- The active descriptor, manifest, history, archives, and public output describe one complete release.
- Earlier immutable Dataset and Schema routes retain their paths, bytes, and response contract.

## Implementation Landmarks

- `src/domain/release-construction/`
- `src/domain/json-export-generation/`
- `src/adapters/persisted-release-descriptor/`
- `scripts/release/`
- `generated/release-data/`
- `runtime/`

## Before Changing The Release Lifecycle

Read the relevant child concept, the [Evidence Ledger](../evidence-ledger/), and [Repository Data Boundaries](https://github.com/Vyce101/VyDex/blob/main/docs/architecture/repository-boundaries.md). Preserve release identity, archive immutability, deterministic output, failure rollback, and the separation between local publication and hosted deployment.
