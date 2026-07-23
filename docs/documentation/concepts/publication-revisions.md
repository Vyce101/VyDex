---
label: Publication Revisions
order: 300
---

# Publication Revisions

Publication revisions turn a validated editable Entry into a complete immutable public snapshot. This page is for maintainers, technical users, and coding agents that need to publish revisions or change the history and activity rules safely.

## Purpose and Ownership

The system keeps editable Entry state separate from published history. It owns:

- Validation of one Entry's existing snapshot sequence.
- Comparison of the proposed Entry with its latest published state.
- Revision numbering, category and materiality consistency, and publication timestamp ordering.
- Maintainer-declared semantic material-change paths.
- Construction of a complete detached snapshot.
- Derivation of current revision metadata and material activity dates.
- Structured blocking diagnostics for rejected publication requests.

It does not own:

- Loading canonical records, Methodologies, or snapshots from files.
- Generating revision IDs or reading the current clock.
- Choosing filenames, directories, or repository tracking policy.
- Persisting returned snapshots or creating releases.
- Terminal output, logging side effects, public pages, or historical browsing.

## Inputs and Outputs

`publishEntryRevision` receives a proposed canonical Entry, the existing snapshots for that Entry, and every Methodology record referenced by the proposed or historical states. The caller also supplies the revision UUIDv7, RFC 3339 UTC timestamp, revision category, materiality, update summary, and any semantic material-change paths.

The operation returns either a complete, deeply readonly `EntryPublicationSnapshot` with `DerivedEntryRevisionActivity`, or structured blocking diagnostics with no snapshot. The returned snapshot is detached from the editable Entry, so later mutations to the caller's object cannot change the published value.

`material_change_paths` is request-only validation input. It is not stored in the snapshot. Historical explanation comes from the category, materiality, update summary, and complete before-and-after Entry states.

## Normal Publication Flow

1. Validate the proposed Entry and caller-supplied publication metadata with the canonical schemas.
2. Validate the existing snapshots, then order copies by revision number without mutating caller input.
3. Require revision numbers to begin at 1 without gaps or duplicates, and require publication timestamps to increase strictly with revision number.
4. Require the current published Entry to retain every earlier published slug as a direct alias.
5. Resolve the proposed and historical Methodology ID/version pairs against the supplied Methodology collection.
6. Compare the latest published Entry with the proposed Entry and check the category, materiality, and declared semantic paths.
7. Assign the next revision number, construct a complete snapshot, validate it with the canonical snapshot schema, detach it, and freeze its nested values.
8. Derive current revision metadata, Date Added, Date Updated, and latest meaningful activity from the completed sequence.

The operation is deterministic. Identical inputs produce the same result because the domain does not generate IDs, read the clock, access files, or use ambient process state.

## Materiality

The first revision must use `initial_publication` with `material`. Later publications use `material_update`, `non_material_correction`, or `review_check` with their matching materiality. Stage 1 does not create `removal` revisions, although historical removal snapshots remain readable. `methodology_publication` belongs to Methodology history and is not valid for an Entry snapshot.

Changes to Claim Status, Evidence Strength, Entry State, Confirmed Significance, or Potential Significance if Confirmed are always material. A non-material request that changes one of these fields is rejected.

Prose and source changes require maintainer judgment because structural comparison cannot determine meaning. A request may declare paths such as `details.context_changes_interpretation`, `frontier_delta`, `caveats`, or `sources[citation-id]`. Every declaration must identify an actual difference. Sources are matched by Entry-local citation ID, so reordering otherwise identical sources does not count as a semantic source change.

A later `material_update` needs an automatically material difference or at least one valid declaration. A non-material correction cannot include either. A `review_check` must change `date_last_checked`; it may also change review scheduling fields when those changes do not alter public interpretation. A request with no public Entry change is rejected.

## Revision Activity

`deriveEntryRevisionActivity` works from a non-empty valid sequence:

- Date Added is the UTC date portion of revision 1's publication timestamp.
- Date Updated is the UTC date portion of the newest material revision.
- Current revision ID, number, and update summary come from the newest revision.
- Latest meaningful activity contains the newest material revision's ID, number, timestamp, category, and update summary.

