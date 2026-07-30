---
label: Stage 1 Entry Page
order: 500
permalink: /concepts/stage-1-entry-page/
---

# Stage 1 Entry Page

The Stage 1 Entry Page renders one complete current public Entry at `/entries/{entry-slug}/`. It is the maintained-record view behind each Homepage preview, not an article template or a client-side data screen. This page is for maintainers, technical users, and coding agents changing Entry projection, static routing, record presentation, or not-found behavior.

## Purpose and Ownership

The Entry Page gives every validated current public Entry one consistent evidence-bounded reading surface. The feature owns:

- Projection from one `ResolvedPublicEntry` into display-ready labels, dates, links, Markdown, caution text, metadata, and source records.
- The exact public section and heading order.
- Presentation of every Domain, the primary Topic Trail, and all secondary Topic Trails.
- Status wording, conditional caution notices, follow-up context, and null-date fallbacks.
- Version-specific Methodology help links on explanatory field labels.
- The responsive Entry Sheet, Frontier Delta transformation, source-record layout, focus behavior, and overflow protection.
- Static generation of one canonical route for every current public Main Entry.
- The generic static not-found page used when a route was not generated.

It does not own:

- Canonical Entry validation, Source Role definitions, or public label maps.
- Snapshot publication, materiality, Date Added, Date Updated, or current-revision selection.
- Public source ordering. [Release Construction](../release-lifecycle/release-construction.md) supplies an already ordered copied Entry.
- Topic Trail destination-page membership, ordering, and presentation. The [Stage 1 Topic Trail Page](./stage-1-topic-trail-page.md) owns that feature.
- The shared Header, Footer, document structure, or Frontier Atlas tokens.
- Client-side fetching, loading states, browser recovery, telemetry, or logging.

## Inputs and Outputs

The feature accepts one complete `ResolvedPublicEntry` from the application release boundary. That value contains the selected current snapshot, derived activity dates, canonical Entry URL, resolved Topic Trails, resolved Methodology, and sources in public display order.

`createEntryPageViewModel` returns presentation-only values. It maps controlled values to public labels, formats calendar dates for display while preserving exact ISO values, renders validated Markdown, derives Entry-level Evidence Types from the ordered sources, validates canonical relationship URLs, and builds help links from the resolved version-specific Methodology URL. It does not change the resolved Entry.

`EntryPage.astro` renders the view model as static semantic HTML. The route passes that component through `FoundationLayout.astro`, so every generated Entry has the shared skip link, Header, Main region, and Footer.

## Static Route Flow

1. `src/pages/entries/[slug].astro` selects the named application release adapter.
2. Development and test builds use fixed non-production metadata. Production uses the persisted genuine release descriptor and fails closed when that descriptor is missing or invalid.
3. `getStaticPaths()` reads `release.current_entries`, keeps current `main_entry` records, and creates one route and resolved Entry prop for each slug.
4. The thin route passes the resolved Entry to the Entry Page feature. It does not read canonical files, choose a snapshot, sort sources, or fetch data in the browser.
5. The feature projects and renders the complete record into HTML during the build.
6. Slugs absent from `getStaticPaths()` fall through to the generated `404.html`. Built-site preview and Cloudflare Pages return an HTTP `404` without redirecting to the Homepage.

Every current genuine Entry produces one Entry route. Removed Entries do not produce routes.

## Record Structure

The rendered record has one H1 and uses this H2 order:

1. Frontier Delta.
2. Details.
3. Significance.
4. Caveats.
5. Dates and Metadata.
6. Sources.
7. Methodology Used.

The page order before those sections is Header, Back to Latest, Entry Header, Status Summary, and an optional caution notice. Details uses four H3 subsections in its approved reading order. Frontier Delta and Significance use H3s for their internal record divisions.

The page remains one continuous Atlas Sheet with a maximum width of 1080px, a one-pixel Record Rule, a two-pixel radius, and no shadow. Inner padding is 20px on mobile and 32px from the tablet breakpoint upward. The Entry Header and every main record section use the full inner width. The optional caution notice retains a narrower centered measure so exceptional status text does not become a wide banner of prose.

Frontier Delta is always expanded. It uses a horizontal previous-to-new relationship at desktop width and a vertical relationship at narrower widths. The connector is decorative for assistive technology; only the visible labels and record text carry meaning.

