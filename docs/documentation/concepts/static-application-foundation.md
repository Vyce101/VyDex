---
label: Static Application Foundation
order: 400
---

# Static Application Foundation

The static application foundation defines how VyDex builds pages, separates domain code from Astro, and checks those boundaries. This page is for maintainers and coding agents changing application structure, root tooling, styling, or build behavior.

## Purpose and Ownership

The foundation keeps public output static and prevents product rules from becoming coupled to Astro pages or components.

It owns:

- The root Node and npm project.
- Static Astro configuration and strict TypeScript checking.
- The allowed dependency direction between Astro and `src/domain`.
- Native global CSS, project-owned design tokens, and locally bundled fonts.
- Unit, responsive browser, and accessibility test harnesses.
- The local application launcher and production build command.

It does not own:

- [Canonical record contracts or cross-record validation](canonical-records.md).
- Publication commands, snapshot creation, or revision comparison.
- Material-activity, release, route, canonical URL, or JSON export behavior.
- Cloudflare Pages deployment configuration or the final public origin.
- The separate Retype documentation build and GitHub Pages deployment.

## Normal Flow

1. `npm ci` installs the exact root dependency tree from `package-lock.json`.
2. Astro pages and layouts may import the public domain entry at `src/domain/index.ts`.
3. Domain modules remain framework-independent and cannot import Astro or UI modules.
4. `npm run build` type-checks the project, runs Vitest, and generates static files in `dist/`.
5. `npm run test:browser` rebuilds the site, serves the generated output locally, and runs the Playwright and Axe checks.

The current `/` page is a build fixture, not the Stage 1 homepage or a product interface.

## Interactions With Other Project Areas

The canonical-record domain module defines the data contracts consumed by loaders, [publication revisions](publication-revisions.md), [release construction](release-construction.md), pages, and exports. Publication revisions, material activity, routing, export projection, and release construction remain framework-independent; the foundation provides their dependency boundary and test environment but does not own their behavior.

The application release adapter composes the read-only canonical loader with the framework-independent constructor. It reads `PUBLIC_SITE_ORIGIN` at the application boundary and defaults private preview to `http://localhost:4321`. Astro pages and components must use this shared release entry point rather than parse authoring files directly.

The repository also reserves separate locations for canonical records, publication snapshots, generated release data, and static output. Storage and generation behavior remain separate from the application foundation.

Retype is an independent npm project under `docs/documentation/`. It publishes documentation to GitHub Pages; its base path, dependencies, and output do not apply to the Astro application.

Framework-independent domain modules import Zod from `zod`, never from `astro/zod`.

## Internal Edge Cases

- The domain entry exports canonical records, cross-record validation, publication revisions, material activity, route generation, export projection, and release construction. A placeholder import in the Astro fixture still verifies the allowed dependency direction.
- TypeScript is pinned to `6.0.3` because the pinned Astro checker accepts TypeScript 5 or 6, not TypeScript 7.
- The application base path is `/`, and `.env.example` documents `PUBLIC_SITE_ORIGIN`. No production hostname is hardcoded or selected yet.
- The current fixture does not call strict release construction because the repository has no production canonical content or persisted release descriptor.
- Vitest runs both foundation architecture tests and domain validation tests in a Node environment.

## Cross-System Edge Cases

- The Astro app and Retype docs use independent lockfiles and build commands. Installing or building one must not overwrite the other.
- Canonical records and publication snapshots must not be placed in generated output folders.
- A failed browser test can occur after `dist/` has been generated. The presence of that directory does not mean a release is ready.
- Domain code may use framework-independent packages such as Zod and Markdown parsers, but it must not depend on Astro pages, layouts, or components.
- Environment access belongs to the application adapter. The release constructor accepts an explicit site origin and never reads `process.env` or `import.meta.env`.

## Invariants

- Public application output remains static HTML with no runtime backend.
- Core content must remain readable without browser JavaScript.
- UI code may depend on the domain entry; domain code must not depend on presentation modules.
- Product contracts must come from approved tickets rather than permissive placeholders or inferred fields.
- Source Serif 4 and Source Sans 3 remain build-owned assets with system fallbacks.
- Project commands keep Astro CLI telemetry disabled; the browser has no telemetry, analytics, or persistent client logging.
- Type-checking, tests, and builds preserve non-zero failure results.
- Retype deployment remains separate from the application hosting target.

## Implementation Landmarks

- `astro.config.ts` — Static application configuration.
- `src/domain/` — Framework-independent domain boundary.
- `src/adapters/` — Read-only filesystem loading and application configuration boundaries.
- `src/pages/` and `src/layouts/` — Astro-owned rendering boundary.
- `src/styles/` — Design tokens and global native CSS.
- `tests/foundation/` — Architecture checks.
- `tests/domain/` — Canonical record and validation checks.
- `tests/browser/` — Responsive and accessibility journeys.
- `scripts/dev/setup-and-run.ps1` — Windows setup and launch workflow.

## Before Changing the Foundation

Check:

- Whether a dependency would introduce a UI framework, runtime service, or external content dependency.
- Whether a domain import points toward Astro or another presentation module.
- Whether new browser JavaScript is genuine progressive enhancement.
- Whether a data location mixes canonical, immutable, generated-release, or static-build concerns.
- Whether root tooling changes also require launcher, lockfile, Vitest, or Playwright updates.
- Whether the Retype project is being changed intentionally rather than as a side effect of application work.

See the [Quickstart](https://github.com/Vyce101/VyDex/blob/main/docs/QUICKSTART.md) for the commands used to run and validate the project.
