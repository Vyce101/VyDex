---
label: Stage 1 Release Gate
order: 1400
---

# Stage 1 Release Gate

The Stage 1 release gate turns one validated VyDex release into verified static output. It is the only workflow allowed to create the initial production descriptor, and it promotes output only after the website, Schema, export, redirects, browser checks, and manifest agree. This page is for maintainers and coding agents changing release orchestration, generated output, validation, or persistence behavior.

## Purpose and Ownership

The gate prevents a partially valid or internally inconsistent build from replacing the previous promotable output.

It owns:

- The `npm run release:stage-1` production release command.
- Validation of the required `PUBLIC_SITE_ORIGIN` before release construction.
- Exclusive creation and immutable reuse of the initial Stage 1 release descriptor.
- Strict existing-release mode for clean runners and CI.
- Type-check and complete Vitest execution before production generation.
- Isolated Astro staging under ignored `runtime/` storage.
- Static-output, link, count, Schema, export, redirect, and navigation verification.
- Playwright journeys and accessibility checks against the exact staged output through a local Wrangler Pages server.
- The internal release manifest and promoted-file inventory.
- Rollback-aware promotion of the verified static output and manifest.
- Human-readable terminal diagnostics, complete browser-test output, and private rotating release logs.

It does not own:

- Authoring canonical records or publication snapshots.
- Deciding whether a record or relationship is valid. [Release Construction](release-construction.md) owns those rules.
- Defining the Dataset `1.0.0` contract or JSON Schema. [Dataset Generation](dataset-generation.md) owns those contracts.
- Creating a later release descriptor or rotating the Stage 1 descriptor.
- Deploying to Cloudflare Pages or changing the hosted production site. [Cloudflare Pages Deployment](cloudflare-pages-deployment.md) owns publication.
- Proving that Cloudflare serves the promoted routes, headers, redirects, bytes, accessibility behavior, or no-JavaScript journeys. [Hosted Release Verification](hosted-release-verification.md) owns that post-deployment contract.
- Rendering a public preview, manifest route, diagnostics page, or client-side recovery state.

## Inputs and Outputs

The gate reads the repository-controlled canonical records and Entry snapshots, the configured production origin, the existing release descriptor and manifest, and the release, artifact, Schema, route, and redirect contracts produced by the existing domain and adapter boundaries. Bootstrap mode may begin without release state; strict existing-release mode requires both files before validation starts.

A successful run produces:

- A durable descriptor at `generated/release-data/release.json` when the explicitly selected bootstrap path creates the initial identity.
- A complete verified static site at `dist/`.
- An internal manifest at `generated/release-data/release-manifest.json`.
- A Cloudflare `_redirects` file inside `dist/` containing every permanent slug alias and the stable-latest dataset redirect.
- Complete Playwright output at ignored `runtime/browser-test-output.txt`.
- Private terminal and rotating file logs under `user/logs/`.

The manifest records the persisted release identity and timestamp, site origin, Entry and Topic Trail counts, represented Methodology versions, generated public routes, export filename, absolute Schema URL, redirects, and a sorted byte-length and SHA-256 inventory of every promoted static file. It is not exposed through a public route.

## Normal Flow

1. The command validates `PUBLIC_SITE_ORIGIN` as a root-only absolute HTTPS origin. The current committed release requires `https://vydex.pages.dev`.
2. It runs Astro and TypeScript checks, then the complete Vitest suite. Full test output is saved to ignored `runtime/test-output.txt`.
3. The canonical loader reads records and snapshots. Release construction performs strict production validation and resolves relationships, ordering, counts, routes, aliases, and Changelog events.
4. Export preparation generates the deterministic Dataset `1.0.0` artifact and Schema-facing metadata from that release.
5. Bootstrap mode may validate a candidate UUIDv7 and UTC timestamp before creating the initial descriptor exclusively. Strict existing-release mode instead requires the committed descriptor and manifest, verifies their shared release identity and origin, and never calls the clock or UUID generator.
6. Astro builds into a unique staging directory under `runtime/`. During this build, every page receives the same cached production release model.
7. The gate confirms that canonical records and snapshots remained byte-identical during the build, writes or compares the immutable dataset artifact, and emits `_redirects`.
8. Static verification compares the staged files with the single in-memory release.
9. The gate serves that exact staging directory with the pinned Wrangler Pages server and runs the shared Playwright journeys, route checks, responsive assertions, keyboard interactions, no-JavaScript paths, reduced-motion checks, downloads, and Axe scans. Complete output is written to `runtime/browser-test-output.txt`.
10. The manifest is built in memory only after static and browser verification succeed.
11. Bootstrap mode protects an existing immutable dataset hash. Strict mode requires the regenerated manifest and complete file inventory to match the committed manifest exactly.
12. The gate replaces `dist/` and the internal manifest through one promotion transaction with temporary backups. It removes those backups after both replacements succeed.

