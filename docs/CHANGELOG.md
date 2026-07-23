# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added

- Added the immutable Dataset `1.0.0` JSON Schema, deterministic release projection, strict Schema validation, stable-latest redirect descriptor, and collision-safe artifact writer.
- Added static Schema publication with Cloudflare response metadata and a frozen-install application validation workflow.
- Added a read-only canonical record loader and deterministic production and preview release models with resolved routes, redirects, and Changelog activity.
- Added deterministic Entry publication revisions with immutable snapshots, materiality checks, validated history ordering, and derived activity dates.
- Added the canonical evidence record model and validation for IDs, relationships, dates, sources, and Markdown safety.
- Added a static Astro application foundation with strict type checking, local fonts, framework-independent domain boundaries, and automated unit, responsive browser, and accessibility checks.

### Changed

- Moved dataset projection out of release construction so exports consume the same completed production release model as other public consumers.

### Fixed

### Removed

### Security

- Pinned Ajv's transitive `fast-uri` parser to patched version `3.1.4`.
- Updated Astro to 7.1.3 to address a reflected cross-site scripting vulnerability in View Transition animation values.
