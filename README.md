<h1 align="center">VyDex</h1>

<p align="center">
  <img src="docs/assets/Social%20Preview%20(186KB).jpg" alt="VyDex — versioned evidence for frontier claims" width="900" />
</p>

<p align="center">
  VyDex helps people follow important claims in AI, science, and technology by keeping the supporting evidence, limits, and later updates together.
</p>

<p align="center">
  <a href="#current-status"><img alt="Current status: Stage 1 Homepage implemented" src="https://img.shields.io/badge/status-Stage%201%20Homepage%20implemented-0892D0" /></a>
  <a href="#what-it-does"><img alt="Build: static Astro site" src="https://img.shields.io/badge/build-static%20Astro-1B2430" /></a>
  <a href="#current-status"><img alt="Tests: Vitest and Playwright configured" src="https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-22C55E" /></a>
  <a href="#license-and-notices"><img alt="License: MIT and CC BY 4.0" src="https://img.shields.io/badge/license-MIT%20%2B%20CC%20BY%204.0-4A5568" /></a>
  <a href="https://vydex.vyce.workers.dev"><img alt="Website: VyDex" src="https://img.shields.io/badge/site-vydex.vyce.workers.dev-0892D0" /></a>
  <a href="https://vyce101.github.io/VyDex/"><img alt="Documentation: Retype" src="https://img.shields.io/badge/docs-Retype-0892D0" /></a>
  <a href="docs/CHANGELOG.md"><img alt="Release status: unreleased" src="https://img.shields.io/badge/release-unreleased-7A90A4" /></a>
</p>

## Table of Contents

- [What It Solves](#what-it-solves)
- [What It Does](#what-it-does)
- [Why It Is Different](#why-it-is-different)
- [Current Status](#current-status)
- [Major Milestones Roadmap](#major-milestones-roadmap)
- [Links](#links)
- [License And Notices](#license-and-notices)

## What It Solves

Important frontier claims are often scattered across announcements, papers, articles, and later corrections. That makes it difficult for readers, researchers, and builders to tell what was claimed, what the evidence supports, and whether the conclusion still holds after new information appears. VyDex exists to keep that history together.

## What It Does

VyDex is designed to preserve claims as evidence records rather than short-lived posts.

**Versioned records and citations.** Users will be able to see how an entry changed, inspect older versions, identify the methodology used at the time, and cite either the current record or a specific historical version.

**Searchable evidence.** Users will be able to search claims and narrow the results using fields such as topic, status, evidence strength, review state, and dates without turning the database into a popularity ranking.

**A public evidence ledger.** Users will be able to read structured claims alongside their sources, caveats, scope, evidence strength, update history, and careful interpretation, then download the latest accepted records as structured data.

**Versioned structured releases.** Each dataset release has an immutable Schema, release-specific path, fixed release metadata, and deterministic JSON. A stable convenience URL can point to the newest immutable artifact without replacing it.

The repository now includes the static application foundation, Frontier Atlas design system, shared Stage 1 site shell, canonical data contracts, immutable publication revisions, validated release construction, Dataset `1.0.0` generation, the first three real evidence records, and the Stage 1 Homepage that presents those records. Entry, Methodology, About, Changelog, and export destination pages remain separate Stage 1 work.

## Why It Is Different

VyDex is not intended to be a daily newsletter, prediction market, leaderboard, or general technology-news feed. Those formats prioritize what is new, popular, or forecasted. VyDex instead focuses on whether a specific threshold-crossing claim is supported and how that judgment changes over time.

**History remains visible.** A later update should add context rather than erase the earlier assessment.

**Limits are part of the record.** Scope and caveats are treated as essential evidence, not footnotes to a headline.

**The public output stays portable.** Static pages and exports are designed to remain useful without a proprietary content service or runtime backend.

## Current Status

VyDex now has a real Stage 1 Homepage backed by the three canonical seed Entries. It explains the product, presents the Entry with the latest material activity, repeats that record intentionally at the head of a recent list, and introduces the Claim, Evidence, and Caveat reading model. The responsive page uses the shared Header, Footer, Entry Preview, and Frontier Atlas contracts and remains readable without browser JavaScript.

Entry ordering is deterministic across release resolution and the Homepage: latest material activity is dominant, Date Added breaks equal activity timestamps, and immutable Entry ID is the final fallback. Non-material revisions and title corrections do not move an Entry in these lists.

Production release metadata now has an explicit read-only application boundary. A production build loads `generated/release-data/release.json` and fails closed when that persisted descriptor is absent or invalid. Development, unit tests, browser tests, and conformance builds use fixed non-production metadata without writing a descriptor, reading the clock, or generating an ID. The future atomic release command remains the only owner allowed to create genuine descriptor state.

The repository also contains three Topic Trails and immutable revision-1 snapshots, the canonical About record, Methodology `1.0.0`, its publication event, deterministic release and Dataset `1.0.0` construction, the versioned Dataset Schema, and automated unit, responsive browser, keyboard, reduced-motion, overflow, and accessibility checks.

The Homepage is implemented on the latest branch, but the first genuine production descriptor and dataset artifact have not been created. Entry, Topic Trail, Methodology, About, Changelog, and export pages, publication persistence, deployment redirect emission, public revision browsing, and the atomic release command remain unimplemented. The [public site origin](https://vydex.vyce.workers.dev) is reserved for the later launch release.

## Major Milestones Roadmap

- **Stage 1 — Public Seed Ledger.** The initial evidence records, Topic Trails, Methodology, About content, revision-1 snapshots, Frontier Atlas interface foundation, shared site shell, reusable Entry Preview, and Stage 1 Homepage are complete. The remaining public destination pages, genuine dataset release, atomic release command, and deployment integration still need to be completed.
- **Stage 2 — Searchable Evidence Database.** Users can search real entries, filter by the evidence fields that matter, and understand why results are ordered as they are.
- **Stage 3 — Versioned Ledger and Citation.** Users can inspect entry history, open older versions, understand what changed, see which methodology version applied, and cite an exact version.

Roadmap wording describes direction, not released functionality. See the [changelog](docs/CHANGELOG.md) for what has actually changed.

## Links

- [VyDex website](https://vydex.vyce.workers.dev) — The public origin reserved for the Stage 1 release; the latest branch may be ahead of the deployed site.
- [Documentation](https://vyce101.github.io/VyDex/) — These docs track the latest `main` branch. Released app builds may not include every documented feature yet.
- [Quickstart](docs/QUICKSTART.md)
- [Changelog](docs/CHANGELOG.md) — Includes unreleased changes that are available only in the latest commits.

## License And Notices

VyDex uses a split-license structure:

- Application and site source code: [MIT License](LICENSE).
- Original database entries, methodology, reports, metadata, taxonomy, changelog records, and public data exports: [CC BY 4.0](CONTENT_LICENSE.md), unless otherwise noted.
- VyDex names, logos, social-preview images, and brand assets are not included in those licenses.

Third-party material remains subject to its original terms. See [NOTICE.md](NOTICE.md) for attribution and third-party font information. Final public-distribution legal review remains the project owner's responsibility.
