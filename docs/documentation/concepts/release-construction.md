---
label: Release Construction
order: 600
---

# Release Construction

Release construction turns repository-controlled records and immutable Entry histories into one resolved model for every Stage 1 public consumer. This page is for maintainers, technical users, and coding agents changing loading, validation, routing, Changelog, or export behavior.

## Purpose and Ownership

The system prevents pages, components, and exports from assembling their own interpretation of the evidence ledger. It owns:

- Read-only loading of canonical JSON records and Entry publication snapshots.
- Validation of complete record collections, histories, relationships, Stage 1 content, and release inputs.
- Selection of each Entry's newest valid published snapshot.
- Deterministic public ordering of a copied source array on each resolved current Entry.
- Resolution of Topic Trail membership, Methodology references, About links, dates, activity, and counts.
- Construction of canonical paths, absolute URLs, and permanent alias-redirect descriptors.
- Derivation of material public Changelog events.
- Registration of the Schema, stable-latest dataset, and immutable release-specific artifact routes.
- Read-only loading and validation of persisted production release metadata at the application boundary.
- Strict production failure and diagnostic-rich private preview results.

It does not own:

- Authoring or editing canonical content.
- Creating or persisting Entry snapshots.
- Generating release IDs or timestamps.
- Creating, rewriting, or silently substituting a persisted release descriptor.
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

A successful production call returns one immutable `ReleaseModel`. It contains current public Entries, Methodology, Topic Trails, About content, material Changelog events, and route and permanent-alias redirect descriptors. That validated model feeds public pages, including the [Stage 1 About Page](stage-1-about-page.md), [Stage 1 Topic Trail Page](stage-1-topic-trail-page.md), and [Stage 1 Methodology Page](stage-1-methodology-page.md), and is the input to [Dataset Generation](dataset-generation.md). A failed production call returns diagnostics and no release.

Preview always returns a `PreviewReleaseModel`. Valid sections remain available when they can be resolved without relying on invalid input; invalid records remain separate from authoritative values.

The application boundary exposes two named release sources. `loadPersistedProductionApplicationRelease` reads the exact production descriptor path and constructs a strict release. `loadFixedMetadataDevelopmentApplicationRelease` injects stable non-production metadata for development and test mode without writing it anywhere.

## Normal Flow

1. The application adapter reads canonical files through the project-owned loader. The loader enumerates filenames deterministically, parses JSON, and checks snapshot storage paths without changing any file.
2. The application supplies release metadata and a site origin. Production reads metadata from the persisted descriptor; development and explicit test mode inject fixed non-production metadata. The framework-independent constructor does not read environment variables or files.
3. Record schemas validate Entries, Topic Trails, Methodologies, About content, Methodology publication events, and snapshots. Aggregate validation checks identities, slug namespaces, and relationships.
4. Snapshots are grouped by Entry ID. Each history is ordered by validated revision number and checked for numbering, chronology, materiality, Methodology references, and retained historical slugs.
5. The newest valid snapshot becomes the public Entry. Release resolution clones that Entry and orders its copied source array for public display; the immutable snapshot and editable canonical Entry remain unchanged.
6. The constructor resolves routes, Topic Trail membership, Methodology and About links, derived dates, latest meaningful activity, trail counts, and trail Last Activity. Each trail receives its own copied Entry list in latest-update order.
7. Material snapshots and the Methodology publication event form the public Changelog.
8. Production returns the release only when no blocking diagnostic remains. Preview returns trustworthy partial results, invalid source records, and all diagnostics. Dataset projection happens only after a successful production result.

The operation is deterministic. Identical records, snapshots, release metadata, and site origin produce the same result because the constructor does not generate IDs, read the clock, or inspect filesystem timestamps.

## Persisted Release Metadata Boundary

`PersistedReleaseDescriptor` is the validated `ReleaseMetadata` shape stored at `generated/release-data/release.json`. The read-only adapter resolves that exact path beneath an injected repository root, parses JSON, and validates it with `releaseMetadataSchema`.

Production loading fails closed when the descriptor is missing, unreadable, malformed, or schema-invalid. It never falls back to the fixed development/test metadata. Ordinary builds, development starts, page renders, and tests do not create a UUID, read the clock, or write the descriptor.

The fixed adapter is explicitly non-production. Its constants make local and automated output reproducible, but they are not genuine release state and must not be written into canonical records or persisted as a production descriptor. A later atomic release command remains the sole creator and writer of genuine descriptor state. Once created, the descriptor is durable release data and remains eligible for source control rather than disposable cache.

## Production and Private Preview

Production requires a root-only HTTPS origin, valid release metadata, one complete About record, Methodology `1.0.0`, its publication event, at least one public Entry, and no empty Topic Trail. A missing or invalid requirement blocks the complete release.

Preview may use an explicitly supplied HTTPS origin or HTTP localhost. The application adapter defaults an omitted preview origin to `http://localhost:4321`, even when a production origin exists in the environment. Missing release metadata keeps release-independent information available, but the preview is non-promotable and cannot expose a release-specific dataset artifact path or enter dataset generation.

