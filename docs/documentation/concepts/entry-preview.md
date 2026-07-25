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
- Safe rendering of the validated inline-Markdown claim.
- The responsive Atlas Sheet layout, text clamping, status treatment, and link accessibility behavior.
- Closed failure when a required preview value is absent, invalid, or unmapped.

It does not own:

- Canonical Entry schemas, validation, controlled values, or the authored order of Domains.
- Snapshot selection, material activity, Topic Trail resolution, canonical URLs, or release promotion.
- Host headings, page layout, Entry ordering, Homepage sections, or Topic Trail pages.
- Full Entry Page or Dataset export presentation, both of which retain every attached Domain.
- Logging, telemetry, client-side state, or a runtime backend.

## Inputs and Outputs

`EntryPreviewSource` is a typed subset of one resolved public Entry. It contains the title, inline-Markdown claim, Claim Status, Evidence Strength, Review Status, non-empty ordered Domain list, Date Updated, Entry canonical URL, and primary Topic Trail name and canonical URL.

The public `EntryPreview.astro` component accepts that source, calls `projectEntryPreview`, and renders a semantic static `<article>`. The view model contains only mapped display labels, exact dates, safe claim HTML, status values, and resolved links. It never contains placeholder text or a partial preview.

## Normal Flow

1. A host obtains a validated resolved Entry through [Release Construction](release-construction.md) and the application release adapter.
2. The host passes the required subset to `EntryPreview.astro`; it does not pass a Latest, recent, or Topic Trail visual variant.
3. `projectEntryPreview` validates every required display value, selects `domains[0]`, maps controlled values to public labels, and renders the claim through the approved inline-Markdown profile.
4. The component renders the metadata band, editorial body, status row, and footer in a fixed order.
5. Frontier Atlas tokens and primitives supply the sheet, rules, type roles, focus treatment, status colors, spacing, and responsive breakpoint. Feature-owned CSS arranges those primitives for this component.

The current `/` technical fixture obtains the existing Dreamer 4 seed Entry through the application release adapter in preview mode. It derives a validated exceptional Claim Status and inline-Markdown claim in memory, then passes the same source to the same component beneath three external host headings. No canonical record or production release is created or changed.

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

Only exceptional Claim Status values receive exceptional status colors. Evidence Strength and Review Status remain neutral, so they do not resemble confidence, probability, importance, or ratings. A Latest Update host gets the same component markup and treatment as recent and Topic Trail hosts.

Preview titles clamp to two lines and claims clamp to three. Below 768px, the metadata band and footer stack, status tabs wrap, and compact metadata remains at its approved `12px/16px` role. Long content may wrap without causing horizontal page scrolling.

## Failure Behavior

The projection throws a normal build error when the source is missing, the Domain list is empty, a controlled value has no mapped label, an exact date is invalid, a required plain-text value is absent, a canonical URL is invalid, or the claim contains invalid or unsupported inline Markdown. It does not return a partial view model, substitute text, write logs, or recover in the browser. Existing build diagnostics and test output report the failure.

## Internal Edge Cases

- The preview reads only `domains[0]` and never sorts or mutates the source Domain array. This is display priority only and does not make that Domain semantically primary.
- Inline Markdown is parsed into an allowed set of text, emphasis, strong, deletion, inline code, break, and safe link nodes. Generated HTML and link attributes are escaped; unsafe protocols and unsupported nodes fail closed.
- The title clamp applies to the anchor itself so its visible focus outline follows the rendered title area.
- A claim temporarily removes its clamp while one of its inline links has focus. This prevents a keyboard-focusable link from remaining hidden; the claim clamps again after focus leaves.
- `data-status` appears only on Claim Status. Evidence Strength and Review Status use the neutral tab treatment even when their machine values resemble another status name.
- Each repeated Read Entry link has `aria-label="Read Entry: [title]"`, while its visible text remains unchanged.

## Cross-System Edge Cases

- [Canonical Records](canonical-records.md) owns the field schemas, inline-Markdown profile, controlled machine values, and exhaustive public-label maps. The preview consumes those contracts without widening them.
- [Release Construction](release-construction.md) owns current snapshot selection, Date Updated, resolved Topic Trail data, and canonical URLs. The preview must not load or repair authoring records itself.
- [Frontier Atlas](frontier-atlas-design-system.md) owns the Atlas Sheet, Record Rules, typography roles, neutral and exceptional status treatments, focus behavior, spacing tokens, and 768px breakpoint. The preview owns only their feature-specific composition.
- [Static Application Foundation](static-application-foundation.md) owns the Astro boundary, static build, fixture, and test harness. The preview adds no client script or runtime data dependency.
- Hosts own their headings and record selection. They cannot make Latest look more important by passing a component variant because no such public interface exists.

## Invariants

- Every required value appears in the exact preview sequence, and incomplete input fails before partial markup can render.
- The first authored Domain is preview display priority only. Full Entry and Dataset outputs continue to expose every attached Domain under their own contracts.
- Evidence Strength never resembles confidence, probability, importance, quality, or a rating.
- Review Status remains visible and neutral at every supported width.
- Topic Trail remains the continuing-storyline link, and repeated Read Entry links include the Entry title in their accessible names.
- The component has no card-wide link, image, icon, source logo, score, progress bar, confidence wording, colored evidence rail, featured badge, trending badge, shadow, or hover lift.
- All three fixture contexts render the same component without a context or visual-variant prop.
- Projection and rendering remain static, deterministic, and free of logging and browser state.

## Implementation Landmarks

- `src/components/entry-preview/` — Public Astro component, typed projection, inline-Markdown rendering, and feature-owned styles.
- `src/domain/canonical-records/controlled-values.ts` — Exhaustive status and Domain public-label maps.
- `src/pages/index.astro` — Non-product three-host conformance fixture.
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
- Whether long labels and URLs wrap without shrinking compact metadata or causing horizontal overflow.
- Whether every host uses the same context-free component and keeps its heading outside the sheet.
- Whether component, browser, keyboard, and Axe tests cover the changed behavior.
