---
label: Canonical Records
order: 300
---

# Canonical Records

Canonical records are the framework-independent data contracts for VyDex entries, Topic Trails, Methodology versions, publication snapshots, and release descriptors. This page is for maintainers, technical users, and coding agents that need to validate records or change the domain model safely.

## Purpose and Ownership

The canonical-record system gives each durable record a stable shape before storage, publication, rendering, and export workflows are added. It owns:

- Stable machine values and their TypeScript and Zod representations.
- UUIDv7 identities, public slugs, dates, timestamps, and Methodology version primitives.
- Strict schemas for every current durable record type.
- Entry-local source citations and their evidence metadata.
- Safe prose profiles for plain text and Markdown fields.
- Record-local validation and aggregate validation across record collections.
- Structured diagnostics that later commands can format or log.

It does not own:

- Reading or writing record files.
- Choosing record storage locations.
- Generating IDs, slugs, revision numbers, snapshots, changelog events, or releases.
- Comparing revisions or deciding material activity.
- Rendering pages, routes, canonical URLs, or exports.
- Terminal output, filesystem logging, telemetry, or process exit behavior.

## Record Family

An `Entry` contains the current authored claim, evidence assessment, review state, Domain membership, Topic Trail relationships, Methodology relationship, dates, interpretation, caveats, and embedded sources.

A `TopicTrail` provides a durable identity, public name, description, current slug, and historical aliases. Entries point to Topic Trails by UUID; trails do not store Entry membership or derived activity counts.

A `Methodology` stores a public version and complete public content in named sections. Its structure owns lists, examples, definitions, and hierarchy, while each Markdown leaf supplies prose only.

An `EntryPublicationSnapshot` stores revision metadata with a complete validated Entry payload. The schema defines the durable shape; the separate [Publication Revisions](publication-revisions.md) system validates history, constructs snapshots, and derives activity without changing the canonical contract.

`ReleaseMetadata` currently contains only a durable release ID and generation timestamp. Release construction and generated manifests belong to later systems.

Sources remain embedded in their parent Entry. A citation ID is unique within that Entry, but it is not a global durable identity and does not create a normalized evidence graph.

## Validation Flow

1. A caller passes an unknown value and may attach a filename for diagnostic context.
2. The record-specific validator checks the strict schema, controlled values, text profiles, dates, identifiers, required fields, and record-local conditional rules.
3. Successful parsing returns a typed record. Leading and trailing text whitespace may be trimmed, but meaningful internal Markdown structure is preserved.
4. Aggregate validation receives collections of locally valid records and checks global UUID uniqueness, Entry and Topic Trail slug namespaces, relationships, and snapshot consistency.
5. The caller must select either authoring validation or Stage 1 production validation. Production validation additionally rejects current public Entries whose Entry State is `removed`.
6. Any blocking issue returns a structured diagnostic instead of writing to the terminal or filesystem.

Validation continues across independent records where it is safe to do so, allowing one run to report unrelated failures together. Invalid records are not silently repaired, and unknown object fields are rejected rather than discarded.

## Text and Markdown Boundaries

Plain-text fields are trimmed, non-empty, single-line values and cannot contain Markdown, HTML, or MDX formatting.

Entry claims and Caveats use inline Markdown. They may contain ordinary inline formatting, links, and inline code, but they cannot introduce headings, lists, tables, blockquotes, fenced code, images, HTML, or MDX. Claims must remain on one line; their one-sentence rule is editorial rather than heuristic validation.

Entry detail, Frontier Delta, and Significance fields accept block Markdown for paragraphs, lists, tables, blockquotes, links, and code. Headings remain forbidden because the record structure owns page hierarchy.

Methodology Markdown accepts one or more prose paragraphs with safe inline formatting. Lists, tables, headings, examples, and definition rows come from the surrounding structured fields and cannot be recreated inside a Markdown leaf.

All Markdown profiles reject images, raw HTML, executable MDX constructs, and unsafe link protocols. Literal HTML or JSX inside inline code or fenced code remains text and does not trigger a false failure.

