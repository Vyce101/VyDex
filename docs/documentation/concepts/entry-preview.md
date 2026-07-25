---
label: Entry Preview
order: 300
---

# Entry Preview

The Entry Preview is VyDex's reusable summary of one validated current public Entry. It gives list-style hosts a consistent text-first record without allowing the Homepage, Topic Trail pages, or other hosts to reinterpret the Entry's fields. This page is for maintainers, technical users, and coding agents integrating or changing the preview.

## Purpose and Ownership

The preview keeps projection rules and presentation behavior in one feature-owned module. It owns:

- The typed `EntryPreviewSource` to `EntryPreviewViewModel` projection.
- Selection of the first authored Domain for preview display and mapping through the canonical public label map.
- The exact sequence of Domain, Date Updated, title, claim, three statuses, Topic Trail, and Read Entry link.
- Safe rendering of the validated inline-Markdown claim through the shared Entry Markdown presentation module.
- The responsive Atlas Sheet layout, text clamping, status treatment, and link accessibility behavior.
- A narrow host interface for the quiet visual treatment and the current Topic Trail footer reference.
- Closed failure when a required preview value is absent, invalid, or unmapped.

It does not own:

- Canonical Entry schemas, validation, controlled values, or the authored order of Domains.
- Snapshot selection, material activity, Topic Trail resolution, canonical URLs, or release promotion.
- Host headings, page layout, Entry ordering, Homepage sections, or Topic Trail pages.
- [Stage 1 Entry Page](stage-1-entry-page.md) or Dataset export presentation, both of which retain every attached Domain.
- Logging, telemetry, client-side state, or a runtime backend.

## Inputs and Outputs

`EntryPreviewSource` is a typed subset of one resolved public Entry. It contains the title, inline-Markdown claim, Claim Status, Evidence Strength, Review Status, non-empty ordered Domain list, Date Updated, Entry canonical URL, and primary Topic Trail name and canonical URL.

The public `EntryPreview.astro` component accepts that source, calls `projectEntryPreview`, and renders a semantic static `<article>`. A host may also pass `treatment="quiet"` and a resolved current Topic Trail reference. Those options change the outer treatment and footer relationship only; the view model still contains the same mapped display labels, exact dates, safe claim HTML, status values, and resolved links. It never contains placeholder text or a partial preview.

## Normal Flow

1. A host obtains a validated resolved Entry through [Release Construction](release-construction.md) and the application release adapter.
2. The host passes the required subset to `EntryPreview.astro`. Homepage hosts use the default treatment, while a [Stage 1 Topic Trail Page](stage-1-topic-trail-page.md) passes the quiet treatment and its current trail reference.
3. `projectEntryPreview` validates every required display value, selects `domains[0]`, resolves either the Entry's primary trail or the host-supplied current trail, maps controlled values to public labels, and renders the claim through the shared renderer's approved inline-Markdown profile.
4. The component renders the metadata band, editorial body, status row, and footer in a fixed order.
5. Frontier Atlas tokens and primitives supply the sheet, rules, type roles, focus treatment, status colors, spacing, and responsive breakpoint. Feature-owned CSS arranges those primitives for this component.

The [Stage 1 Homepage](stage-1-homepage.md) passes the release-selected Latest Update Entry and each Recent Entry through the same component with the default treatment. Latest and recent previews remain identical. Topic Trail pages use the quiet treatment without changing the record field sequence or interaction.

## User-Facing Behavior

The preview shows the following information in order:

1. The first authored Domain's canonical public label.
2. `Date Updated: YYYY-MM-DD` in a `<time datetime>` element.
3. The linked Entry title.
4. The one-sentence claim, including safe inline links and formatting.
5. `Claim: [value]`, `Evidence: [value]`, and `Review: [value]` status tabs.
6. The linked `Topic Trail: [name]` label.
7. The visible `Read Entry →` link.

Repeated Read Entry links use an accessible name containing the Entry title. The title and Read Entry links use the canonical Entry URL, while the Topic Trail link uses its resolved canonical URL. The full sheet is not clickable.

Only exceptional Claim Status values receive exceptional status colors. Evidence Strength and Review Status remain neutral, so they do not resemble confidence, probability, importance, or ratings. Latest Update and recent hosts use the same sheet treatment. Topic Trail hosts keep the markup and status treatments but remove the outer sheet fill and side borders so the list reads more quietly.

Preview titles clamp to two lines and claims clamp to three. Below 768px, the metadata band and footer stack, status tabs wrap, and compact metadata remains at its approved `12px/16px` role. Long content may wrap without causing horizontal page scrolling.

## Failure Behavior

The projection throws a normal build error when the source is missing, the Domain list is empty, a controlled value has no mapped label, an exact date is invalid, a required plain-text value is absent, a canonical URL is invalid, or the claim contains invalid or unsupported inline Markdown. It does not return a partial view model, substitute text, write logs, or recover in the browser. Existing build diagnostics and test output report the failure.

## Internal Edge Cases

