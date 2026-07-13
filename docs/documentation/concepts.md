---
label: Concepts
---

# Static Application Foundation

The static application foundation defines how VyDex builds pages, separates domain code from Astro, and checks those boundaries. Technical users, maintainers, and coding agents should read this before changing application structure or root tooling.

## Purpose and ownership

The foundation keeps public output static and prevents product rules from becoming coupled to Astro pages or components.

It owns:

- The root Node and npm project.
- Static Astro configuration and strict TypeScript checking.
- The allowed dependency direction between Astro and `src/domain`.
- Native global CSS, project-owned design tokens, and locally bundled fonts.
- Foundation unit, responsive browser, and accessibility test harnesses.
- The local application launcher and production build command.

It does not own:

- Canonical record fields or schemas.
- Cross-record product validation.
- Publication revisions or immutable snapshot rules.
- Material-activity, release, route, canonical URL, or JSON export contracts.
- Cloudflare Pages deployment configuration or the final public origin.
- The separate Retype documentation build and GitHub Pages deployment.

## Normal flow

1. `npm ci` installs the exact root dependency tree from `package-lock.json`.
2. Astro pages and layouts may import the public domain entry at `src/domain/index.ts`.
3. Domain modules remain framework-independent and cannot import Astro or UI modules.
4. `npm run build` type-checks the project, runs Vitest, and generates static files in `dist/`.
5. `npm run test:browser` rebuilds the site, serves the generated output locally, and runs the Playwright and Axe checks.

The current `/` page is only a build fixture. It is not the Stage 1 homepage or a product interface.

## Interactions with other project areas

The repository reserves separate locations for canonical records, publication snapshots, generated release data, and static output. Later tickets will define the formats and lifecycle rules for the first three.

Retype is a separate npm project under `docs/documentation/`. It publishes documentation to GitHub Pages; its base path, dependencies, and output do not apply to the Astro application.

Zod is installed for future domain contracts. Framework-independent modules import it from `zod`, not `astro/zod`.

## Current edge cases

### Internal

- The domain barrels are intentionally empty. Adding permissive placeholder schemas or synthetic records would falsely define contracts that do not exist.
- TypeScript is pinned to `6.0.3` because the pinned Astro checker accepts TypeScript 5 or 6, not TypeScript 7.
- The application base path is `/`, but no `site` or `PUBLIC_SITE_ORIGIN` value exists yet.

### Cross-system

- The Astro app and Retype docs use independent lockfiles and build commands. Installing or building one must not overwrite the other.
- Future canonical records and publication snapshots must not be placed in generated output folders.
- A failed browser test can occur after `dist/` has been generated. Release promotion is not defined by this foundation and must not be inferred from the presence of that directory.

## Invariants

- Public application output remains static HTML with no runtime backend.
- Core content must remain readable without browser JavaScript.
- UI code may depend on the domain entry; domain code must not depend on Astro pages, layouts, or components.
- No domain fields, validation, revisions, releases, routes, or exports are invented before their contracts are supplied.
- Source Serif 4 and Source Sans 3 remain build-owned assets with system fallbacks.
- Project commands keep Astro CLI telemetry disabled; the browser has no telemetry, analytics, or persistent client logging.
- Type-checking, tests, and builds preserve non-zero failure results.
- Retype deployment remains separate from the application hosting target.

## Implementation landmarks

- `astro.config.ts` — static application configuration.
- `src/domain/` — framework-independent domain boundary.
- `src/pages/` and `src/layouts/` — Astro-owned rendering boundary.
- `src/styles/` — design tokens and global native CSS.
- `tests/foundation/` — architecture checks.
- `tests/browser/` — responsive and accessibility journeys.
- `scripts/dev/setup-and-run.ps1` — Windows setup and launch workflow.

## Before changing the foundation

Before editing this boundary, check:

- Whether a proposed dependency would introduce a UI framework, runtime service, or external content dependency.
- Whether a domain import points toward Astro or another presentation module.
- Whether new browser JavaScript is genuine progressive enhancement.
- Whether a new data location mixes canonical, immutable, generated-release, or static-build concerns.
- Whether root tooling changes also require launcher, lockfile, Vitest, or Playwright updates.
- Whether the Retype project is being changed intentionally rather than as a side effect of application work.

See the [Quickstart](https://github.com/Vyce101/VyDex/blob/main/docs/QUICKSTART.md) for commands used to run and validate the foundation.