## Failure Behavior

Validation diagnostics identify the record type, field path, violated rule, and invalid value when one is available. They preserve a caller-supplied filename, include a record ID when one can be read, and may identify a related record for collisions or broken relationships.

Every rule implemented today emits a blocking `error`. The diagnostic type reserves `warning` for future editorial or release checks, but the canonical-record system does not currently produce warnings.

## Internal Edge Cases

- Calendar dates must use `YYYY-MM-DD` and represent real dates; matching the text pattern alone is not enough.
- Snapshot and release timestamps must be RFC 3339 UTC values using `Z`.
- Current slugs and aliases share one collision-free namespace within Entries and another within Topic Trails. The two route families do not share a namespace.
- Domain, alias, secondary Topic Trail, citation ID, and per-source Evidence Type duplicates are rejected where their contracts require uniqueness.
- Review reasons are required only while follow-up is active and must be `null` for stable reviews.
- Potential Significance becomes required when specified Claim Status, Evidence Strength, or source Evidence Type conditions apply.
- Evidence Strength scores come from one stable mapping and cannot be authored separately in an Entry or Methodology.
- Topic Trail and claim sentence requirements remain editorial because automated sentence segmentation would reject valid technical prose.

## Cross-System Edge Cases

- Durable UUIDv7 IDs share one global namespace across current Entries, Topic Trails, Methodologies, snapshot revisions, and release descriptors. Entry-local citation IDs are excluded.
- Entry relationships use UUIDs, never titles, filenames, names, or slugs.
- Every primary and secondary Topic Trail reference and every Methodology reference must resolve during aggregate validation.
- A snapshot’s outer Entry and Methodology IDs must match its embedded Entry, and its stored Methodology public version must match the referenced Methodology record.
- The schema recognizes `removed` for durable compatibility. Stage 1 production validation rejects it only for current public Entries, not for historical snapshot payloads.
- Later loaders and release commands may format diagnostics and exit with a failure code, but they must not move filesystem or process behavior into the domain module.

## Invariants

- Stable machine values remain lowercase `snake_case`; public labels come from exhaustive framework-independent maps.
- Evidence Strength is not probability, confidence, importance, quality, or ranking.
- Review Status describes maintenance need, not claim truth.
- Entry State remains separate from Claim Status.
- Caveats remain separate from status, strength, Frontier Delta, and Significance.
- Sources remain embedded in Entries during Stage 1.
- Structured relationships use durable IDs, while slugs remain public routing identifiers.
- Every Domain attached to an Entry remains ordered authored data for later pages and exports.
- Domain validation does not depend on Astro, filesystem access, or logging.

## Implementation Landmarks

- `src/domain/canonical-records/` — Stable values, primitives, prose profiles, and record schemas.
- `src/domain/cross-record-validation/` — Diagnostic conversion and aggregate invariants.
- `src/domain/index.ts` — Public framework-independent domain entry point.
- `tests/domain/` — Valid fixtures, schema checks, Markdown safety, and aggregate validation tests.

Publication behavior belongs to `src/domain/publication-revisions/` and `src/domain/material-activity/`. See [Publication Revisions](publication-revisions.md) before changing snapshot history or derived-date behavior.

## Before Changing Canonical Records

Check:

- Whether a field belongs to the authored record or should be derived by publication, release, routing, or export code.
- Whether a new relationship uses a durable UUID rather than a public label or slug.
- Whether a controlled value change also requires exhaustive label maps, Methodology definition keys, conditional rules, and tests to change.
- Whether a prose change preserves the distinction between plain text, inline Markdown, Entry block Markdown, and Methodology Markdown.
- Whether an aggregate rule can report the record, path, invalid value, violated rule, and related identity without filesystem access.
- Whether compatibility behavior for aliases, snapshots, or removed Entries would be broken.

Read [Static Application Foundation](static-application-foundation.md) before changing dependency direction, root tooling, or the Astro/domain boundary.