Invalid preview records are not repaired. The preview keeps their record type, recoverable ID, filename, raw or partial value, field diagnostics, and unresolved relationship diagnostics. The Topic Trail page may present `Missing Required Field` and `Last Activity: Unknown`, but the constructor never inserts those fallbacks into records, resolved release values, routes, Changelog events, or exports.

Any blocking diagnostic sets `promotable: false`. A loader-invalid source may appear in diagnostics, but it cannot contribute to public selection, counts, ordering, routes, Changelog events, or export records.

## Snapshot Authority and Material Activity

Every canonical Entry must have a valid snapshot history, and every history must match one canonical Entry by stable ID. The current public state comes from the newest snapshot, not the editable Entry. This allows unpublished edits to exist without leaking into a release.

Date Added comes from the first publication timestamp. Date Updated and latest meaningful activity come from the newest material revision. Latest meaningful activity also retains the Entry title from that material snapshot.

Resolved public Entries sort by latest meaningful activity timestamp descending, Date Added descending, then immutable Entry ID ascending. The shared pure comparator is also used by the [Stage 1 Homepage](stage-1-homepage.md), so a non-material correction or title-only change cannot move an Entry in either list.

Each resolved Topic Trail has a separate latest-update comparator. It uses latest meaningful activity timestamp descending, Date Added descending, the retained material title alphabetically in English, then immutable Entry ID ascending. This extra title key applies only inside Topic Trail lists. A later non-material title correction may change the displayed current title but cannot change trail order or Last Activity.

Stage 1 production rejects `removed` on either the editable canonical Entry or the selected snapshot. Historical removal data remains schema-readable, but the release constructor does not create a public Removed Entry route.

## Routes and Redirects

Route collision checks operate on normalized root-relative pathnames before the constructor creates absolute URLs. The registry owns the homepage and `#latest` anchor, current Entry and Topic Trail routes, current and versioned Methodology routes, About, Changelog, export landing, dataset Schema, stable-latest dataset, and release-specific dataset artifact paths.

The resolved Methodology pairs the validated canonical record with separate current and immutable absolute URLs. The Methodology Page consumes those URLs directly for route-specific canonical metadata; Entry records continue to carry the immutable version URL assigned by their published snapshot.

Entry and Topic Trail aliases produce permanent `301` redirects. The stable-latest dataset path is not an alias and does not use that contract; [Dataset Generation](dataset-generation.md) returns a separate `302` descriptor whose destination changes with each release.

Current slugs create canonical routes. Historical aliases create `301` redirect descriptors that point directly to the current route. Redirect sources must be unique, cannot collide with current routes, and cannot form loops or chains. This system returns descriptors only; a later static-site integration will translate them into a deployment artifact.

About content authors provide titles and descriptions for its related links, while the route registry supplies the destinations. Authored About data therefore cannot drift from the canonical Methodology, Changelog, or export routes.

The About Page consumes the resolved record directly. It uses the registered About route and validated site origin for its self-canonical URL, while its Related Links use the absolute destinations already attached by release construction.

## Changelog and Dataset Input

Entry Changelog events come only from material snapshots:

- `initial_publication` becomes `added`.
- `material_update` becomes `updated`.
- `removal` becomes `removed` when historical data contains one.

The separately authored Methodology publication event becomes `methodology_change`. Events sort by calendar date, exact timestamp when both events have one, the approved event-type order, public title, and stable source identity. Exact timestamps and tie-breakers are internal ordering data rather than public display fields.

Release construction retains the selected snapshot, derived revision activity, canonical URL, resolved Topic Trail and Methodology references, and publicly ordered copied sources for every current Entry. It does not create public export records. The [Stage 1 Entry Page](stage-1-entry-page.md) renders that resolved order directly, while the separate dataset generator uses the same resolved state so pages and exports cannot disagree about which revision or relationship is current.

The source-ordering module owns one pure comparator: Source Role follows the approved evidence-role cascade, and an English alphabetical title comparison breaks ties. Its ordering helper sorts a copied array. Dataset generation defensively reapplies that same helper to copied input, derives labels and Evidence Types, validates the serialized result against its Schema, and returns immutable artifact metadata. Domains retain their validated order. The filesystem writer remains a separate adapter.

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
- Topic Trail membership includes both primary and secondary relationships. Every loaded trail must contain at least one selected public Entry, and sorting a trail does not reorder `current_entries`.
- The current Entry title and retained material title may differ after a non-material correction. Trail ordering uses the retained material title; public Entry content continues to use the selected current snapshot.
- Public source ordering never mutates the canonical Entry, an immutable snapshot, or its source objects. Source labels, Evidence Types, URLs, publishers, and `used_for` values remain attached to the same citation after sorting.

## Cross-System Edge Cases

