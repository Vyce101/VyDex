# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added

- Added the static material Changelog page with exact-date grouping, a ruled Change Type Key, deterministic release ordering, validated affected-record links, responsive date-rail composition, and accessible no-JavaScript rendering.
- Added the static About and Scope Limits page with canonical project identity, maintainer profile links, explicit coverage limits, responsive ruled layouts, and release-blocking content validation.
- Added current and immutable Methodology pages with the complete canonical `1.0.0` rulebook, stable section anchors, responsive definition records, route-specific canonical links, and accessible no-JavaScript rendering.
- Added complete static public Entry pages for every current Main Entry, including the exact maintained-record hierarchy, responsive Frontier Delta, source context, canonical relationship links, and accessible no-JavaScript rendering.
- Added a generic static not-found page that preserves genuine HTTP `404` responses for unknown Entry slugs.
- Added the static Stage 1 Homepage with release-selected Latest Update and Recent Entries, responsive Frontier Atlas composition, canonical actions, and the Claim, Evidence, and Caveat reading band.
- Added read-only production loading for the durable `generated/release-data/release.json` descriptor and deterministic fixed-metadata adapters for development and tests.
- Added a reusable responsive Entry preview that presents its Domain, update date, claim, statuses, Topic Trail, and accessible Entry links consistently across list contexts.
- Added the shared Stage 1 site shell with canonical navigation, responsive Header and Footer components, a no-JavaScript mobile menu, skip navigation, route-derived active states, and keyboard accessibility checks.
- Added the light-only Frontier Atlas design system with shared responsive typography, layouts, controls, claim statuses, tables, and accessibility checks.
- Added the real Stage 1 seed ledger with three Entries, Topic Trails, and immutable initial publication snapshots.
- Added the complete canonical About record with approved maintainer profile links and release-blocking validation coverage.
- Added the complete canonical Methodology `1.0.0` record and its Stage 1 publication event.
- Added the immutable Dataset `1.0.0` JSON Schema, deterministic release projection, strict Schema validation, stable-latest redirect descriptor, and collision-safe artifact writer.
- Added static Schema publication with Cloudflare response metadata and a frozen-install application validation workflow.
- Added a read-only canonical record loader and deterministic production and preview release models with resolved routes, redirects, and Changelog activity.
- Added deterministic Entry publication revisions with immutable snapshots, materiality checks, validated history ordering, and derived activity dates.
- Added the canonical evidence record model and validation for IDs, relationships, dates, sources, and Markdown safety.
- Added a static Astro application foundation with strict type checking, local fonts, framework-independent domain boundaries, and automated unit, responsive browser, and accessibility checks.

### Changed

- Required exact RFC 3339 UTC timestamps for Methodology publication events, separated publication ordering from Methodology effective dates, and unified all public Changelog events on timestamp, type, title, and immutable-identity ordering.
- Linked Entry Page field labels to the matching anchored definition on the immutable Methodology version used by each Entry.
- Centralized public source ordering in the domain layer so release resolution, Entry pages, and Dataset generation share the same evidence-role and title ordering without mutating stored records.
- Moved validated Entry Markdown rendering into a shared presentation module used by Entry previews and full Entry pages.
- Published Dreamer 4 revision 2 as a material review update with Review Status `Stable` and a July 25, 2026 last-checked date.
- Replaced title-based Entry ordering with a shared comparator using latest material activity, Date Added, and immutable Entry ID.
- Changed CI and browser validation to use the explicit fixed-metadata test build while keeping normal production builds descriptor-gated.
- Moved dataset projection out of release construction so exports consume the same completed production release model as other public consumers.

### Fixed

- Fixed the Frontier Delta directional connector and aligned public Entry sections to one full-width maintained-record layout across supported viewports.

### Removed

### Security

- Pinned Ajv's transitive `fast-uri` parser to patched version `3.1.4`.
- Updated Astro to 7.1.3 to address a reflected cross-site scripting vulnerability in View Transition animation values.
