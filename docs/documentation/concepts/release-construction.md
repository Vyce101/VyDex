---
label: Release Construction
order: 400
---

# Release Construction

Release construction turns repository-controlled records and immutable Entry histories into one resolved model for every Stage 1 public consumer. This page is for maintainers, technical users, and coding agents changing loading, validation, routing, Changelog, or export behavior.

## Purpose and Ownership

The system prevents pages, components, and exports from assembling their own interpretation of the evidence ledger. It owns:

- Read-only loading of canonical JSON records and Entry publication snapshots.
- Validation of complete record collections, histories, relationships, Stage 1 content, and release inputs.
- Selection of each Entry's newest valid published snapshot.
- Resolution of Topic Trail membership, Methodology references, About links, dates, activity, and counts.
- Construction of canonical paths, absolute URLs, and permanent alias-redirect descriptors.
- Derivation of material public Changelog events.
- Registration of the Schema, stable-latest dataset, and immutable release-specific artifact routes.
- Strict production failure and diagnostic-rich private preview results.

It does not own:

- Authoring or editing canonical content.
- Creating or persisting Entry snapshots.
- Generating release IDs or timestamps.
- Reading or writing a persisted release descriptor.
- Projecting or serializing the dataset, writing generated artifacts, or emitting deployment redirect files.
- Rendering the Stage 1 pages or a private preview interface.
- Terminal logging, persistent logs, process exit behavior, or the current clock.

## Inputs and Outputs

The canonical loader receives an injectable repository root and reads the approved locations under `data/canonical-records/` and `data/publication-snapshots/entries/`. It returns located source records and loader diagnostics. Invalid JSON retains its filename and raw source text so a private preview can explain the failure.

`constructReleaseModel` receives:

- The loader result.
- Explicit `ReleaseMetadata` when available.
- An explicit public site origin.
- Either `production` or `preview` mode.

A successful production call returns one immutable `ReleaseModel`. It contains current public Entries, Methodology, Topic Trails, About content, material Changelog events, and route and permanent-alias redirect descriptors. That validated model is the input to [Dataset Generation](dataset-generation.md). A failed production call returns diagnostics and no release.

Preview always returns a `PreviewReleaseModel`. Valid sections remain available when they can be resolved without relying on invalid input; invalid records remain separate from authoritative values.

## Normal Flow

1. The application adapter reads canonical files through the project-owned loader. The loader enumerates filenames deterministically, parses JSON, and checks snapshot storage paths without changing any file.
2. The application supplies release metadata and a site origin. The framework-independent constructor does not read environment variables; the application adapter reads `PUBLIC_SITE_ORIGIN` and passes it in.
3. Record schemas validate Entries, Topic Trails, Methodologies, About content, Methodology publication events, and snapshots. Aggregate validation checks identities, slug namespaces, and relationships.
4. Snapshots are grouped by Entry ID. Each history is ordered by validated revision number and checked for numbering, chronology, materiality, Methodology references, and retained historical slugs.
5. The newest valid snapshot becomes the public Entry. Editable canonical Entry differences remain unpublished and cannot affect public content, routes, membership, activity, Changelog events, or exports.
6. The constructor resolves routes, Topic Trail membership, Methodology and About links, derived dates, latest meaningful activity, trail counts, and trail Last Activity.
7. Material snapshots and the Methodology publication event form the public Changelog.
8. Production returns the release only when no blocking diagnostic remains. Preview returns trustworthy partial results, invalid source records, and all diagnostics. Dataset projection happens only after a successful production result.

The operation is deterministic. Identical records, snapshots, release metadata, and site origin produce the same result because the constructor does not generate IDs, read the clock, or inspect filesystem timestamps.

## Production and Private Preview

Production requires a root-only HTTPS origin, valid release metadata, one complete About record, Methodology `1.0.0`, its publication event, at least one public Entry, and no empty Topic Trail. A missing or invalid requirement blocks the complete release.