The command stops after local promotion. Deployment and verification of the real production origin are separate workflows. A successful local gate is required for publication, but it does not prove which Cloudflare deployment is canonical or what the production origin serves.

## Descriptor State and Rebuilds

The descriptor contains one UUIDv7 release ID and one RFC 3339 UTC generation timestamp. The one-time authoritative bootstrap run creates it with an exclusive filesystem write. Existing bytes are loaded without being rewritten, even when their parsed values are identical to values the command could generate again.

Once created, the descriptor remains valid input for retries and rebuilds. A later build, verification, or promotion failure does not remove it because the persisted identity already names the initial Stage 1 release. Rebuilding uses the exact same ID and timestamp, so filesystem modification time, Git time, and the retry date cannot alter public ordering, artifact names, or exported metadata.

Malformed, unreadable, or schema-invalid descriptor content blocks the release. Strict mode also blocks a missing or malformed manifest, a descriptor-manifest identity mismatch, an origin mismatch, or any regenerated manifest difference. The gate does not repair, rotate, replace, or silently begin another release. Starting a later release requires a separate descriptor-rotation workflow that is not implemented.

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

Failures before bootstrap descriptor creation leave no genuine release metadata. Failures after creation preserve the descriptor for the next retry. Strict mode never creates release state on failure or success. A Wrangler startup failure or non-zero Playwright result emits a blocking browser diagnostic and leaves the previous `dist/` and manifest unchanged. If either resource replacement fails during promotion, the gate removes partially promoted output where possible and restores the validated backups.

The staging directory is removed after success or failure. Browser output, Wrangler state, and release diagnostics remain private in ignored runtime or log locations; they are never copied into public output.

## Interactions With Other VyDex Systems

- [Canonical Records](canonical-records.md) defines stored record shapes and record-local validation. The gate does not widen or repair those values.
- [Publication Revisions](publication-revisions.md) owns immutable Entry history and materiality. The gate consumes the resulting snapshots without creating revisions.
- [Release Construction](release-construction.md) creates the single strict production release used by every verifier.
- [Dataset Generation](dataset-generation.md) creates deterministic Schema and export contracts. The gate writes, verifies, inventories, and promotes their output.
- [Static Application Foundation](static-application-foundation.md) owns Astro configuration, public rendering, and the ordinary development and build commands. The gate invokes that build through an isolated output boundary.
- [Cloudflare Pages Deployment](cloudflare-pages-deployment.md) consumes only output that strict release mode reproduced and verified against committed release state.
- [Hosted Release Verification](hosted-release-verification.md) reloads the same committed state after deployment and compares it with the live production surface. It does not change the gate's manifest or `dist/`.
- [Stage 1 Site Shell](stage-1-site-shell.md) owns Header and Footer composition. The gate verifies its destinations on the generated HTML.
- [Stage 1 Export JSON Page](stage-1-export-json-page.md) presents release-derived export metadata. The gate verifies that the page and downloadable bytes describe the same release.

## Internal Edge Cases

- Two first-run processes may generate different candidates. Exclusive descriptor creation selects one persisted value, and the losing process reloads and uses it.
- An existing descriptor is valid state, not a signal to begin a new release. Rebuilds never call the clock or UUID generator for replacement values.
- Canonical data changing while Astro builds invalidates the staged output, even if both versions independently pass validation.
- A byte-identical dataset artifact at the expected path is accepted. Different bytes at that immutable path block the release.
- An invalid previous manifest blocks replacement because the gate cannot prove that the new manifest preserves the existing release contract.
- A CI environment that requests bootstrap mode fails before release construction. CI must use `npm run release:stage-1:ci`.
- Strict mode treats an added, missing, renamed, or byte-changed generated file as a release mismatch even when every page still renders.
- The active release log plus at most ten predecessors are retained. Terminal color codes are not written to log files.

