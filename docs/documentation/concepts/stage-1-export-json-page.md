---
label: Stage 1 Export JSON Page
order: 1000
---

# Stage 1 Export JSON Page

The Stage 1 Export JSON Page publishes a data-register view at `/export/` for the exact current VyDex Dataset `1.0.0` artifact. It lets readers inspect the release scope and metadata before downloading the latest public Entry versions. This page is for technical users, maintainers, and coding agents changing export preparation, static artifact publication, release metadata projection, download behavior, or responsive presentation.

## Purpose and Ownership

The feature prevents the public page and downloadable JSON from describing different releases. It owns:

- Application-level preparation of one generated Dataset `1.0.0` artifact for an already selected validated release.
- Determinism checks that compare repeated generation for the same release.
- Derivation and validation of the page presentation model from the generated dataset and artifact.
- The `/export/` heading hierarchy, exact section order, limits, use notes, and immutable download action.
- Static publication of the selected release's dated JSON artifact during Astro builds.
- Responsive record-sheet and field-index composition using Frontier Atlas primitives.
- Structured diagnostics that block the page and artifact when their metadata cannot be proven consistent.

It does not own:

- Canonical records, publication snapshots, release construction, or production descriptor creation.
- Dataset `1.0.0` field projection, Schema construction, JSON serialization, or Schema validation.
- Durable artifact persistence, release manifests, stable-latest redirect publication, deployment, or atomic replacement.
- Historical Entry exports, CSV, custom filtering, a public API, login, payments, or commercial gating.
- Runtime metadata loading, browser download management, telemetry, or persistent logging.

[Dataset Generation](dataset-generation.md) owns the artifact contract and validated bytes. [Release Construction](release-construction.md) owns the complete release model and route registry. The [Stage 1 Release Gate](stage-1-release-gate.md) owns genuine descriptor creation, staged artifact writing, verification, manifest creation, and local promotion.

## Inputs and Outputs

`prepareApplicationExport` accepts one already selected production `ReleaseModel`. Development and test callers obtain that model from the fixed non-production application-release adapter; production callers obtain it only from the persisted genuine descriptor.

Successful preparation returns:

- The generated typed dataset and deterministic serialized JSON.
- The exact immutable public download path and dated filename.
- The Dataset Schema path and stable-latest redirect descriptor produced by dataset generation.
- A page model containing format, scope label, Entry count, UTC generation date, represented Methodology versions, filename, download path, and Schema path.

The page model does not read a hand-authored configuration or parse metadata back from a file. Its Entry count and Methodology versions come from the generated dataset, and its filename and public path come from the same release metadata used by route construction.

## Normal Flow

1. The thin Astro route selects the fixed development/test release or persisted production release through the named application-release adapter.
2. The application export boundary invokes `generateVyDexDatasetV1` twice with that same in-memory release.
3. Preparation rejects any difference in immutable path or serialized bytes.
4. It checks Entry count, scope, UTC generation time, represented Methodology versions, Schema path, filename, and immutable path against the generated dataset and selected release descriptor.
5. The page route renders the validated presentation model through the shared Foundation Layout.
6. The prerendered dataset endpoint uses the same preparation boundary and emits the exact serialized bytes at the release-specific route.
7. The browser follows a normal same-origin download link. It does not fetch metadata, assemble JSON, or run a client-side download application.

Astro generates the release-specific endpoint through a dynamic static route. In development and test mode, the route produces a deterministic non-production artifact in disposable `dist/` output. In production, descriptor loading happens before preparation, so a missing or invalid genuine descriptor blocks publication.

## Immutable Download Identity

The download path is:

```text
/datasets/releases/{release-id}/vydex-latest-entry-versions-v1-0-0-{YYYY-MM-DD}.json
```

`YYYY-MM-DD` is the UTC calendar date already present in validated `release_metadata.generated_at`. No current clock, local timezone, filesystem time, Git time, or build date participates in the filename. The Release ID directory provides the immutable identity; the dated basename makes a downloaded file understandable outside VyDex.

The page links directly to this path. It does not use `/datasets/vydex-latest-entry-versions-v1-0-0.json`, because that stable convenience route is mutable across releases. The release gate emits and verifies its `302` redirect while keeping the page's download tied to the immutable artifact.

## User-Facing Behavior

The shared Header marks Export JSON active. Main content contains one H1 followed by these H2 sections in order:

1. Current Export.
2. What's Included.
3. Stage 1 Limits.
4. Use Notes.

Current Export displays JSON format, Latest Entry Versions scope, exact Entry count, exact UTC generation date, and that Methodology versions are included per Entry. Represented versions appear as unlinked metadata so the page does not imply that every Entry must use one Methodology version.