- The preview reads only `domains[0]` and never sorts or mutates the source Domain array. This is display priority only and does not make that Domain semantically primary.
- Inline Markdown is parsed into an allowed set of text, emphasis, strong, deletion, inline code, break, and safe link nodes. Generated HTML and link attributes are escaped; unsafe protocols and unsupported nodes fail closed.
- The shared renderer also provides block Markdown for the full Entry Page. Preview projection must continue to call only the inline entry point so its one-paragraph contract does not widen.
- The title clamp applies to the anchor itself so its visible focus outline follows the rendered title area.
- A claim temporarily removes its clamp while one of its inline links has focus. This prevents a keyboard-focusable link from remaining hidden; the claim clamps again after focus leaves.
- `data-status` appears only on Claim Status. Evidence Strength and Review Status use the neutral tab treatment even when their machine values resemble another status name.
- A current-trail override changes only the footer label and URL. It does not mutate the resolved Entry or replace its stored primary Topic Trail relationship.
- Each repeated Read Entry link has `aria-label="Read Entry: [title]"`, while its visible text remains unchanged.

## Cross-System Edge Cases

- [Canonical Records](canonical-records.md) owns the field schemas, inline-Markdown profile, controlled machine values, and exhaustive public-label maps. The preview consumes those contracts without widening them.
- [Release Construction](release-construction.md) owns current snapshot selection, Date Updated, resolved Topic Trail data, and canonical URLs. The preview must not load or repair authoring records itself.
- [Frontier Atlas](frontier-atlas-design-system.md) owns the Atlas Sheet, Record Rules, typography roles, neutral and exceptional status treatments, focus behavior, spacing tokens, and 768px breakpoint. The preview owns only their feature-specific composition.
- [Static Application Foundation](static-application-foundation.md) owns the Astro boundary, static build, and test harness. The preview adds no client script or runtime data dependency.
- The [Stage 1 Entry Page](stage-1-entry-page.md) shares the Markdown renderer but owns its complete record projection, block profile, source presentation, and page hierarchy.
- The [Stage 1 Homepage](stage-1-homepage.md) owns latest and recent selection, section headings, and page placement. It uses the same preview for both contexts and intentionally repeats the Latest Update Entry as the first recent Entry.
- The [Stage 1 Topic Trail Page](stage-1-topic-trail-page.md) owns trail membership, list placement, and its request for the quiet treatment and current-trail footer. This matters when an Entry belongs through a secondary Topic Trail relationship.
- Hosts own their headings and record selection. The component exposes no featured, ranked, Latest-specific, or importance treatment.

## Invariants

- Every required value appears in the exact preview sequence, and incomplete input fails before partial markup can render.
- The first authored Domain is preview display priority only. Full Entry and Dataset outputs continue to expose every attached Domain under their own contracts.
- Evidence Strength never resembles confidence, probability, importance, quality, or a rating.
- Review Status remains visible and neutral at every supported width.
- Topic Trail remains the continuing-storyline link, and repeated Read Entry links include the Entry title in their accessible names.
- The component has no card-wide link, image, icon, source logo, score, progress bar, confidence wording, colored evidence rail, featured badge, trending badge, shadow, or hover lift.
- Latest Update and Recent Entries render the same default treatment. The quiet treatment is reserved for the Topic Trail list and does not alter preview content.
- Projection and rendering remain static, deterministic, and free of logging and browser state.

## Implementation Landmarks

- `src/components/entry-preview/` — Public Astro component, typed projection, and feature-owned styles.
- `src/shared/entry-markdown/` — Safe inline and block Markdown rendering shared with the Stage 1 Entry Page.
- `src/domain/canonical-records/controlled-values.ts` — Exhaustive status and Domain public-label maps.
- `src/features/homepage/` — Current public host for Latest Update and Recent Entries previews.
- `src/features/topic-trail-page/` — Public host for quiet previews with a current-trail footer reference.
- `tests/components/entry-preview.test.ts` — Projection, label mapping, Markdown safety, immutability, and failure coverage.
- `tests/browser/entry-preview.spec.ts` — Structure, links, styles, responsive layout, keyboard, overflow, and accessibility coverage.

## Before Changing the Entry Preview

Check:

- Whether every displayed value still comes from validated resolved Entry data.
- Whether the first Domain remains authored display priority rather than a new `primary_domain` concept.
- Whether full Entry and Dataset outputs still retain every Domain.
- Whether controlled-value changes update the exhaustive label maps and projection tests.
- Whether only Claim Status receives exceptional presentation through `data-status`.
- Whether the title, claim, statuses, links, and mobile order remain exact.
- Whether clamping leaves every inline claim link visible while focused and returns after focus leaves.
- Whether Markdown changes preserve both the preview's inline-only contract and the Entry Page's supported block profile.
- Whether long labels and URLs wrap without shrinking compact metadata or causing horizontal overflow.
- Whether host options remain limited to the approved quiet treatment and current-trail footer reference.
- Whether component, browser, keyboard, and Axe tests cover the changed behavior.