## Status and Conditional Content

The Status Summary always presents Claim, Evidence, Review, Entry State, and Methodology with visible labels. Claim Status may receive an exceptional visual treatment, but Evidence Strength and Review Status remain neutral and never become a score, grade, percentage, progress bar, or confidence measure.

A top caution notice appears only for:

- Reported But Unverified.
- Disputed.
- Failed / Retracted.

Confirmed, Supported, and Provisional do not receive that notice. Thin Evidence does not add a second warning.

When Review Status is Follow-Up Needed, the page shows the non-empty review reason. It also shows the next check date when one exists. A null next check date remains `None scheduled` in metadata and does not imply that review has been abandoned.

Potential Significance If Confirmed is omitted when its canonical value is null. One caveat renders as a paragraph; multiple caveats render as a semantic list. Unknown happened or disclosed dates display `Unknown`, while a null next check date displays `None scheduled`.

## Markdown and Escaping

Entry Preview and Entry Page presentation retain Entry-specific Markdown APIs over the shared canonical Markdown renderer. The inline profile is used for claims and individual caveats. The block profile supports paragraphs, inline formatting, safe links, lists, blockquotes, tables, and code blocks.

Text, URLs, titles, and code are escaped before HTML is emitted. Links allow only HTTP, HTTPS, mailto, or relative destinations. Images, raw HTML, headings inside authored fields, unsafe protocols, unresolved references, and other unsupported nodes fail the build instead of producing partial or unsafe markup.

The feature styles tables, code, and long URLs so authored content cannot force horizontal page scrolling.

## Source Presentation

Release resolution clones the selected current Entry and orders its copied source array through the domain-owned public comparator. The Entry Page maps that array in place and never sorts it locally.

Every source record keeps its citation ID, title, publisher or domain, public Source Role, Evidence Types, `used_for` text, and URL attached to the same source object. The page gives every repeated source link a contextual accessible name based on the source title.

[Dataset Generation](../release-lifecycle/dataset-generation.md) defensively uses the same ordering helper. This shared contract prevents the HTML record and public dataset from disagreeing about evidence-role order while leaving canonical records and immutable snapshots untouched.

## Failure Behavior

Incomplete or invalid public Entries are blocked during validation or release construction. The Entry Page does not repair them, insert placeholder fields, or render a partial public record.

Projection throws a build error when it receives a non-Main Entry, an invalid resolved relationship URL, unsafe Markdown, unsupported Markdown, or a controlled value without an approved public mapping. Existing build diagnostics and tests report the failure; the browser receives no recovery script.

Unknown slugs are not represented as incomplete Entries. They receive the generic static not-found page with one H1, neutral wording, the shared Header and Footer, and a normal Homepage link.

Methodology links resolve to the implemented immutable version route, while Topic Trail links resolve to generated static Topic Trail pages. Release construction, not the Entry Page, owns the requirement that every production relationship and route resolve before publication.

## Internal Edge Cases

- Every associated Domain is displayed with equal weight; the full page never silently selects only the first Domain.
- Methodology help links wrap explanatory labels rather than Domain values, Evidence Type values, Source Role values, or Topic Trail names.
- Every Methodology help fragment uses the resolved version-specific URL. The Entry Page does not hardcode a Methodology version or substitute the current route.
- The primary Topic Trail keeps its visible label, and secondary Topic Trails appear under `Also in`.
- Human-readable dates use UTC formatting so build-machine time zones cannot shift the displayed day.
- Entry-level Evidence Types are unique and follow canonical Evidence Type order rather than first-source encounter order.
- Sources retain their resolved order and field attachments during projection.
- The page contains no local source comparator, client request, loading skeleton, hydration directive, catch-all route, or redirect for unknown slugs.
- A Failed / Retracted Entry remains representable as a ledger record, although Stage 1 release validation currently excludes Removed Entries.
- Decorative connector geometry never supplies dates, nodes, intermediate states, or chart semantics.

## Cross-System Edge Cases

