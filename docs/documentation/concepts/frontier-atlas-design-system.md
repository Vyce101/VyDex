---
label: Frontier Atlas Design System
order: 400
---

# Frontier Atlas Design System

Frontier Atlas is VyDex's shared presentation contract for the Stage 1 public interface. It gives pages one set of colors, typography roles, layout rules, controls, evidence-state treatments, and responsive behavior. This page is for maintainers and coding agents building or reviewing Astro presentation code.

## Purpose and Ownership

Frontier Atlas prevents each page or component from creating a local visual system. It owns:

- The light-only color tokens and their intended roles.
- Source Serif 4 and Source Sans 3 typography roles.
- The spacing scale, reading measure, page widths, responsive breakpoints, columns, gutters, and margins.
- Shared sheets, rules, buttons, links, status tabs, tables, and disclosure motion.
- Responsive behavior for heading rails, metadata bands, annotations, Frontier Delta records, registration cues, and essential tables.
- Focus, reduced-motion, grayscale, contrast, and horizontal-overflow requirements.
- Presentation safeguards that reject substitute colors, large radii, shadows, gradients, glass effects, and inaccessible focus styling.

It does not own:

- Canonical Entry fields, status definitions, or evidence rules.
- The content, information architecture, or data selection for a particular public page.
- Route generation, release construction, or dataset output.
- A dark palette. Stage 1 has no automatic dark mode.
- Browser telemetry, analytics, or persistent client logging.

## Normal Flow

1. `FoundationLayout.astro` loads the project-owned Source Sans 3 and Source Serif 4 files, then imports `src/styles/global.css`.
2. `global.css` imports the token, base, typography, layout, component, and site-shell stylesheets in a stable order.
3. Mobile tokens apply by default. Media queries change the grid and approved type roles at 768px, 1024px, and 1312px; viewports below 400px use the smaller mobile page margin.
4. Astro pages use the shared `atlas-*` classes and status data attributes instead of declaring local colors or substitute components. The [Stage 1 Site Shell](stage-1-site-shell.md) composes those primitives for shared navigation and page structure, while the [Entry Preview](entry-preview.md) composes them for one reusable record summary.
5. Vitest checks the token and source contract. Playwright checks representative computed styles, responsive layouts, interaction states, reduced motion, grayscale-readable states, accessibility, and horizontal overflow.

The current `/` route is a technical conformance fixture. It demonstrates the primitives and renders the same Entry Preview beneath three external host headings, but it is not the Stage 1 homepage, a Topic Trail page, or a public evidence record.

## Presentation Contracts

`atlas-page`, `atlas-page-boundary`, `atlas-grid`, and `atlas-prose` provide the page measure, shared outer alignment, responsive columns, and long-form reading measure. The site shell uses `atlas-page-boundary` to align the Header and Footer with Main content. Rail, metadata, annotation, registration-cue, and Frontier Delta classes provide the approved responsive transformations without requiring page-specific breakpoint logic.

Typography classes assign both the font family and the complete size, line-height, weight, and tracking role. Editorial titles, claims, evidence prose, and significant interpretation use Source Serif 4. Navigation, controls, headings, metadata, dates, tables, labels, errors, and compact annotations use Source Sans 3.

Sheets, rules, buttons, links, status tabs, tables, and disclosures use shared component classes. Essential tables require a visible caption or heading and a `data-label` on each body cell so the mobile layout can become a stacked definition record without horizontal scrolling.

Claim-status tabs use visible text and borders as well as color. The base treatment is neutral; `reported_but_unverified`, `disputed`, and `failed_retracted` use the three approved exceptional treatments. Pages must supply the real public label in the markup because CSS must not generate or replace essential status information.

## Accessibility Adjustment for Compact Metadata

Muted Ink (`#667581`) has a 4.29:1 contrast ratio against Atlas Canvas (`#F2F4F3`) at the 12px compact-metadata size. That does not meet the 4.5:1 WCAG AA requirement for normal text.

Compact metadata therefore uses Secondary Ink (`#50606F`). Muted Ink remains an approved token, but it must not replace Secondary Ink in the compact-metadata role on Atlas Canvas. This rule takes priority over older tickets that specify or imply Muted Ink for that role because those tickets predate the measured accessibility result.

A future ticket may change the role only if it supplies an approved treatment that preserves the required contrast and updates the design-system contract and tests together.

## User-Facing Behavior

Frontier Atlas remains understandable when color is removed. Status names stay visible, evidence states do not resemble rewards or scores, and no essential information appears only in a margin annotation. Prose links are underlined, keyboard focus uses a visible three-pixel outline, and controls keep their approved mobile dimensions rather than shrinking to preserve a desktop composition.

The operating system's dark-mode preference does not change Frontier Atlas colors. A dark mode requires a separate approved palette and complete component-state specification.

Under `prefers-reduced-motion: reduce`, non-essential transitions and disclosure movement are removed. The same open and closed states remain available without animation.

