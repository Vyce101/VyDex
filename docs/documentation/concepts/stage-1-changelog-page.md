---
label: Stage 1 Changelog Page
order: 850
---

# Stage 1 Changelog Page

The Changelog is VyDex's static revision index for material changes to the public evidence ledger. It groups release-resolved events by publication date and explains what changed without presenting the ledger as news, release marketing, or a live activity feed. This page is for maintainers, technical users, and coding agents changing material-event projection, ordering, links, page structure, or responsive behavior.

## Purpose and Ownership

The feature turns `release.changelog_events` into the public `/changelog/` page. It owns:

- The Changelog Header, Change Type Key, date groups, and material change records inside the shared site shell.
- Production projection checks for event type, exact publication timestamp, derived calendar date, title, summary, immutable identity, and any present affected-record URL.
- Grouping already ordered resolved events by their derived UTC calendar date without re-sorting them in the presentation layer.
- Changelog-specific composition of Frontier Atlas tabs, rules, typography, grid, and responsive date rail.
- Display-safe output that never exposes exact event times in Stage 1.

It does not own:

- Canonical Methodology publication-event or Entry snapshot schemas. [Canonical Records](canonical-records.md) owns those stored contracts.
- Materiality classification, current Entry selection, event derivation, ordering, canonical affected URLs, or production release validity. [Release Construction](release-construction.md) supplies those values.
- Header, Footer, navigation, document structure, global tokens, or the route registry.
- Search, filters, pagination, archives, a visual timeline, client-side event loading, analytics, telemetry, or logging.

## Inputs and Outputs

Production rendering accepts the complete ordered `PublicChangelogEvent[]` from one validated release. Every event has a public type, `published_at`, a calendar `date` derived from that timestamp, title, summary, immutable `source_identity`, affected-record identity, and an optional canonical URL.

The presentation model rejects an empty collection or an event whose required fields are missing or invalid. It also checks that the supplied calendar date equals the first ten characters of the validated RFC 3339 UTC timestamp. A present affected URL must be an absolute HTTP or HTTPS URL without credentials. An unavailable optional URL is omitted rather than replaced with a broken destination.

The output model contains the approved legend copy and ordered date groups. It does not retain `published_at`, so the Astro renderer cannot accidentally display exact times.

## Normal Flow

1. The thin `/changelog/` route selects the approved application release source for the current Astro mode.
2. Release construction validates canonical content and immutable histories, derives material events, attaches affected URLs when available, and sorts the complete event collection.
3. The Changelog presentation model validates the resolved fields and derives each display date from `published_at`.
4. Consecutive events with the same derived date enter one date group while retaining release order.
5. The page renders through the [Stage 1 Site Shell](stage-1-site-shell.md) with a route-derived canonical URL and active Changelog navigation state.
6. Astro writes the complete revision index to static HTML. The browser does not fetch, sort, filter, or paginate events.

## Material Events and Ordering

Entry events come only from material immutable snapshots:

- `initial_publication` becomes `Added`.
- `material_update` becomes `Updated`.
- Historical `removal` data may become `Removed`, but Stage 1 does not publish a Removed seed event.

The separately authored Methodology publication event becomes `Methodology Change`. Non-material corrections, including typo, formatting, link, and minor wording fixes without interpretive change, never become public events.

Release construction orders every event uniformly by:

1. `published_at`, newest first.
2. Type when exact timestamps tie: Methodology Change, Added, Updated, Removed.
3. Title alphabetically in English.
4. Immutable `source_identity` ascending.

Entry events use their immutable revision ID as `source_identity`. The Methodology event uses the affected Methodology ID and does not invent a second event identity. Input record enumeration order cannot affect the resolved output.

The canonical Methodology `1.0.0` event stores `2026-07-24T19:21:21.438Z`. That is a one-time migration value derived from its existing stable UUIDv7. VyDex does not decode UUIDs as a general publication workflow; future Methodology events must author and persist their genuine RFC 3339 UTC publication timestamp when publication occurs. Methodology `effective_date` remains separate because it describes when rules apply rather than exact publication ordering.

## User-Facing Behavior

The shared Header appears first with Changelog active. Main content follows this order:

1. Changelog Header with the only H1, the material-ledger introduction, and the sentence explaining which revision classes appear.
2. `Change Types` as an H2 and one continuous ruled definition band for Added, Updated, Removed, and Methodology Change.
3. `Changes` as an H2 and date groups ordered newest first.
4. Shared Footer.

