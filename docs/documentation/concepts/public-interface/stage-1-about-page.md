---
label: Stage 1 About Page
order: 800
permalink: /concepts/stage-1-about-page/
---

# Stage 1 About Page

The Stage 1 About Page publishes VyDex's project identity, maintainer information, coverage limits, and related public destinations at `/about/`. It gives readers one place to understand what the ledger covers and where its limits are before they interpret individual Entries. This page is for maintainers, technical users, and coding agents changing About content projection, static routing, preview behavior, or responsive presentation.

## Purpose and Ownership

The feature turns one validated canonical About record into the complete public About and Scope Limits page. It owns:

- Projection of canonical prose into safe HTML and ordered display structures.
- The page's heading hierarchy and exact section order.
- Linking the stored maintainer name and public alias to their validated profile URLs.
- The open editorial composition, action arrangement, ruled Scope Limit rows, carefulness band, and Related Links list.
- The private-preview presentation fallback used when no valid About record can be resolved.

It does not own:

- Project identity copy, maintainer details, Scope Limit explanations, Coverage Baseline prose, or Related Link descriptions. [Canonical Records](../evidence-ledger/canonical-records.md) owns those values.
- Production completeness or release promotion. [Release Construction](../release-lifecycle/release-construction.md) validates the About record and blocks incomplete releases.
- Shared Header, Footer, navigation, route paths, canonical origins, typography, colors, focus treatment, or page width.
- Methodology definitions, Changelog items, export behavior, or the content behind Related Links.
- Runtime fetching, loading states, client recovery, logging, telemetry, or analytics.

## Inputs and Output Contract

The production presentation input requires one `ResolvedAboutRecord` from the application release boundary. It contains the validated canonical record and release-resolved absolute destinations for Methodology, Changelog, and Export JSON.

`createAboutPagePresentationModel` converts that record into ordered prose, Scope Limit rows, carefulness cells, actions, and Related Links. Canonical paragraph fields pass through the shared safe Markdown renderer. The feature supplies only the ticket-owned page title, section headings, row labels, action labels, and route choices; it does not duplicate canonical explanatory copy in the Astro component.

Private-preview input may omit the resolved About record. In that case, the model contains only `Maintainer details not added yet.` Production input cannot select this state.

`AboutPage.astro` renders the completed model as static semantic HTML. `FoundationLayout.astro` supplies the document shell and canonical link.

## Static Route Flow

1. The thin `/about/` route selects the configured application release source for the current Astro mode.
2. Development and test builds use fixed non-production release metadata; production reads the persisted release descriptor.
3. Release construction validates the canonical About record and resolves its Related Link destinations.
4. The route derives the page's self-canonical URL from the validated site origin and registered About path.
5. The presentation model renders canonical prose and maps the fixed Scope Limit, carefulness, and Related Link order.
6. Astro writes the complete page into static HTML. The browser does not fetch About content or choose a fallback at runtime.

## Maintainer Identity Links

The canonical maintainer line remains the source of the visible sentence. During projection, the feature checks that the stored maintainer name and public alias each appear once and in that order. It then inserts the validated LinkedIn and GitHub URLs and passes the result through the safe Markdown renderer.

This check prevents the page from silently linking the wrong text if the structured maintainer fields and sentence drift apart. A mismatch throws a normal build error; the projection does not rewrite the sentence or invent replacement identity text.

## User-Facing Structure

The page has one H1, `About VyDex`. Its major sections use H2 headings in this order:

1. What VyDex Is.
2. Why VyDex Exists.
3. Who Runs VyDex.
4. Scope Limits.
5. Coverage Baseline.
6. How VyDex Stays Careful.
7. Related Links.

About is the active Header destination, while Latest continues to link to `/#latest`. The Header actions link to Latest Entries and the current Methodology. Profile names link to the approved LinkedIn and GitHub profiles. Related Links use the absolute destinations resolved by release construction.

Prose stays within the shared reading measure. Maintainer information, the five Scope Limit rows, the carefulness band, and Related Links can use the wider page width without wrapping every section in a card. On mobile, actions become full width and the carefulness cells form one vertical ruled band. At the shared tablet breakpoint, actions can sit inline and the cells form one horizontal three-column band.

The page contains no search, contact form, portrait, biography card, status definitions, runtime controls, or page-specific illustration. Scope Limits and dividers remain understandable without relying on color, and the layout must not create horizontal scrolling.

## Failure Behavior

Production release construction requires one complete About record. Missing profile URLs, the maintainer line, any required Scope Limit, or another schema-required field produces blocking diagnostics and no production release. The public route therefore never receives partial About content and does not render an error state.

