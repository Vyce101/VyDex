---
label: Stage 1 Homepage
order: 400
permalink: /concepts/stage-1-homepage/
---

# Stage 1 Homepage

The Stage 1 Homepage is VyDex's first public reading surface. It explains the product, presents the Entry with the latest material activity, and provides a short recent list from the same validated release. This page is for maintainers, technical users, and coding agents changing Homepage selection, rendering, release loading, or responsive behavior.

## Purpose and Ownership

The Homepage turns a completed application release into one static overview without introducing a second interpretation of Entry recency. It owns:

- The pure selection of one Latest Update Entry and up to five Recent Entries.
- The Hero, Latest Update, Recent Entries, and claim-reading sections.
- The Homepage-specific composition of Frontier Atlas primitives.
- The private-preview message used only when a non-production preview has no Entries.

It does not own:

- Canonical records, snapshot history, materiality derivation, or production validation.
- Release descriptor creation, release metadata, the public site origin, or release promotion.
- Entry Preview field projection and presentation.
- Shared Header, Footer, navigation, routes, or destination pages.
- Client-side fetching, search, sorting controls, logging, telemetry, or runtime state.

## Inputs and Outputs

`selectHomepageEntries` receives the validated production release's `current_entries` collection. It copies and sorts that collection, then returns the first Entry as `latest_update` and the first five as `recent_entries`. The latest Entry remains in the recent list; the two placements serve different page contexts and are intentionally not deduplicated.

The selector does not filter, repair, or invent Entries. Production release validation has already excluded Removed Entries and requires at least one valid public Entry. The rendering component receives a `HomepagePresentationModel` and produces static HTML through the shared layout.

## Entry Ordering

The Homepage and release resolution use the same pure comparator. Resolved public Entries are ordered by:

1. `activity.latest_meaningful_activity.published_at`, newest first.
2. `activity.date_added`, newest first.
3. Immutable `entry.id`, ascending.

The existing activity field is derived from the newest snapshot whose `materiality` is `material`. A non-material revision may change current display content, including a corrected title, but it must not change latest-material-activity order. Title is never an ordering fallback.

## Normal Flow

1. The thin `/` route chooses an application release-loading entry point for the current Astro mode.
2. Production loads and validates `generated/release-data/release.json`, then constructs a strict production release from the canonical records and persisted metadata.
3. Astro development and explicit `test` mode use fixed non-production metadata. That adapter performs no writes and cannot be selected as a production fallback.
4. The route passes `release.current_entries` to the Homepage presentation-model boundary.
5. The selector copies and orders the Entries with the shared comparator.
6. `Homepage.astro` renders the selected records through `EntryPreview.astro` inside `FoundationLayout.astro`.
7. Astro generates the complete Homepage into HTML. The browser does not fetch Entry data or reorder records.

## User-Facing Behavior

The Header has no active item on the Homepage. The Hero contains one H1, a short description, the product boundary statement, and links to Latest Entries, Methodology, and About. Latest Entries uses a normal `/#latest` anchor.

The Latest Update label sits outside the selected Entry Preview. Recent Entries and Evidence Updates shows one vertical list with up to five real records. With the current seed release, the Dreamer 4 Entry appears as Latest Update and again as the first of all three recent Entries.

How VyDex Reads Claims presents Claim, Evidence, and Caveat in one continuous Atlas Sheet, followed by the Methodology link. The page does not add search, sorting, placeholders, media, scores, importance language, or news-feed patterns.

At 1100px and wider, the Hero uses a 7/5 grid and the recent section uses a 3/9 heading rail. Below that width, identity precedes Latest Update and the recent heading moves above the list. On mobile, the two buttons become full width and the three claim-reading cells stack within one surface.

## Failure Behavior

Production fails before rendering when the persisted descriptor is missing, unreadable, malformed, or schema-invalid, or when strict release construction rejects the repository records. The selector also throws a normal build error if it receives an empty production collection. Neither path renders an empty public Homepage.

The separate private-preview state may render only `No entries have been added yet.` It is not a production fallback and must not introduce placeholder records.

## Internal Edge Cases

- The selector sorts a copied array, so it cannot mutate release-owned Entry order.
- Fewer than five Entries produces a shorter list containing only the available records.
- Equal material timestamps fall back to Date Added, then immutable Entry ID. A title-only change cannot affect the result.
- Latest Update is intentionally duplicated in Recent Entries.
- The responsive registration rule exists only in the 1100px two-column Hero.
- Normal anchor navigation and static HTML keep the page readable without JavaScript and respect reduced-motion preferences.

## Cross-System Edge Cases

- [Publication Revisions](../evidence-ledger/publication-revisions.md) derives `latest_meaningful_activity`; the Homepage must not infer materiality from Date Updated or the current snapshot.
- [Release Construction](../release-lifecycle/release-construction.md) validates current public Entries, supplies persisted or fixed metadata through explicit adapters, and uses the same comparator before the Homepage receives data.
- [Entry Preview](./entry-preview.md) owns record projection and sheet markup. The Homepage owns only which records appear and the headings around them.
- [Frontier Atlas](./frontier-atlas-design-system.md) supplies the grid, sheet, button, typography, rule, focus, and responsive primitives. Homepage CSS composes those primitives without creating substitute tokens.
- [Stage 1 Site Shell](./stage-1-site-shell.md) owns the Header, Main, Footer, and navigation contract. The Homepage renders through that layout and does not set an active navigation item.
- [Static Application Foundation](../static-application-foundation.md) owns Astro mode selection and static-build commands. Test-mode output proves the page without creating genuine release metadata.

## Invariants

- Latest means latest material activity, not importance, popularity, or title order.
- The Homepage consumes validated `current_entries` and never creates a parallel source of public Entry truth.
- Exactly one H1 describes the product. Latest Update, Recent Entries and Evidence Updates, and How VyDex Reads Claims use H2 headings; Entry Preview titles sit beneath them at H3.
- The Latest Update Entry remains present in the recent list.
- Production cannot render with zero valid public Entries or substitute fixed non-production metadata.
- Ordinary builds, development starts, page renders, and tests never generate a release ID or timestamp.
- Complete Entry content is generated into static HTML; there is no runtime Entry fetch.
- The page does not imply that tracked claims are confirmed facts, exhaustive coverage, or Evidence Strength scores.

## Implementation Landmarks

- `src/features/homepage/` — Homepage selector, presentation model, Astro component, and feature-owned styles.
- `src/pages/index.astro` — Thin route that chooses the approved application release source and renders the feature.
- `src/domain/release-construction/compare-resolved-public-entries.ts` — Shared deterministic Entry comparator.
- `src/adapters/application-release/` — Persisted-production and fixed non-production application composition.
- `src/adapters/persisted-release-descriptor/` — Read-only descriptor loading and schema validation.
- `tests/features/homepage/` — Selector and private-preview model coverage.
- `tests/browser/homepage.spec.ts` — Content, responsive, navigation, and accessibility coverage.

## Before Changing the Homepage

Check:

- Whether release resolution and Homepage selection still use the same comparator.
- Whether material activity, Date Added, and immutable ID remain the only ordering keys.
- Whether the selector copies its input and retains Latest Update in Recent Entries.
- Whether production still reads only the persisted descriptor and fails closed without it.
- Whether development and tests use fixed metadata without writing or masquerading as a genuine release.
- Whether page content, heading hierarchy, link destinations, responsive order, and prohibited elements remain within the Homepage contract.
- Whether Entry Preview, Frontier Atlas, and site-shell responsibilities remain in their owning modules.
- Whether unit, build, browser, keyboard, reduced-motion, overflow, and Axe checks cover the changed behavior.
