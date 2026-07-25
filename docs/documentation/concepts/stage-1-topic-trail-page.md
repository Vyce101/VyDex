---
label: Stage 1 Topic Trail Page
order: 1500
---

# Stage 1 Topic Trail Page

Topic Trail pages are static route indexes for controlled frontier storylines. Each page names one validated trail, states its scope, reports activity derived from current public Entries, and presents those Entries in a deterministic order. This page is for maintainers, technical users, and coding agents changing Topic Trail resolution, ordering, route generation, Entry Preview integration, or responsive behavior.

## Purpose and Ownership

The feature turns one `ResolvedTopicTrail` into a lightweight reading surface. It owns:

- The generated `/topic-trails/{trail-slug}/` page for every resolved non-empty public Topic Trail.
- The Trail Header, Metadata Strip, Topic Trail note, and Entry list inside the shared site shell.
- Production projection checks for the Trail Name, description, Entry count, Last Activity, and canonical route.
- Presentation-only private-preview fallbacks for missing required text and unavailable Last Activity.
- Topic Trail-specific composition of [Entry Preview](entry-preview.md) and Frontier Atlas primitives.

It does not own:

- [Canonical Records](canonical-records.md) owns Topic Trail schemas, stable IDs, slugs, aliases, and Entry relationship validation.
- Selection of current public Entry snapshots, material-activity derivation, membership, counts, ordering, or Last Activity. [Release Construction](release-construction.md) supplies those values.
- Entry Preview field content, status labels, claim rendering, or Entry links.
- Header, Footer, navigation, document structure, or global design tokens.
- Client-side Entry loading, search, filters, sort controls, analytics, or logging.

## Inputs and Outputs

Production rendering accepts one complete `ResolvedTopicTrail`. It contains the validated Topic Trail record, canonical URL, ordered current public Entries, exact Entry count, and latest meaningful activity for the trail. The feature projects that value into static HTML and passes the canonical URL to the shared layout.

The private-preview presentation input may contain partial Trail Name, description, Entry, count, route, or activity data. It is not a release record and cannot create a public route or make a preview promotable. The release constructor retains diagnostics and invalid source records without inserting presentation placeholders into canonical or resolved data.

## Normal Flow

1. The thin dynamic route selects the approved application release source for the current Astro mode.
2. [Release Construction](release-construction.md) validates records and histories, selects current public Entries, resolves Topic Trail relationships and routes, and rejects empty trails.
3. Release resolution copies each trail's members and sorts them with the Topic Trail latest-update comparator.
4. Astro maps every resolved trail slug to one static route and passes the complete trail to the feature boundary.
5. The presentation model checks that required fields, count, canonical route, and Last Activity agree with the ordered Entry list.
6. The page renders through the [Stage 1 Site Shell](stage-1-site-shell.md), using the reusable Entry Preview for each Entry.
7. Astro writes the complete page to HTML. The browser does not fetch or reorder Entry data.

## Entry Ordering and Activity

Topic Trail membership includes Entries that name the trail as either their primary or a secondary Topic Trail. Release construction counts those current public Entries once and orders a copied array by:

1. Latest meaningful activity timestamp, newest first.
2. Date Added, newest first.
3. Entry title from the latest material revision, alphabetically in English.
4. Immutable Entry ID, ascending.

The third key comes from `activity.latest_meaningful_activity.entry_title`, not the title in a later non-material correction. The current title still appears in the Entry Preview, but a non-material wording correction cannot change Entry order or Trail Last Activity. Ordering keys after Last Activity are internal and do not appear as ranking or importance signals.

Last Activity is the UTC calendar date of the first ordered Entry's latest meaningful activity timestamp. The Metadata Strip displays it as `YYYY-MM-DD` in a semantic `<time>` element. It never substitutes relative labels such as Today or Yesterday.

## User-Facing Behavior

The shared Header appears first and has no active navigation item. Topic Trails are not added to the main navigation.

The page content follows this order:

1. Trail Header with the Trail Name as the only H1 and the validated one-sentence description beneath it.
2. One continuous Metadata Strip showing `Entries in VyDex`, `Last Activity`, and `Default Order` in that order.
3. A quiet ruled note stating that Topic Trails group related entries over time and are not complete histories, followed by a link to the Topic Trails definition on the current Methodology route.
4. `Entries in This Trail` as an H2 and one vertical Entry Preview list.

A short Route Blue cue ends inside the Trail Header; it does not extend through the Entry list or connect separate Entries. Metadata uses compact type with tabular numerals and visible labels. The strip stacks vertically with horizontal dividers on mobile and uses one divided row when the available width is comfortable.

Topic Trail hosts use the Entry Preview's quiet treatment, which removes the sheet fill and side borders without changing fields, statuses, links, focus behavior, or interaction. The footer link identifies the current trail, including when the Entry belongs through a secondary relationship. One-entry trails render the same structure without filler text.

## Failure Behavior

