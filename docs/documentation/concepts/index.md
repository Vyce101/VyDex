---
label: Concepts
---

# Concepts

These pages explain the system contracts that exist in VyDex today. They are written for technical users, maintainers, and coding agents that need enough context to change the implementation without breaking its boundaries.

## Current Systems

- [Canonical Records](canonical-records.md) — Stable record types, validation, relationships, Markdown safety, and diagnostics.
- [Cloudflare Pages Deployment](cloudflare-pages-deployment.md) — Git-integrated previews, gated production publication, rollback support, and hosting boundaries.
- [Dataset Generation](dataset-generation.md) — Public Dataset `1.0.0`, JSON Schema, deterministic serialization, immutable artifact paths, and writer safety.
- [Entry Preview](entry-preview.md) — Typed preview projection, exact record sequence, responsive presentation, and accessibility contract.
- [Frontier Atlas Design System](frontier-atlas-design-system.md) — Shared visual tokens, typography, responsive layouts, components, and accessibility invariants.
- [Publication Revisions](publication-revisions.md) — Immutable Entry snapshots, revision history, materiality rules, and derived activity.
- [Release Construction](release-construction.md) — Read-only loading, strict and preview releases, resolved public data, routes, and Changelog events.
- [Stage 1 About Page](stage-1-about-page.md) — Canonical project identity and limitations, static projection, preview fallback, and responsive ruled presentation.
- [Stage 1 Changelog Page](stage-1-changelog-page.md) — Material release events, uniform timestamp ordering, responsive date grouping, and strict static projection.
- [Stage 1 Entry Page](stage-1-entry-page.md) — Static route generation, complete record projection, responsive presentation, source context, and not-found behavior.
- [Stage 1 Export JSON Page](stage-1-export-json-page.md) — Release-derived metadata, deterministic artifact preparation, immutable downloads, and static responsive presentation.
- [Stage 1 Homepage](stage-1-homepage.md) — Static release selection, latest-material-activity ordering, page composition, and production release loading.
- [Stage 1 Methodology Page](stage-1-methodology-page.md) — Canonical rulebook projection, current and immutable static routes, stable anchors, and Entry help links.
- [Stage 1 Release Gate](stage-1-release-gate.md) — Durable Stage 1 identity, isolated generation, full-surface verification, manifests, and rollback-aware promotion.
- [Stage 1 Site Shell](stage-1-site-shell.md) — Shared page structure, canonical navigation, progressive mobile disclosure, and focus behavior.
- [Stage 1 Topic Trail Page](stage-1-topic-trail-page.md) — Generated trail routes, derived activity metadata, deterministic Entry ordering, and preview failure boundaries.
- [Static Application Foundation](static-application-foundation.md) — Static Astro build, domain separation, Schema publication, and test boundaries.

Concept pages describe current behavior and ownership. Step-by-step user workflows belong in [Guides](../guides.md), and planned capabilities remain identified as future work until their implementation exists.
