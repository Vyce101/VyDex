---
label: Stage 1 Methodology Page
order: 700
permalink: /concepts/stage-1-methodology-page/
---

# Stage 1 Methodology Page

The Stage 1 Methodology Page publishes VyDex's current judgment rules at `/methodology/` and the immutable version used by current Entries at `/methodology/1.0.0/`. It lets readers inspect how public labels and evidence judgments are defined, while each Entry can point to the exact rules used for that record. This page is for maintainers, technical users, and coding agents changing Methodology projection, routing, anchors, canonical metadata, or public rulebook presentation.

## Purpose and Ownership

The feature turns one validated canonical Methodology record into a complete public rulebook. It owns:

- Projection of canonical Methodology content into ordered display records, labels, scores, links, and safe HTML.
- The exact H1, H2, and H3 hierarchy of the public rulebook.
- Stable section IDs and the ordered Jump To index.
- The open reading layout, ruled definition tables, compact version strip, and responsive mobile transformations.
- Static current and immutable version routes for Methodology `1.0.0`.
- Page-level checks that every Jump To destination belongs to the rendered anchor contract.

It does not own:

- Methodology content, definitions, version identity, or effective date. [Canonical Records](../evidence-ledger/canonical-records.md) owns those values.
- Canonical route paths and absolute URLs. Route generation and [Release Construction](../release-lifecycle/release-construction.md) own them.
- Entry assessment data or the Methodology version assigned to an Entry.
- Shared Header, Footer, focus tokens, typography, colors, or generic table behavior.
- Runtime fetching, client recovery, analytics, or logging.

## Inputs and Output Contract

The feature accepts one `ResolvedMethodology` from the application release boundary. That value contains the validated canonical Methodology record plus its current and version-specific absolute URLs.

`createMethodologyPageViewModel` maps exhaustive controlled values through their approved public labels and preserves their canonical order. It derives Evidence Strength scores from the domain-owned score map and renders Methodology Markdown through the shared safe renderer. The projection does not rewrite definitions or infer missing content.

`MethodologyPage.astro` renders the projected model as static semantic HTML. Both routes use this component and therefore produce identical substantive page content. The surrounding layout supplies a different canonical link for each route.

## Static Route Flow

1. Each thin Astro route loads the configured application release.
2. Development and test builds use fixed non-production metadata; production uses the persisted release descriptor.
3. `/methodology/` passes the resolved Methodology to the shared page and canonicalizes to the current URL.
4. The version route generates one static path from the resolved public version and canonicalizes to its own immutable URL.
5. The shared projection validates the Methodology record and anchor contract before rendering.
6. Astro writes the complete rulebook into static HTML. The browser does not fetch Methodology content at runtime.

Stage 1 generates no other Methodology versions. An unregistered version such as `/methodology/2.0.0/` falls through to the generic static 404 page.

## Rulebook Structure

The page has one H1, `Methodology`. Its main sections appear in this order:

1. Inclusion Rule.
2. Jump To.
3. Inclusion Standard.
4. Claim Appraisal.
5. Public Labels.
6. Entry Fields.
7. Sources and Evidence Types.
8. Dates and Evidence Monitoring.
9. Topic Trails and Domains.
10. Entry Titles.
11. Versioning.

Canonical structured fields own lists, examples, definitions, and table rows. Markdown leaves supply prose inside that structure; they cannot introduce competing headings, lists, or tables.

The version strip displays `v1.0.0`, the exact effective date, the Major version type, and the rule that Entry pages link to the Methodology version used by the record. The version label links to the immutable route from both pages.

## Stable Anchors and Entry Help Links

The shared Methodology navigation contract owns section fragments used by the Jump To index and the Entry Page. Jump To links target visible sections in the same document. Entry help links use the resolved version-specific Methodology URL, never the mutable current route.

The Entry Page links these explanatory labels:

- `Domain` to `#domains`.
- `Topic Trail` to `#topic-trails`.
- `Evidence Type` to `#evidence-types`.
- `Used For` to `#used-for`.
- `Source Role` to `#source-roles`.
- `Potential Significance If Confirmed` to `#significance`.
- `Review Reason` to `#review-status`.

Only the label becomes Methodology help. Domain values remain text, and Topic Trail names retain their links to the generated [Stage 1 Topic Trail pages](./stage-1-topic-trail-page.md). This keeps explanatory navigation separate from record relationships.

## User-Facing Behavior

Methodology is the active Header destination on both routes. Latest continues to link to `/#latest`.

The page uses open reading sections rather than a card around every section. Prose stays near the shared reading measure, while indexes and definition tables can use the wider page grid. Public labels remain visible in normal flow without tabs, accordions, tooltips, or a sticky sidebar.

