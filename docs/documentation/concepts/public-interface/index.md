---
label: Public Interface
order: 400
---

# Public Interface

The Public Interface is the family of static VyDex pages and shared presentation contracts through which readers inspect the evidence ledger. This page is for maintainers, technical users, and coding agents that need to decide whether a change belongs to shared presentation infrastructure, a reusable record preview, or one public page.

## Purpose And Ownership

The Public Interface owns static semantic presentation of one validated release. It coordinates the visual system, shared document shell, reusable Entry summaries, and page-specific information architecture.

It does not own canonical evidence values, publication history, release selection, Dataset semantics, deployment, or hosted verification.

## Shared Contracts

- [Frontier Atlas Design System](frontier-atlas-design-system.md) owns tokens, typography, layout primitives, responsive rules, and accessibility safeguards.
- [Stage 1 Site Shell](stage-1-site-shell.md) owns shared document order, navigation, canonical-link placement, and progressive mobile disclosure.
- [Entry Preview](entry-preview.md) owns the reusable summary projection and presentation used by list-style pages.

## Public Pages

- [Stage 1 Homepage](stage-1-homepage.md) selects and presents the latest and recent Entries.
- [Stage 1 Entry Page](stage-1-entry-page.md) presents one complete current public Entry.
- [Stage 1 Topic Trail Page](stage-1-topic-trail-page.md) presents one resolved frontier storyline and its Entries.
- [Stage 1 Methodology Page](stage-1-methodology-page.md) publishes the current and immutable judgment rulebook.
- [Stage 1 About Page](stage-1-about-page.md) publishes project identity, scope, and limitations.
- [Stage 1 Changelog Page](stage-1-changelog-page.md) presents material ledger activity.
- [Stage 1 Export JSON Page](stage-1-export-json-page.md) describes and links the immutable Dataset artifact for the selected release.

## Normal Flow

1. [Release Construction](../release-lifecycle/release-construction.md) supplies one validated application release and canonical route registry.
2. Shared presentation modules project resolved values without changing domain decisions.
3. Page-owned models validate and arrange only the information their route presents.
4. The site shell wraps each page in consistent navigation and document structure.
5. Astro prerenders the complete surface as static HTML, CSS, and JSON without runtime data loading.

## Internal Edge Cases

- Production rendering fails closed when required release or presentation values are missing.
- Private development and test modes may expose explicit fallback states, but those states cannot become production output.
- Repeated links, responsive transformations, focus order, and compact metadata preserve the shared accessibility contract.

## Cross-System Edge Cases

- Pages must not reinterpret record status, material activity, Topic Trail membership, source order, or release metadata.
- The Export JSON page and downloadable bytes must describe the same selected release.
- Frontier Atlas and the site shell own shared presentation behavior; feature pages must not create local substitutes.
- Deployment and hosted verification consume built output without changing page-owned content.

## Invariants

- Every public page is generated from repository-controlled, validated release data.
- Shared visual tokens and accessibility treatments come from Frontier Atlas.
- Shared document order and navigation come from the site shell.
- Feature pages own their information hierarchy but not upstream evidence or release decisions.
- The public interface remains static-first and usable without client-side data fetching.

## Implementation Landmarks

- `src/components/`
- `src/features/`
- `src/pages/`
- `src/styles/global.css`
- `tests/foundation/`
- `tests/features/`

## Before Changing The Public Interface

Identify the page or shared presentation contract that owns the behavior. Read [Static Application Foundation](../static-application-foundation.md), Frontier Atlas, and the site shell before changing shared structure, styling, responsiveness, or accessibility behavior.
