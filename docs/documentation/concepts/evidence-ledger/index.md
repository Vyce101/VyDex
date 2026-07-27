---
label: Evidence Ledger
order: 200
---

# Evidence Ledger

The Evidence Ledger is VyDex's repository-controlled record and publication-history boundary. This page is for maintainers, technical users, and coding agents that need to understand how editable evidence records become immutable published revisions without confusing either form with a public release.

## Purpose And Ownership

The Evidence Ledger keeps current authoring state separate from authoritative publication history. It owns the shared boundary between validated canonical records and immutable Entry snapshots.

It does not own release selection, public routes, Dataset serialization, page rendering, deployment, or hosted verification. Those responsibilities begin only after the ledger inputs are complete.

## Child Concepts

- [Canonical Records](canonical-records.md) owns stable record shapes, controlled values, validation rules, relationships, and safe prose profiles.
- [Publication Revisions](publication-revisions.md) owns comparison with the latest published Entry, revision numbering, materiality, timestamps, and construction of complete immutable snapshots.

## Normal Flow

1. Maintainers author or revise repository-controlled canonical records.
2. Canonical validation checks each record and the relationships across the complete collection.
3. Publication revision logic compares an accepted Entry with its latest immutable snapshot.
4. A valid publication request produces a detached snapshot for the caller to persist.
5. [Release Construction](../release-lifecycle/release-construction.md) reads the canonical collections and immutable histories without changing them.

## Internal Edge Cases

- Missing record directories behave as empty collections, while malformed files and invalid relationships produce structured diagnostics.
- Snapshot identity, directory identity, revision numbers, and publication timestamps must agree; filesystem order and modification time never determine history.
- An unpublished canonical Entry edit does not replace the latest authoritative public snapshot.

## Cross-System Edge Cases

- Release construction rejects invalid or incomplete ledger relationships rather than repairing them during projection.
- Dataset generation and public pages consume only release-selected snapshots; they do not read editable Entry files as public truth.
- Release publication may archive generated artifacts, but it must not rewrite canonical records or snapshot history.

## Invariants

- Editable records and immutable publication snapshots remain separate storage classes.
- Stable IDs inside records, not filenames or folder enumeration, identify relationships.
- Publication history is append-only and complete snapshots remain independently valid.
- Downstream systems consume validated ledger state through the release boundary instead of inventing local interpretations.

## Implementation Landmarks

- `src/domain/canonical-records/`
- `src/domain/publication-revisions/`
- `src/domain/material-activity/`
- `src/adapters/canonical-record-loader/`
- `data/canonical-records/`
- `data/publication-snapshots/`

## Before Changing The Evidence Ledger

Read both child concepts and [Repository Data Boundaries](https://github.com/Vyce101/VyDex/blob/main/docs/architecture/repository-boundaries.md). Confirm that validation remains framework-independent, loaders stay read-only, immutable snapshots are not rewritten, and downstream release behavior still consumes the same authoritative state.