Date groups use H3 headings and exact `YYYY-MM-DD` `<time>` values. Change titles use H4 headings. Every record presents its visible type tab, title, summary, and optional affected-record link in that order. Repeated links display `View Entry →` or `View Methodology →` while their accessible names include the record title.

Added, Updated, and Methodology Change use neutral rectangular tabs. Removed uses restrained destructive emphasis with the existing failure-status tokens. Type meaning remains visible in text and understandable without color.

Below 768px the Change Type Key stacks four cells with horizontal dividers. At 768px it becomes four columns with internal vertical dividers. Below 1024px each date sits above its records in one column. At 1024px and wider, the date occupies a compact three-column index rail and the ruled records occupy the remaining nine columns. The rail has no markers or connecting line and must not read as a timeline.

## Failure Behavior

Production release construction fails closed when required canonical events or histories are missing or invalid, when no material event collection can be produced, or when route and canonical URL generation fails.

The page projection also fails the build if it receives an empty collection, missing or invalid type, timestamp, title, summary, identity, inconsistent derived date, or malformed present affected URL. It does not render partial production content or presentation placeholders.

An event without a legitimate affected destination may omit its link. Removed remains visible in the legend even though Stage 1 does not generate a Removed event.

## Internal Edge Cases

- Events on the same calendar date remain ordered by their exact timestamps even though the UI displays only the date.
- Exact timestamp ties use type, title, and identity fallbacks rather than input array order.
- The presentation model groups consecutive release events and deliberately does not own a second comparator.
- A malformed empty-string URL counts as an invalid present URL and fails projection; only `undefined` represents an unavailable destination.
- One date group with one event uses the same ruled record structure without filler content.

## Cross-System Edge Cases

- [Canonical Records](canonical-records.md) owns required publication timestamps and strict source field validation.
- [Publication Revisions](publication-revisions.md) owns Entry snapshot materiality and immutable revision history.
- [Release Construction](release-construction.md) owns event derivation, uniform ordering, derived dates, affected URLs, and production diagnostics.
- [Stage 1 Site Shell](stage-1-site-shell.md) owns Header, Main, Footer, skip navigation, canonical navigation, and the active Changelog state.
- [Frontier Atlas](frontier-atlas-design-system.md) owns colors, status tokens, typography, spacing, rules, focus, grid, and breakpoints.
- [Static Application Foundation](static-application-foundation.md) owns Astro mode selection, application release loading, static route generation, and the test harness.

## Invariants

- Changelog remains a calm revision index, not a news feed, activity stream, release-notes promotion surface, or visual timeline.
- Every visible record is a material release event and every summary states what changed.
- Non-material revisions never appear.
- Methodology changes remain distinct from Entry changes.
- Exact timestamps determine ordering but never appear in Stage 1 output.
- Affected links are either validated destinations with record-specific accessible names or absent.
- The page has one H1, H2 section headings, lower-level date and record headings, visible focus, and no horizontal scrolling.
- Public rendering has no search, filters, pagination, archive split, thumbnails, charts, banners, or activity animation.

## Implementation Landmarks

- `src/features/changelog-page/` — Production projection, date grouping, static page composition, and responsive styles.
- `src/pages/changelog/` — Thin static route entry point and canonical URL composition.
- `src/domain/release-construction/derive-changelog.ts` — Material-event derivation and uniform comparator.
- `data/canonical-records/methodology-publication-events/` — Authored Methodology publication-event records.
- `tests/domain/`, `tests/features/`, and `tests/browser/` — Contract, ordering, grouping, failure, responsive, static, and accessibility coverage.

## Before Changing the Changelog Page

Check:

- Whether every source event is material and has a genuine authored publication timestamp.
- Whether Methodology `effective_date` remains separate from event `published_at`.
- Whether ordering still uses timestamp, type, title, and immutable identity in the approved order.
- Whether the view model preserves release order and omits exact timestamps from display data.
- Whether unavailable links are omitted while malformed present URLs still fail closed.
- Whether Removed remains in the legend without introducing a Stage 1 Removed event.
- Whether the Header, content sections, and Footer retain their required order and heading hierarchy.
- Whether the legend and date rail use approved breakpoints, visible labels, rules, focus, and overflow safeguards.
- Whether the page remains complete static HTML without runtime loading, logging, search, filters, or timeline behavior.