Essential tables use real column headers. Each body cell also carries its column label so mobile layouts can convert rows into stacked ruled records without horizontal scrolling. Evidence Strength scores remain ordinary table data rather than ratings or progress indicators.

Anchor links use the global visible focus treatment. Anchored sections include scroll spacing so direct navigation does not place headings tightly against the viewport edge.

## Failure Behavior

Canonical validation and release construction block the build when the Methodology record, effective date, named content sections, or exhaustive Evidence Type definitions are incomplete.

The page projection also rejects duplicate section IDs or a Jump To destination absent from the declared rendered-section contract. Browser tests verify that the declared IDs are present in the final HTML on both routes. Failures use normal thrown build errors and test output; the feature adds no recovery UI or logging layer.

## Internal Edge Cases

- Current and immutable routes intentionally render the same substantive content during Stage 1. Only their pathname and canonical metadata differ.
- The canonical record may contain safe emphasis, links, or inline code across multiple paragraphs. The shared Methodology renderer escapes HTML and rejects unsupported structures or unsafe URLs.
- Claim Status rows use text to name the UI treatment. Failed / Retracted may use the approved red accent, but no row relies on color alone.
- Review Reason uses the protected canonical sentence. Presentation code must not merge alternate ticket wording into that definition.
- Domain, Evidence Type, Source Role, status, state, and version rows follow exhaustive domain-owned ordering rather than object enumeration chosen by the component.
- Browser Find reaches every core definition because the page does not defer or hide content.

## Cross-System Edge Cases

- [Release Construction](../release-lifecycle/release-construction.md) supplies one validated Methodology and both canonical URLs. The page must not parse authoring files or construct route URLs itself.
- [Stage 1 Entry Page](./stage-1-entry-page.md) uses the shared anchor contract and its resolved immutable Methodology URL. It must not hardcode `1.0.0` into help links.
- [Stage 1 Site Shell](./stage-1-site-shell.md) derives the active Methodology state from the pathname and owns document order.
- [Frontier Atlas](./frontier-atlas-design-system.md) owns responsive table behavior, typography, colors, focus, and page measurements. The Methodology feature owns only their rulebook composition.
- [Static Application Foundation](../static-application-foundation.md) owns the build mode, application release boundary, canonical-link layout interface, and browser-test harness.
- The current route may change in a later Methodology release, but an immutable version route must continue to render the content and canonical URL for that exact version.

## Invariants

- One canonical Methodology record is the source for both Stage 1 routes.
- Both routes contain the same visible rulebook content.
- The exact-version route canonicalizes to itself.
- Entry help links use the exact Methodology version assigned to the Entry.
- Every Jump To link resolves to one visible section with a stable explicit ID.
- Every public definition remains visible in normal document flow.
- Evidence Strength is support for the stated claim, not importance, confidence, probability, or rank.
- The page contains exactly one H1 and preserves the approved H2 and H3 hierarchy.
- Core content remains readable without browser JavaScript.
- Rendering performs no runtime fetching, logging, telemetry, or persistent writes.

## Implementation Landmarks

- `src/features/methodology-page/` — Methodology projection, page composition, and feature-owned responsive styles.
- `src/pages/methodology/` — Thin current and immutable Astro routes.
- `src/shared/methodology-navigation/` — Stable section IDs and immutable fragment-link construction.
- `src/shared/canonical-markdown/` — Safe Markdown rendering shared by canonical presentation profiles.
- `src/layouts/FoundationLayout.astro` — Optional canonical-link output and shared document shell.
- `tests/features/` and `tests/browser/methodology-page.spec.ts` — Projection, route, anchor, responsive, no-JavaScript, and accessibility coverage.

## Before Changing the Methodology Page

Check:

- Whether every displayed definition still comes from the validated canonical record.
- Whether current and immutable routes still share one component and substantive model.
- Whether each route receives the correct self-canonical URL.
- Whether every Jump To and Entry help fragment still resolves on both routes.
- Whether Entry help links still use the resolved version-specific base URL while record values keep their own behavior.
- Whether exhaustive controlled rows retain canonical order, labels, and scores.
- Whether mobile tables retain every column label without horizontal scrolling.
- Whether headings, focus, scroll spacing, no-JavaScript reading, and Browser Find behavior remain accessible.
- Whether tests cover missing content, missing targets, route identity, and the absence of fake versions or runtime fetching.

Read [Canonical Records](../evidence-ledger/canonical-records.md) before changing Methodology content or validation, and [Release Construction](../release-lifecycle/release-construction.md) before changing resolved URLs or release selection.