## Internal Edge Cases

- Viewports below 400px reduce page margins from 20px to 16px; typography does not shrink below the approved mobile scale.
- The 1312px breakpoint combines a 1248px maximum content width with two 32px outer margins. Larger viewports keep the same content maximum and gain additional outer space.
- Long-form prose stays near 68 characters while structured metadata can use the wider page measure.
- Pure White is reserved for text on dark controls or another case where Atlas Sheet lacks sufficient contrast. It is not a substitute page or card surface.
- The mobile table layout depends on author-provided `data-label` values. Missing labels remove the definition term and break the essential mobile record.
- Disclosure content remains readable without browser JavaScript because the fixture and core presentation use native HTML and CSS.

## Cross-System Edge Cases

- [Canonical Records](canonical-records.md) owns claim-status machine values and public labels. Frontier Atlas only maps those machine values to presentation treatments.
- The [Entry Preview](entry-preview.md) owns its field sequence, typed projection, and feature layout. Frontier Atlas supplies the sheet, rules, typography, status treatments, focus behavior, spacing, and responsive breakpoint used by that component.
- The [Stage 1 Site Shell](stage-1-site-shell.md) owns shared navigation behavior and page structure. Frontier Atlas supplies its tokens, focus treatment, responsive breakpoint, and page alignment primitive.
- [Static Application Foundation](static-application-foundation.md) owns the Astro shell, local font loading, static build, and validation commands. Frontier Atlas owns the presentation contract loaded by that shell.
- Later page modules may choose which real record information to show, but annotations may only repeat or emphasize that information. A page cannot move an essential value exclusively into an annotation.
- Page-specific CSS may arrange content within an approved primitive, but it must not introduce substitute colors, shadows, large radii, gradients, or a competing responsive scale.

## Failure Behavior

Design-system review fails when presentation code introduces a local color, large rounded card, default shadow, inaccessible focus state, automatic dark-mode override, essential color-only state, or horizontal page scrolling. The foundation contract tests catch source-level violations, while browser tests catch representative computed-style, responsive, motion, grayscale, and accessibility failures.

## Invariants

- Frontier Atlas is light-only for Stage 1, with `color-scheme: light`.
- `src/styles/global.css` is the application stylesheet entry point.
- Pages and components use project-owned tokens and primitives rather than local substitutes.
- Compact metadata on Atlas Canvas uses Secondary Ink, not Muted Ink.
- The interface remains understandable in grayscale.
- Evidence states never use green escalation, scores, reward cues, or popularity styling.
- No essential information appears only in an annotation.
- Essential tables do not require horizontal scrolling.
- Focus remains visible, reduced-motion preferences are respected, and text never shrinks below the approved mobile roles.
- The design system adds no telemetry, analytics, production console logging, or persistent client logging.

## Implementation Landmarks

- `src/styles/tokens.css` — Color, typography, spacing, grid, focus, radius, and motion tokens.
- `src/styles/global.css` — Ordered public stylesheet entry point.
- `src/styles/base.css` and `src/styles/typography.css` — Document defaults, interaction behavior, and type roles.
- `src/styles/layout.css` and `src/styles/components.css` — Responsive layouts and shared presentation primitives.
- `src/styles/site-shell.css` — Frontier Atlas presentation for the shared Stage 1 Header, Footer, mobile disclosure, and skip link.
- `src/components/entry-preview/` — Feature-owned composition of Atlas primitives for the Entry Preview.
- `src/pages/index.astro` — Non-product conformance fixture.
- `tests/foundation/frontier-atlas-contract.test.ts` — Source and token safeguards.
- `tests/browser/frontier-atlas.spec.ts` — Computed-style, responsive, motion, grayscale, and accessibility checks.
- `tests/browser/entry-preview.spec.ts` — Preview-specific responsive, focus, status, overflow, and accessibility checks.

## Before Changing Frontier Atlas

Check:

- Whether the change uses an existing token or primitive before adding a new public interface.
- Whether text and controls retain required contrast, focus, labeling, and grayscale meaning.
- Whether all five representative widths still have the approved columns, gutters, margins, type roles, and no horizontal overflow.
- Whether mobile tables retain visible definition labels and desktop table semantics.
- Whether reduced-motion and dark operating-system preferences preserve the approved static states and light palette.
- Whether a page ticket predates the compact-metadata accessibility adjustment. If it conflicts, preserve the Secondary Ink rule unless the project owner explicitly approves a tested accessible replacement.
- Whether the change belongs to Frontier Atlas, the [Stage 1 Site Shell](stage-1-site-shell.md), the [Entry Preview](entry-preview.md), or a page-owned content module.

Read [Stage 1 Site Shell](stage-1-site-shell.md) before changing shared navigation or page structure, and read [Static Application Foundation](static-application-foundation.md) before changing global imports, font loading, test commands, or the Astro presentation boundary.
