---
label: Stage 1 Release Gate
order: 1300
---

# Stage 1 Release Gate

The Stage 1 release gate turns one validated VyDex release into verified static output. It is the only workflow allowed to create the initial production descriptor, and it promotes output only after the website, Schema, export, redirects, and manifest agree. This page is for maintainers and coding agents changing release orchestration, generated output, validation, or persistence behavior.

## Purpose and Ownership

The gate prevents a partially valid or internally inconsistent build from replacing the previous promotable output.

It owns:

- The `npm run release:stage-1` production release command.
- The approved Stage 1 origin `https://vydex.vyce.workers.dev`.
- Exclusive creation and immutable reuse of the initial Stage 1 release descriptor.
- Type-check and complete Vitest execution before production generation.
- Isolated Astro staging under ignored `runtime/` storage.
- Static-output, link, count, Schema, export, redirect, and navigation verification.
- The internal release manifest and promoted-file inventory.
- Rollback-aware promotion of the verified static output and manifest.
- Human-readable terminal diagnostics and private rotating release logs.

It does not own:

- Authoring canonical records or publication snapshots.
- Deciding whether a record or relationship is valid. [Release Construction](release-construction.md) owns those rules.
- Defining the Dataset `1.0.0` contract or JSON Schema. [Dataset Generation](dataset-generation.md) owns those contracts.
- Creating a later release descriptor or rotating the Stage 1 descriptor.
- Deploying to Cloudflare Pages, invoking Wrangler, or changing the hosted production site.
- Rendering a public preview, manifest route, diagnostics page, or client-side recovery state.

## Inputs and Outputs

The gate reads the repository-controlled canonical records and Entry snapshots, the existing release descriptor when present, and the previous successful manifest when present. It also consumes the release model, artifact, Schema, route, and redirect contracts produced by the existing domain and adapter boundaries.

A successful run produces:

- A durable descriptor at `generated/release-data/release.json` if one did not already exist.
- A complete verified static site at `dist/`.
- An internal manifest at `generated/release-data/release-manifest.json`.
- A Cloudflare `_redirects` file inside `dist/` containing every permanent slug alias and the stable-latest dataset redirect.
- Private terminal and rotating file logs under `user/logs/`.

The manifest records the persisted release identity and timestamp, site origin, Entry and Topic Trail counts, represented Methodology versions, generated public routes, export filename, absolute Schema URL, redirects, and a sorted byte-length and SHA-256 inventory of every promoted static file. It is not exposed through a public route.

## Normal Flow

1. The command fixes the public origin to the approved Stage 1 hostname.
2. It runs Astro and TypeScript checks, then the complete Vitest suite. Full test output is saved to ignored `runtime/test-output.txt`.
3. The canonical loader reads records and snapshots. Release construction performs strict production validation and resolves relationships, ordering, counts, routes, aliases, and Changelog events.
4. Export preparation generates the deterministic Dataset `1.0.0` artifact and Schema-facing metadata from that release.
5. If the descriptor is absent, the gate validates a candidate UUIDv7 and UTC timestamp with the release and export before creating the descriptor exclusively. If another process creates it first, the gate loads the winning descriptor and reconstructs the release when its values differ from the candidate.
6. Astro builds into a unique staging directory under `runtime/`. During this build, every page receives the same cached production release model.
7. The gate confirms that canonical records and snapshots remained byte-identical during the build, writes or compares the immutable dataset artifact, and emits `_redirects`.
8. Static verification compares the staged files with the single in-memory release. The manifest is built in memory only after verification succeeds.
9. If a previous manifest uses the same Stage 1 release ID, the immutable dataset hash must match. A different hash at the same immutable path blocks promotion.
10. The gate replaces `dist/` and the internal manifest through one promotion transaction with temporary backups. It removes those backups after both replacements succeed.

The command stops after local promotion. Deployment is a separate workflow.

## Descriptor State and Rebuilds

The descriptor contains one UUIDv7 release ID and one RFC 3339 UTC generation timestamp. The first eligible Stage 1 run creates it with an exclusive filesystem write. Existing bytes are loaded without being rewritten, even when their parsed values are identical to values the command could generate again.

Once created, the descriptor remains valid input for retries and rebuilds. A later build, verification, or promotion failure does not remove it because the persisted identity already names the initial Stage 1 release. Rebuilding uses the exact same ID and timestamp, so filesystem modification time, Git time, and the retry date cannot alter public ordering, artifact names, or exported metadata.

Malformed, unreadable, or schema-invalid descriptor content blocks the release. The gate does not repair, rotate, replace, or silently begin another release. Starting a later release requires a separate descriptor-rotation workflow that is not implemented.

## Static Verification Contract

The verifier checks the staged files rather than assuming a successful Astro process produced a releasable site. It requires:

- The exact Stage 1 HTML and JSON route set, with no future-feature routes.
- The Homepage Latest Entry and recent material-activity order.
- One canonical route for every current Entry.
- Topic Trail route count, displayed Entry count, ordering, and Last Activity.
- Current and immutable Methodology routes and represented versions.
- Changelog event count, order, type, title, date, and destination.
- Export metadata, immutable bytes, Entry count, filename, and Schema reference.
- A parseable strict draft-2020-12 Schema with the canonical `$id`, plus successful dataset validation.
- Exact `301` aliases and the stable-latest `302`, without collisions, chains, or loops.
- Exact Header and Footer destinations on every generated HTML page.
- Valid internal links, assets, canonical URLs, downloads, and fragment targets.
- No private-preview markers, missing-field labels, unresolved diagnostics, or non-promotable content in public HTML or JSON.