## Cross-System Edge Cases

- A route can be valid in the release registry but absent from staged output. Static verification treats that disagreement as a release failure rather than excluding the route.
- A page can render successfully while showing the wrong count, ordering, navigation destination, or fragment. The gate verifies those values against the release model after rendering.
- The Schema can parse as JSON but still fail strict compilation, carry the wrong canonical `$id`, or reject the dataset. Each case blocks the whole release.
- A successful local promotion does not mean the hosted site changed. The deployment workflow must consume the exact validated artifact rather than rebuilding it independently.
- A successful production upload does not prove hosted correctness. The hosted verifier must confirm Cloudflare routes, redirects, response metadata, artifact bytes, and browser behavior after the deployment becomes canonical.
- A valid release model with the wrong configured origin is not deployable because its canonical URLs would disagree with the committed manifest.
- Ordinary `npm run build`, development, and test-mode builds must never create the genuine descriptor or internal manifest.

## Invariants

- The website and JSON export represent the same release model and descriptor.
- The initial Stage 1 release ID and timestamp never rotate during a rebuild.
- CI requires committed descriptor and manifest state and never creates release identity.
- The configured production origin exactly matches the origin recorded in the committed manifest.
- No invalid Entry, unresolved relationship, empty Topic Trail, redirect conflict, or inconsistent generated surface is silently omitted.
- The previous successful `dist/` and manifest remain available when validation, generation, verification, or promotion fails.
- A manifest describes only output that completed staged verification.
- Public ordering never depends on filesystem modification time, Git time, or rebuild time.
- Preview diagnostics and private logs never enter public files.
- The release command never deploys.
- Hosted deployment IDs and rollback state never change the persisted Release ID or local manifest.

## Implementation Landmarks

- `src/release/stage-one-hosted-verification/` - Separate post-deployment verification that consumes the gate's committed expected state.
- `scripts/release/` — Thin command-line entry point and process exit behavior.
- `src/release/stage-one-release/` — Release orchestration, diagnostics, redirects, static verification, manifest construction, and promotion.
- `src/adapters/stage-one-release-descriptor/` — Exclusive descriptor creation and immutable reuse.
- `src/adapters/persisted-release-descriptor/` — Read-only production descriptor loading used by page builds.
- `src/adapters/public-site-origin/` — Required production-origin validation.
- `src/adapters/npm-command-runner/` — Cross-platform npm subprocess execution with captured output.
- `src/shared/release-logger/` — Release-only terminal and rotating file logging.
- `scripts/test/run-stage-one-browser-checks.ts` — Release-owned Wrangler lifecycle and Playwright invocation against an explicit staged directory.
- `playwright.config.ts`, `playwright.release.config.ts`, and `tests/browser/playwright-config.ts` — Ordinary and release-specific entry points over one shared browser-test configuration.
- `src/adapters/application-release/` — One production release model shared across an atomic Astro build.
- `src/adapters/dataset-artifact-writer/` — Collision-safe immutable dataset emission.
- `tests/features/stage-one-release-*.test.ts` — Gate, manifest, redirect, verifier, and promotion integration coverage.
- `tests/browser/stage-one-*.spec.ts` — Cross-page journeys, Stage 1 route boundaries, semantics, accessibility, responsive behavior, no-JavaScript operation, and reduced motion.
- `tests/adapters/stage-one-release-descriptor.test.ts` and `tests/adapters/release-logger.test.ts` — Persistence and logging coverage.

## Before Changing the Release Gate

Check:

- Whether the change can rotate or rewrite the existing descriptor.
- Whether strict mode still rejects missing committed state, identity disagreement, origin mismatch, and regenerated output differences.
- Whether the website, Schema, export, redirects, and manifest still use one release model.
- Whether a new public route belongs to Stage 1 or must remain blocked as a future feature.
- Whether every new generated surface is included in verification and the manifest inventory.
- Whether failure at each new write boundary preserves the previous promotable output.
- Whether browser checks still target the exact staged directory, retain complete ignored output, and run before manifest creation or promotion.
- Whether an adapter still owns filesystem, process, clock, UUID, and logging behavior rather than the domain constructor or UI.
- Whether tests cover first creation, reuse, retries, malformed persisted state, deliberate data failures, and rollback.
- Whether documentation clearly separates local promotion from deployment and later descriptor rotation.