- [Canonical Records](canonical-records.md) owns stored shapes and record-local rules. Release construction consumes those schemas rather than widening or repairing them.
- [Publication Revisions](publication-revisions.md) owns snapshot creation, history semantics, and material activity. Release construction validates complete stored histories and selects their current state.
- [Dataset Generation](dataset-generation.md) owns public export projection, Schema validation, deterministic serialization, immutable artifact descriptors, and the dataset filesystem writer boundary.
- The [Entry Preview](entry-preview.md) consumes a typed subset of `ResolvedPublicEntry`. It must use resolved dates, Topic Trail data, and canonical URLs rather than load, infer, or repair authoring records.
- The [Stage 1 Entry Page](stage-1-entry-page.md) consumes the complete `ResolvedPublicEntry`, including its publicly ordered sources. It must not introduce a page-local comparator.
- The [Stage 1 Methodology Page](stage-1-methodology-page.md) consumes `ResolvedMethodology`, including its current and version-specific canonical URLs. It must not reconstruct those URLs from the request pathname.
- The [Stage 1 About Page](stage-1-about-page.md) consumes `ResolvedAboutRecord`. It must not load authoring JSON, repair missing content, or reconstruct Related Link destinations.
- The [Stage 1 Homepage](stage-1-homepage.md) consumes `current_entries` and reuses the release comparator. It does not add filtering, title ordering, or a second material-activity field.
- The [Stage 1 Topic Trail Page](stage-1-topic-trail-page.md) consumes one resolved non-empty trail with its ordered Entries, count, Last Activity, and canonical URL. It verifies consistency but does not rebuild membership or ordering.
- [Static Application Foundation](static-application-foundation.md) owns the Astro build and dependency direction. Astro pages must consume the shared application release adapter instead of parsing authoring files.
- Release metadata persistence remains outside the canonical loader and domain constructor. Rebuilding the same release with the same persisted descriptor preserves its ID, generation timestamp, and deterministic output.
- The repository contains the complete Stage 1 seed record set. Tests and development page builds inject fixed metadata through the named non-production adapter without creating or persisting a genuine release. Normal production remains blocked until the later atomic release command creates the descriptor.

## Invariants

- One release model is the source for homepage, Entry, Topic Trail, Methodology, About, Changelog, route, redirect, and dataset consumers.
- Invalid records are never silently omitted, repaired, or promoted into authoritative derived values.
- Public Entry state and relationships come from immutable snapshots; editable differences remain unpublished.
- Resolved current Entries expose sources in deterministic public order without changing canonical records or immutable snapshots.
- Non-material revisions do not change material activity ordering, Topic Trail ordering, Trail Last Activity, or public Changelog events.
- Stable IDs resolve relationships; filenames and slugs do not.
- Canonical URLs come from a validated explicit origin and the route registry.
- Release metadata is supplied unchanged and is never generated or inferred.
- Production release metadata comes only from `generated/release-data/release.json`; fixed development/test metadata is never a fallback.
- Production returns either one complete internally consistent release or no release.
- Loader and domain code remain free of logging and write side effects.

## Implementation Landmarks

- `src/adapters/canonical-record-loader/` — Read-only repository JSON loading and path diagnostics.
- `src/adapters/application-release/` — Environment-facing origin configuration and the single application release call.
- `src/adapters/persisted-release-descriptor/` — Exact-path descriptor reading, JSON parsing, and Schema validation.
- `src/domain/release-construction/` — Validation orchestration, preview handling, and resolved release models.
- `src/domain/release-construction/compare-resolved-public-entries.ts` — Shared material-activity ordering comparator.
- `src/domain/release-construction/compare-resolved-topic-trail-entries.ts` — Topic Trail latest-update comparator with the material-title tie-breaker.
- `src/domain/source-ordering/` — Shared public source comparator and copied-array ordering helper.
- `src/domain/route-generation/` — Origin, route-registry, canonical URL, and redirect contracts.
- `src/domain/json-export-generation/` — Post-release Dataset `1.0.0` projection, Schema, validation, and serialization.
- `tests/adapters/` and `tests/domain/` — Loader, production, preview, routing, Changelog, dataset, and writer coverage.

## Before Changing Release Construction

Check:

- Whether a value is authored, stored in a snapshot, supplied as release metadata, or derived for one release.
- Whether preview output remains honest when an invalid record could change membership, counts, ordering, routes, or exports.
- Whether public Entry selection still ignores unpublished editable differences.
- Whether material activity remains separate from the current revision after a non-material update.
- Whether release resolution and Homepage selection still share the same material-activity, Date Added, and immutable-ID comparator.
- Whether Topic Trail resolution still uses material activity, Date Added, the retained material title, and immutable Entry ID without mutating `current_entries`.
- Whether release resolution and Dataset generation still share the public source comparator while canonical and snapshot arrays remain untouched.
- Whether production descriptor loading still uses the exact reserved path and fails instead of falling back to fixed metadata.
- Whether route and alias checks run before absolute URL generation.
- Whether every page-facing value still comes from the shared release model.
- Whether dataset behavior belongs in [Dataset Generation](dataset-generation.md) rather than the release constructor.
- Whether a proposed filesystem, environment, clock, logging, or output side effect belongs in an adapter or later release command instead of the domain constructor.
- Whether tests cover both strict production rejection and diagnostic preview behavior.