A non-material revision becomes current but does not move Date Updated or replace latest meaningful activity. Dates never come from file modification time, Git history, build time, or local timezone conversion.

## Failure Behavior

Publication stops before snapshot construction when any input or history rule fails. Blocking conditions include invalid canonical state, empty summaries, duplicate or discontinuous revisions, contradictory chronology, missing historical slug aliases, unresolved Methodologies, duplicate Methodology IDs, category/materiality conflicts, unchanged material declarations, and disabled Stage 1 removal.

The domain returns `ValidationDiagnostic` values. A future command may format them for standard output or standard error, but formatting and process exit behavior do not belong in this system.

## Internal Edge Cases

- Existing snapshots may arrive out of order. Validation sorts a copy by revision number; input order is not mutated.
- Revision number is the authoritative sequence, but timestamps must agree with that order and cannot be equal.
- An empty history is valid only while proposing the initial publication. Standalone activity derivation rejects an empty sequence.
- Stored material updates may have depended on a transient semantic declaration. Historical validation verifies objective contradictions but does not try to reconstruct that earlier editorial judgment.
- When a published slug changes, the newest snapshot must retain every earlier published slug as a direct alias. Release construction uses those aliases for direct permanent-redirect descriptors.
- A source selector must use a valid non-numeric citation ID. Array indices, malformed selectors, unknown fields, duplicate paths, and declarations for unchanged fields fail validation.

## Cross-System Edge Cases

- [Canonical Records](canonical-records.md) owns the Entry, Methodology, timestamp, UUIDv7, controlled-value, and snapshot schemas. Publication revisions consume those contracts without expanding the stored snapshot.
- Every historical snapshot must resolve to the exact supplied Methodology ID and public version that it records. Older revisions may reference older Methodology records.
- Aggregate canonical validation can validate repository-wide identities and relationships. The publication operation validates only the complete referenced Methodology set supplied for one Entry history.
- Repository persistence remains separate. A successful return does not mean a snapshot file exists or that a release includes it.
- [Release Construction](release-construction.md) validates complete stored histories, selects the newest snapshot, and derives public routes and Changelog events. [Dataset Generation](dataset-generation.md) projects the selected current snapshots into the public export contract.
- Historical public browsing remains future Stage 3 work; retained snapshots have no public revision route yet.

## Invariants

- Published snapshots are complete Entry states, not patches or change descriptions.
- Existing snapshots are never edited in place.
- Revision IDs are UUIDv7 values supplied by the caller and remain unique within the history.
- Revision numbers begin at 1, remain contiguous, and determine sequence order.
- Publication timestamps use UTC and increase strictly with revision number.
- Material changes cannot be published as non-material.
- Update summaries must be non-empty plain text and provide the permanent public explanation of what changed.
- Previously published slugs remain direct aliases of the current published slug.
- Date Added and Date Updated come only from stored publication timestamps.
- Domain operations remain free of filesystem, logging, clock, randomness, and UI behavior.

## Implementation Landmarks

- `src/domain/publication-revisions/` — Publication requests, Entry comparison, material-change paths, Methodology resolution, diagnostics, and immutable snapshot construction.
- `src/domain/material-activity/` — Intrinsic history validation and activity derivation.
- `src/domain/canonical-records/` — Entry, Methodology, snapshot, identifier, timestamp, and controlled-value contracts.
- `tests/domain/` — Publication, history, materiality, activity, and immutability coverage.

## Before Changing Publication Revisions

Check:

- Whether a proposed field is stored canonical state, transient publication input, or derived activity.
- Whether a rule can be validated objectively or must remain an explicit maintainer declaration.
- Whether snapshot compatibility or older Methodology references would be broken.
- Whether revision order, timestamp order, and material activity still agree.
- Whether a new source path remains stable when sources are reordered.
- Whether a change introduces filesystem, clock, randomness, logging, or UI behavior into the domain boundary.
- Whether tests cover old snapshot readability, contradictory materiality, and non-material activity ordering.