Private preview remains non-promotable when the About record is incomplete. Its unresolved About value cannot feed the complete page model, but a preview presentation may show `Maintainer details not added yet.` That text is presentation-only and is never inserted into canonical records or a production release.

Normal validation, build, and test failures are the observability boundary. The feature adds no browser logs, application logger, persistent log files, or success messages for ordinary rendering.

## Internal Edge Cases

- Scope Limit rows use a fixed projection order rather than object enumeration: Curated, Not Exhaustive; English-Language Bias; Verification Varies by Domain; AI-Heavy Coverage; and Evidence Can Change.
- Coverage Baseline remains a separate three-paragraph section even though its source data is nested under `scope_limits`.
- The carefulness band always contains Methodology, Sources, and Updates in that order, with one Methodology link after the completed band rather than one link per cell.
- Canonical About Markdown may contain safe emphasis, links, or inline code. The shared renderer escapes HTML and rejects unsupported structures or unsafe URLs.
- The private-preview fallback is selected only when the preview input has no resolved About record. It is not a general empty state and cannot be passed as production content.

## Cross-System Edge Cases

- [Canonical Records](../evidence-ledger/canonical-records.md) owns the singleton About shape and safe prose profiles. The page must not parse the authoring JSON or weaken its schemas.
- [Release Construction](../release-lifecycle/release-construction.md) owns production completeness, preview promotability, the site origin, route registry, and absolute Related Link URLs. The page must not repair invalid content or reconstruct those Related Link destinations.
- [Stage 1 Site Shell](./stage-1-site-shell.md) owns Header, Main, Footer, active navigation, skip navigation, and document metadata output. The feature provides only main content and its route-owned canonical URL.
- [Frontier Atlas](./frontier-atlas-design-system.md) owns the reading measure, spacing, colors, typography, buttons, rules, focus treatment, and responsive breakpoint. About CSS composes those primitives without adding local substitute tokens.
- [Static Application Foundation](../static-application-foundation.md) owns Astro mode selection, application release loading, static generation, and the test harness.
- Methodology, Changelog, and the [Export JSON Page](./stage-1-export-json-page.md) remain separate destination features. The About page describes and links to them without taking ownership of their content or behavior.

## Invariants

- The validated canonical About record is the only source for public project identity, maintainer prose, limitations, Coverage Baseline, carefulness explanations, and Related Link descriptions.
- Production never renders an incomplete or preview-fallback About page.
- The page contains exactly one H1 and preserves the approved H2 section order.
- The five Scope Limit rows, three carefulness cells, and three Related Links remain complete and ordered.
- Profile names use the validated structured profile URLs without re-authoring the maintainer sentence.
- Related Link destinations come from the resolved release model.
- About owns project identity and limitations; Methodology continues to own judgment rules.
- Core content remains readable without browser JavaScript, color, imagery, or horizontal scrolling.
- Rendering performs no runtime fetching, logging, telemetry, analytics, or persistent writes.

## Implementation Landmarks

- `src/features/about-page/` — About projection, static page composition, and feature-owned responsive styles.
- `src/pages/about/` — Thin Astro route and self-canonical URL integration.
- `src/shared/canonical-markdown/` — Safe canonical prose rendering.
- `src/adapters/application-release/` — Production and fixed-metadata application release sources.
- `tests/features/about-page.test.ts` and `tests/browser/about-page.spec.ts` — Projection, preview, route, responsive, keyboard, overflow, static-rendering, and accessibility coverage.
- `tests/adapters/canonical-about-content.test.ts` — Exact canonical content and blocking missing-field diagnostics.

## Before Changing the About Page

Check:

- Whether every explanatory sentence still comes from the validated canonical About record.
- Whether maintainer profile text still matches the structured identity fields exactly once and in order.
- Whether all five Scope Limits, three Coverage Baseline paragraphs, three carefulness cells, and three Related Links remain present and ordered.
- Whether Related Links still use release-resolved destinations while actions use the registered Stage 1 paths.
- Whether production still fails before rendering incomplete About content and private preview remains non-promotable.
- Whether the preview fallback remains presentation-only and unreachable from the public production route.
- Whether heading hierarchy, semantic lists, keyboard focus, responsive dividers, reading measure, and overflow behavior remain accessible.
- Whether the page remains static and free of runtime loading, recovery, logging, telemetry, and analytics.

Read [Canonical Records](../evidence-ledger/canonical-records.md) before changing About content or validation, and [Release Construction](../release-lifecycle/release-construction.md) before changing resolved links or release failure behavior.