- [Canonical Records](../evidence-ledger/canonical-records.md) owns valid Entry fields, Markdown profiles, controlled values, and label maps. The feature consumes those contracts without widening them.
- [Publication Revisions](../evidence-ledger/publication-revisions.md) owns immutable snapshots and material activity. The page cannot infer Date Updated from editable canonical data.
- [Release Construction](../release-lifecycle/release-construction.md) owns current snapshot selection, source ordering, relationships, routes, canonical URLs, and production validity.
- [Entry Preview](./entry-preview.md) uses the same inline Markdown renderer but intentionally shows a smaller field subset and only its display-priority Domain and primary Topic Trail.
- [Stage 1 Topic Trail Page](./stage-1-topic-trail-page.md) consumes the Entry's resolved primary and secondary relationships to build trail membership. The Entry Page only presents and links those relationships.
- [Frontier Atlas](./frontier-atlas-design-system.md) owns tokens, typography roles, focus treatment, status treatments, and responsive primitives. The Entry Page owns only their feature-specific composition.
- The [Stage 1 Methodology Page](./stage-1-methodology-page.md) owns the public definitions and anchor destinations. The Entry Page consumes the shared anchor contract without owning the rulebook.
- [Stage 1 Site Shell](./stage-1-site-shell.md) owns the shared document order and navigation. Entry routes have no active Header item.
- [Static Application Foundation](../static-application-foundation.md) owns Astro's static build, application-release adapter boundary, and browser-test environment.

## Invariants

- One validated current public Main Entry produces one canonical static Entry route.
- Removed Entries and unknown slugs never produce Entry Page HTML.
- Exactly one H1 and the approved H2 and H3 hierarchy remain visible in normal reading order.
- Title, claim, statuses, Methodology, and Frontier Delta appear before long Details content.
- Frontier Delta, Details, Caveats, metadata, sources, and Methodology remain visible without tabs, accordions, or client JavaScript.
- Every Domain and Topic Trail association remains inspectable.
- Explanatory Methodology links remain separate from record values and relationship destinations.
- Source order comes from the resolved Entry and stays consistent with Dataset generation.
- Caveats remain visible before Sources, and confirmed and potential significance remain separate.
- The page remains one maintained record without a sidebar, nested generic cards, hero media, scoring, or article-style embellishment.
- Unknown slugs retain their URL and return a genuine HTTP `404`.
- Rendering adds no telemetry, browser logging, persistent logs, or runtime data dependency.

## Implementation Landmarks

- `src/features/entry-page/` — View-model projection, Astro record rendering, and feature-owned responsive styles.
- `src/pages/entries/[slug].astro` — Thin static route generation over the selected application release.
- `src/pages/404.astro` — Generic static not-found page.
- `src/shared/entry-markdown/` — Entry-specific inline and block Markdown APIs.
- `src/shared/canonical-markdown/` — Shared safe Markdown parsing, escaping, and semantic rendering.
- `src/shared/methodology-navigation/` — Stable Methodology fragments and version-specific help-link construction.
- `src/domain/source-ordering/` — Pure public source comparator and copied-array ordering helper.
- `src/adapters/application-release/` — Named production and fixed-metadata development/test release sources.
- `tests/features/`, `tests/components/`, `tests/domain/`, and `tests/browser/` — Projection, Markdown, source-ordering, route, responsive, 404, and accessibility coverage.

## Before Changing the Entry Page

Check:

- Whether every value still comes from one complete `ResolvedPublicEntry`.
- Whether the route still uses the application release boundary and preserves the production descriptor gate.
- Whether release resolution and Dataset generation still share the source-ordering helper while the page performs no sorting.
- Whether canonical records and immutable snapshots remain unchanged by public ordering or projection.
- Whether heading and section order, conditional content, null fallbacks, and status wording remain exact.
- Whether every Domain, primary Topic Trail, and secondary Topic Trail remains visible.
- Whether Methodology help remains attached to labels only and uses the Entry's resolved immutable version URL.
- Whether every help fragment resolves on both current and version-specific Methodology pages.
- Whether Markdown changes preserve escaping, safe link protocols, supported semantics, and Entry Preview behavior.
- Whether desktop, tablet, and mobile layouts retain visible focus, grayscale meaning, and no horizontal overflow.
- Whether unknown slugs remain absent from static paths and return the generic static `404.html`.
- Whether route, projection, Markdown, ordering, browser, and Axe tests cover the changed behavior.