The manifest route list excludes fragments, redirects, `404.html`, assets, and the internal manifest. The file inventory still covers every file promoted inside `dist/`, including hosting metadata such as `_headers` and `_redirects`.

## Failure and Recovery Behavior

Any blocking condition returns a non-zero command result. Diagnostics identify the record or filename, field, rule, related relationship, and affected generated surfaces. When release construction or export preparation fails, the private report also states that Schema and export output are unavailable for that attempted release.

Failures before descriptor creation leave no genuine release metadata. Failures after creation preserve the descriptor for the next retry. Failures before promotion leave the previous `dist/` and manifest unchanged. If either resource replacement fails during promotion, the gate removes partially promoted output where possible and restores the validated backups.

The staging directory is removed after success or failure. Release diagnostics remain private in the terminal and ignored log files; they are never copied into public output.

## Interactions With Other VyDex Systems

- [Canonical Records](canonical-records.md) defines stored record shapes and record-local validation. The gate does not widen or repair those values.
- [Publication Revisions](publication-revisions.md) owns immutable Entry history and materiality. The gate consumes the resulting snapshots without creating revisions.
- [Release Construction](release-construction.md) creates the single strict production release used by every verifier.
- [Dataset Generation](dataset-generation.md) creates deterministic Schema and export contracts. The gate writes, verifies, inventories, and promotes their output.
- [Static Application Foundation](static-application-foundation.md) owns Astro configuration, public rendering, and the ordinary development and build commands. The gate invokes that build through an isolated output boundary.
- [Stage 1 Site Shell](stage-1-site-shell.md) owns Header and Footer composition. The gate verifies its destinations on the generated HTML.
- [Stage 1 Export JSON Page](stage-1-export-json-page.md) presents release-derived export metadata. The gate verifies that the page and downloadable bytes describe the same release.

## Internal Edge Cases

- Two first-run processes may generate different candidates. Exclusive descriptor creation selects one persisted value, and the losing process reloads and uses it.
- An existing descriptor is valid state, not a signal to begin a new release. Rebuilds never call the clock or UUID generator for replacement values.
- Canonical data changing while Astro builds invalidates the staged output, even if both versions independently pass validation.
- A byte-identical dataset artifact at the expected path is accepted. Different bytes at that immutable path block the release.
- An invalid previous manifest blocks replacement because the gate cannot prove that the new manifest preserves the existing release contract.
- The active release log plus at most ten predecessors are retained. Terminal color codes are not written to log files.

## Cross-System Edge Cases

- A route can be valid in the release registry but absent from staged output. Static verification treats that disagreement as a release failure rather than excluding the route.
- A page can render successfully while showing the wrong count, ordering, navigation destination, or fragment. The gate verifies those values against the release model after rendering.
- The Schema can parse as JSON but still fail strict compilation, carry the wrong canonical `$id`, or reject the dataset. Each case blocks the whole release.
- A successful local promotion does not mean the hosted site changed. Deployment must consume the promoted output through a later explicit workflow.
- Ordinary `npm run build`, development, and test-mode builds must never create the genuine descriptor or internal manifest.

## Invariants

- The website and JSON export represent the same release model and descriptor.
- The initial Stage 1 release ID and timestamp never rotate during a rebuild.
- No invalid Entry, unresolved relationship, empty Topic Trail, redirect conflict, or inconsistent generated surface is silently omitted.
- The previous successful `dist/` and manifest remain available when validation, generation, verification, or promotion fails.
- A manifest describes only output that completed staged verification.
- Public ordering never depends on filesystem modification time, Git time, or rebuild time.
- Preview diagnostics and private logs never enter public files.
- The release command never deploys.

## Implementation Landmarks

- `scripts/release/` — Thin command-line entry point and process exit behavior.
- `src/release/stage-one-release/` — Release orchestration, diagnostics, redirects, static verification, manifest construction, and promotion.
- `src/adapters/stage-one-release-descriptor/` — Exclusive descriptor creation and immutable reuse.
- `src/adapters/persisted-release-descriptor/` — Read-only production descriptor loading used by page builds.
- `src/shared/release-logger/` — Release-only terminal and rotating file logging.
- `src/adapters/application-release/` — One production release model shared across an atomic Astro build.
- `src/adapters/dataset-artifact-writer/` — Collision-safe immutable dataset emission.
- `tests/features/stage-one-release-*.test.ts` — Gate, manifest, redirect, verifier, and promotion integration coverage.
- `tests/adapters/stage-one-release-descriptor.test.ts` and `tests/adapters/release-logger.test.ts` — Persistence and logging coverage.

## Before Changing the Release Gate

Check:

- Whether the change can rotate or rewrite the existing descriptor.
- Whether the website, Schema, export, redirects, and manifest still use one release model.
- Whether a new public route belongs to Stage 1 or must remain blocked as a future feature.
- Whether every new generated surface is included in verification and the manifest inventory.
- Whether failure at each new write boundary preserves the previous promotable output.
- Whether an adapter still owns filesystem, process, clock, UUID, and logging behavior rather than the domain constructor or UI.
- Whether tests cover first creation, reuse, retries, malformed persisted state, deliberate data failures, and rollback.
- Whether documentation clearly separates local promotion from deployment and later descriptor rotation.