The download action is a text-labelled primary button with a visible keyboard focus state and a `download` filename derived from the artifact. The field index is a compact ruled table on wider viewports and becomes stacked definition records on mobile without horizontal scrolling. Core content and the download link remain available without browser JavaScript.

The page states that Stage 1 has no historical Entry versions, custom filters, CSV export, or public API. It does not imply a complete archive, historical export support, premium data product, or developer platform.

## Failure Behavior

Preparation returns structured blocking diagnostics and no presentation model when dataset generation or Schema validation fails, artifact metadata is absent or inconsistent, represented Methodology versions are missing, release and dataset timestamps disagree, Entry count is wrong, scope changes, or repeated generation changes the path or bytes.

The Astro routes convert those failed results into build errors containing diagnostic codes. Production never renders placeholder content, a partial page, or a link whose artifact could not be generated. Ordinary browser or network download failures remain browser behavior and do not add a Stage 1 client-side recovery application.

## Internal Edge Cases

- Repeated preparation of the same release must return identical paths, bytes, and page metadata.
- Changing either the Release ID or UTC generation date changes the immutable location without consulting external state.
- The page displays the generated Entry count only after verifying that it equals the generated Entry array length.
- Methodology versions are derived from generated Entries and must agree with dataset-level metadata.
- The dated endpoint parameter must reconstruct the same public path returned by preparation before it emits bytes.
- The field index keeps essential labels in HTML through `data-label` values when CSS changes the mobile table layout.

## Cross-System Edge Cases

- [Dataset Generation](dataset-generation.md) validates and serializes the public contract. Export preparation rejects disagreements; it does not repair or independently reimplement dataset rules.
- [Release Construction](release-construction.md) supplies the route registry and complete current Entries. Preview or incomplete releases cannot enter export preparation.
- [Static Application Foundation](static-application-foundation.md) owns mode selection, static route generation, hosting response metadata, and build failure propagation.
- [Stage 1 Site Shell](stage-1-site-shell.md) owns Header, Footer, active navigation, canonical document structure, and focus foundations.
- [Frontier Atlas](frontier-atlas-design-system.md) owns the sheet, rule, button, table, typography, breakpoint, and accessibility primitives composed by the page.
- [Repository Data Boundaries](https://github.com/Vyce101/VyDex/blob/main/docs/architecture/repository-boundaries.md) separates disposable test-build artifacts from durable genuine release state.
- The [Stage 1 Release Gate](stage-1-release-gate.md) reuses preparation and the existing artifact writer, then verifies the page and artifact together before promotion. Deployment remains outside both systems.

## Invariants

- One selected validated release is the source for both page metadata and downloaded bytes.
- The download always targets the release-specific immutable artifact, never the stable convenience path.
- Filename dates come only from validated UTC release metadata.
- Identical release metadata and source records produce identical paths and bytes.
- Development and test metadata never become a production descriptor or committed genuine artifact.
- Production fails closed while the persisted genuine descriptor is absent or invalid.
- Dataset Schema versioning and represented Methodology versions remain separate concepts.
- The page never claims historical archive, CSV, filter, or public API support.
- Core content and download navigation remain static and usable without browser JavaScript.
- The feature adds no runtime backend, client logging, telemetry, or persistent logs.

## Implementation Landmarks

- `src/adapters/application-export/` — Prepared artifact and page-model consistency boundary.
- `src/adapters/application-release/` — Named fixed-metadata and persisted-production release sources.
- `src/features/export-page/` — Export JSON markup and responsive Frontier Atlas composition.
- `src/pages/export/` — Thin static page route and canonical URL integration.
- `src/pages/datasets/releases/` — Thin prerendered immutable JSON endpoint.
- `src/domain/json-export-generation/` and `src/domain/route-generation/` — Dataset bytes, Schema validation, and shared artifact-location derivation.
- `tests/adapters/`, `tests/features/`, and `tests/browser/` — Preparation, content, download, Schema, responsive, no-JavaScript, and accessibility coverage.

## Before Changing Export JSON

Check:

- Whether the change belongs to Dataset generation, application preparation, static publication, or page presentation.
- Whether page metadata still comes from the exact generated artifact rather than a second configuration source.
- Whether the shared filename derivation still uses only validated UTC release metadata.
- Whether the download still targets the immutable route while the release gate separately verifies the stable convenience redirect.
- Whether repeat generation still proves identical path and bytes.
- Whether test builds remain deterministic and write only disposable output without creating a descriptor.
- Whether production still fails closed before rendering when genuine release state is unavailable or invalid.
- Whether desktop table semantics, mobile definition labels, keyboard focus, no-JavaScript content, and horizontal-overflow checks still pass.
- Whether the page continues to state Stage 1 limits without implying unsupported archive, API, filter, CSV, or commercial capabilities.