Preview may use an explicitly supplied HTTPS origin or HTTP localhost. The application adapter defaults an omitted preview origin to `http://localhost:4321`, even when a production origin exists in the environment. Missing release metadata keeps release-independent information available, but the preview is non-promotable and cannot expose a release-specific dataset artifact path or enter dataset generation.

Invalid preview records are not repaired. The preview keeps their record type, recoverable ID, filename, raw or partial value, field diagnostics, and unresolved relationship diagnostics. `Missing Required Field` is a future presentation fallback, not canonical data, and the constructor never inserts it into records, routes, Changelog events, or exports.

Any blocking diagnostic sets `promotable: false`. A loader-invalid source may appear in diagnostics, but it cannot contribute to public selection, counts, ordering, routes, Changelog events, or export records.

## Snapshot Authority and Material Activity

Every canonical Entry must have a valid snapshot history, and every history must match one canonical Entry by stable ID. The current public state comes from the newest snapshot, not the editable Entry. This allows unpublished edits to exist without leaking into a release.

Date Added comes from the first publication timestamp. Date Updated and latest meaningful activity come from the newest material revision. A non-material correction may become the current revision, but it does not move homepage or Topic Trail ordering and does not appear in the public Changelog.

Stage 1 production rejects `removed` on either the editable canonical Entry or the selected snapshot. Historical removal data remains schema-readable, but the release constructor does not create a public Removed Entry route.

## Routes and Redirects

Route collision checks operate on normalized root-relative pathnames before the constructor creates absolute URLs. The registry owns the homepage and `#latest` anchor, current Entry and Topic Trail routes, current and versioned Methodology routes, About, Changelog, export landing, dataset Schema, stable-latest dataset, and release-specific dataset artifact paths.

Entry and Topic Trail aliases produce permanent `301` redirects. The stable-latest dataset path is not an alias and does not use that contract; [Dataset Generation](dataset-generation.md) returns a separate `302` descriptor whose destination changes with each release.

Current slugs create canonical routes. Historical aliases create `301` redirect descriptors that point directly to the current route. Redirect sources must be unique, cannot collide with current routes, and cannot form loops or chains. This system returns descriptors only; a later static-site integration will translate them into a deployment artifact.

About content authors provide titles and descriptions for its related links, while the route registry supplies the destinations. Authored About data therefore cannot drift from the canonical Methodology, Changelog, or export routes.

## Changelog and Dataset Input

Entry Changelog events come only from material snapshots:

- `initial_publication` becomes `added`.
- `material_update` becomes `updated`.
- `removal` becomes `removed` when historical data contains one.

The separately authored Methodology publication event becomes `methodology_change`. Events sort by calendar date, exact timestamp when both events have one, the approved event-type order, public title, and stable source identity. Exact timestamps and tie-breakers are internal ordering data rather than public display fields.

Release construction retains the selected snapshot, derived revision activity, canonical URL, and resolved Topic Trail and Methodology references for every current Entry. It does not create public export records. The separate dataset generator uses this resolved state so pages and exports cannot disagree about which revision or relationship is current.

Sources and Domains remain in their validated release-model form at this boundary. Dataset generation applies the public Dataset `1.0.0` ordering rules, derives labels and Evidence Types, validates the serialized result against its Schema, and returns immutable artifact metadata. The filesystem writer remains a separate adapter.

## Failure Behavior

Diagnostics identify the record type, field or rule, recoverable record ID, filename, invalid value, and related record when those values exist. Production does not return a partial release when any blocking error remains.

Blocking conditions include malformed JSON, invalid snapshot paths, invalid records, missing or orphan histories, broken relationships, duplicate or colliding routes, incomplete required content, wrong Methodology references, removed current Entries, empty Topic Trails, invalid origins or release metadata, and permanent-alias redirect failures.