Production release construction blocks static generation when a Topic Trail is missing its name or description, has no current public Entries, cannot derive activity from a valid Entry history, or contains an unresolved relationship or route collision. Removed current Entries also block Stage 1 release construction and cannot appear on a Topic Trail page.

The page projection fails closed if inconsistent resolved data reaches it, such as an empty Entry array, mismatched count, missing canonical route, or Last Activity that does not match the first ordered Entry. These are build errors rather than public recovery states.

A private-preview host may show `Missing Required Field` for an absent Trail Name or description and `Last Activity: Unknown` when activity is unavailable. Those strings exist only in the presentation model. The preview remains non-promotable, and no invalid or zero-entry public path is generated.

Unknown Topic Trail slugs are absent from `getStaticPaths()` and use the project-level static 404 page without redirecting or running client-side recovery.

## Internal Edge Cases

- A trail with one Entry has a count of one, derives Last Activity from that Entry, and renders one normal preview.
- Filtering membership and sorting both create new arrays; they do not reorder `release.current_entries`, mutate snapshots, or change canonical Topic Trail records.
- The current Entry title and material ordering title may differ after a non-material correction. Only the material title participates in the alphabetical tie-breaker.
- The one-sentence description rule remains editorial. The canonical schema enforces plain single-line text but does not use sentence-counting heuristics.
- Private-preview entries may be absent even when partial Topic Trail text is available. The feature does not invent placeholder Entries or filler copy.

## Cross-System Edge Cases

- [Publication Revisions](publication-revisions.md) derives latest meaningful activity and retains the title from its material snapshot. Topic Trail pages must not infer materiality from the current Entry title or Date Updated alone.
- [Release Construction](release-construction.md) owns membership, ordering, counts, Last Activity, canonical URLs, production failure, and preview promotability. The page verifies resolved consistency but does not rebuild those decisions from authoring files.
- [Entry Preview](entry-preview.md) owns the record field sequence and validation. The Topic Trail host supplies only the quiet treatment and current-trail footer reference.
- [Stage 1 Site Shell](stage-1-site-shell.md) owns Header, Main, Footer, skip navigation, document metadata, and inactive Topic Trail navigation state.
- [Frontier Atlas](frontier-atlas-design-system.md) owns color, typography, spacing, focus, rule, radius, and responsive primitives. Topic Trail CSS only composes those project-owned values.
- [Static Application Foundation](static-application-foundation.md) owns Astro mode selection, application release loading, generated route behavior, the generic 404 boundary, and the browser-test harness.

## Invariants

- Every public Topic Trail route comes from one validated non-empty `ResolvedTopicTrail`.
- Topic Trail membership is a controlled storyline relationship, not a tag lookup or causal connection.
- Latest means latest meaningful activity, not importance, popularity, or completeness.
- Non-material revisions cannot change Last Activity, Entry order, or the title value used for ordering.
- Metadata labels remain visible, dates remain exact, and compact text does not shrink to force one line.
- Entry previews keep their complete field and interaction contract while identifying the current trail.
- The page has exactly one H1, uses an H2 for the Entry list, remains keyboard accessible, and does not scroll horizontally.
- Public rendering has no search, filters, user-controlled sorting, timeline, chart, subscription control, decorative Entry connector, or client-side Entry loader.
- Presentation fallbacks never enter canonical records, resolved release data, routes, Changelog events, or exports.

## Implementation Landmarks

- `src/features/topic-trail-page/` — Production and private-preview projection, static page composition, and responsive styles.
- `src/pages/topic-trails/` — Thin generated Topic Trail route entry point.
- `src/domain/release-construction/` — Topic Trail resolution, latest-update ordering, counts, Last Activity, routes, and production diagnostics.
- `src/domain/material-activity/` — Latest material revision metadata and material Entry title derivation.
- `src/components/entry-preview/` — Reusable preview projection, current-trail override, quiet treatment, and static record markup.
- `tests/domain/`, `tests/features/`, `tests/components/`, and `tests/browser/` — Ordering, failure, projection, route, responsive, keyboard, 404, and accessibility coverage.

## Before Changing Topic Trail Pages

Check:

- Whether membership still includes both primary and secondary relationships without duplication.
- Whether ordering uses material activity, Date Added, the latest material title, and immutable Entry ID in the approved order.
- Whether a non-material title correction leaves ordering and Last Activity unchanged while the current title remains visible.
- Whether production still blocks missing required fields, empty trails, invalid activity, removed Entries, unresolved relationships, and route collisions.
- Whether private-preview fallbacks remain presentation-only and non-promotable.
- Whether the Entry Preview footer names the current trail for both primary and secondary membership.
- Whether route generation remains static, unknown slugs use the generic 404 page, and no browser fetch is introduced.
- Whether the page preserves its heading order, exact metadata labels, Methodology anchor, quiet note, responsive dividers, focus visibility, and overflow safeguards.