The loader and constructor return diagnostics without writing to standard output or standard error. A later atomic release command may format those diagnostics and choose a nonzero process exit code.

## Internal Edge Cases

- Missing canonical directories load as empty collections, allowing release validation to report the absent Stage 1 requirements.
- Only `.json` authoring files are loaded. Snapshot discovery is recursive only under the snapshot Entry root.
- Snapshot directory and filename metadata must agree with the parsed snapshot, but revision ordering comes from validated contents.
- Standard URL parsing can normalize invalid-looking paths; origin validation also checks the supplied syntax so query delimiters, fragments, and non-root paths remain invalid.
- An invalid record with a recoverable ID remains visible in preview but cannot make an incomplete aggregate appear authoritative.
- Topic Trail membership includes both primary and secondary relationships. Every loaded trail must contain at least one selected public Entry.
- Entry-level Evidence Types are derived in controlled-value order, while embedded sources retain authored order.

## Cross-System Edge Cases

- [Canonical Records](canonical-records.md) owns stored shapes and record-local rules. Release construction consumes those schemas rather than widening or repairing them.
- [Publication Revisions](publication-revisions.md) owns snapshot creation, history semantics, and material activity. Release construction validates complete stored histories and selects their current state.
- [Dataset Generation](dataset-generation.md) owns public export projection, Schema validation, deterministic serialization, immutable artifact descriptors, and the dataset filesystem writer boundary.
- [Static Application Foundation](static-application-foundation.md) owns the Astro build and dependency direction. Astro pages must consume the shared application release adapter instead of parsing authoring files.
- Release metadata persistence remains outside the canonical loader. Rebuilding the same release with the same explicit metadata preserves its ID and generation timestamp.
- The current Astro fixture does not invoke strict production construction. Real content, public pages, genuine dataset emission, and deployment redirects remain future work, although the versioned Schema is already published statically.

## Invariants

- One release model is the source for homepage, Entry, Topic Trail, Methodology, About, Changelog, route, redirect, and dataset consumers.
- Invalid records are never silently omitted, repaired, or promoted into authoritative derived values.
- Public Entry state and relationships come from immutable snapshots; editable differences remain unpublished.
- Non-material revisions do not change material activity ordering or public Changelog events.
- Stable IDs resolve relationships; filenames and slugs do not.
- Canonical URLs come from a validated explicit origin and the route registry.
- Release metadata is supplied unchanged and is never generated or inferred.
- Production returns either one complete internally consistent release or no release.
- Loader and domain code remain free of logging and write side effects.

## Implementation Landmarks

- `src/adapters/canonical-record-loader/` — Read-only repository JSON loading and path diagnostics.
- `src/adapters/application-release/` — Environment-facing origin configuration and the single application release call.
- `src/domain/release-construction/` — Validation orchestration, preview handling, and resolved release models.
- `src/domain/route-generation/` — Origin, route-registry, canonical URL, and redirect contracts.
- `src/domain/json-export-generation/` — Post-release Dataset `1.0.0` projection, Schema, validation, and serialization.
- `tests/adapters/` and `tests/domain/` — Loader, production, preview, routing, Changelog, dataset, and writer coverage.

## Before Changing Release Construction

Check:

- Whether a value is authored, stored in a snapshot, supplied as release metadata, or derived for one release.
- Whether preview output remains honest when an invalid record could change membership, counts, ordering, routes, or exports.
- Whether public Entry selection still ignores unpublished editable differences.
- Whether material activity remains separate from the current revision after a non-material update.
- Whether route and alias checks run before absolute URL generation.
- Whether every page-facing value still comes from the shared release model.
- Whether dataset behavior belongs in [Dataset Generation](dataset-generation.md) rather than the release constructor.
- Whether a proposed filesystem, environment, clock, logging, or output side effect belongs in an adapter or later release command instead of the domain constructor.
- Whether tests cover both strict production rejection and diagnostic preview behavior.
