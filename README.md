<h1 align="center">VyDex</h1>

<p align="center">
  <img src="docs/assets/Social%20Preview%20(186KB).jpg" alt="VyDex — versioned evidence for frontier claims" width="900" />
</p>

---

<p align="center">
  VyDex helps people follow important claims in AI, science, and technology by keeping the supporting evidence, limits, and later updates together.
</p>

<p align="center">
  <a href="#current-status"><img alt="Current status: release model foundation" src="https://img.shields.io/badge/status-release%20model%20foundation-0892D0" /></a>
  <a href="#what-it-does"><img alt="Build: static Astro site" src="https://img.shields.io/badge/build-static%20Astro-1B2430" /></a>
  <a href="#current-status"><img alt="Tests: Vitest and Playwright configured" src="https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-22C55E" /></a>
  <a href="#license-and-notices"><img alt="License: MIT and CC BY 4.0" src="https://img.shields.io/badge/license-MIT%20%2B%20CC%20BY%204.0-4A5568" /></a>
  <a href="https://vyce101.github.io/VyDex/"><img alt="Documentation: Retype" src="https://img.shields.io/badge/docs-Retype-0892D0" /></a>
  <a href="docs/CHANGELOG.md"><img alt="Release status: unreleased" src="https://img.shields.io/badge/release-unreleased-7A90A4" /></a>
</p>

---

## Table of Contents

- [What It Solves](#what-it-solves)
- [What It Does](#what-it-does)
- [Why It Is Different](#why-it-is-different)
- [Current Status](#current-status)
- [Major Milestones Roadmap](#major-milestones-roadmap)
- [Links](#links)
- [License And Notices](#license-and-notices)

---

## What It Solves

Important frontier claims are often scattered across announcements, papers, articles, and later corrections. That makes it difficult for readers, researchers, and builders to tell what was claimed, what the evidence supports, and whether the conclusion still holds after new information appears. VyDex exists to keep that history together.

## What It Does

VyDex is designed to preserve claims as evidence records rather than short-lived posts.

**Versioned records and citations.** Users will be able to see how an entry changed, inspect older versions, identify the methodology used at the time, and cite either the current record or a specific historical version.

**Searchable evidence.** Users will be able to search claims and narrow the results using fields such as topic, status, evidence strength, review state, and dates without turning the database into a popularity ranking.

**A public evidence ledger.** Users will be able to read structured claims alongside their sources, caveats, scope, evidence strength, update history, and careful interpretation, then download the latest accepted records as structured data.

These product capabilities describe the intended VyDex system. The repository now includes the static application foundation, canonical data contracts, immutable publication revisions, and validated release construction needed to build them, but it does not yet provide the Stage 1 public interface.

## Why It Is Different

VyDex is not intended to be a daily newsletter, prediction market, leaderboard, or general technology-news feed. Those formats prioritize what is new, popular, or forecasted. VyDex instead focuses on whether a specific threshold-crossing claim is supported and how that judgment changes over time.

**History remains visible.** A later update should add context rather than erase the earlier assessment.

**Limits are part of the record.** Scope and caveats are treated as essential evidence, not footnotes to a headline.

**The public output stays portable.** Static pages and exports are designed to remain useful without a proprietary content service or runtime backend.

---

## Current Status

VyDex is at the release-model foundation stage. The repository can install pinned dependencies, type-check, run its domain and foundation tests, produce a static Astro build, and run responsive browser and accessibility checks. Its framework-independent domain layer defines strict contracts for Entries, Topic Trails, Methodologies, About content, Entry publication snapshots, Methodology publication events, and release metadata. It validates revision histories, constructs detached immutable snapshots, enforces materiality and alias-history rules, and derives current and meaningful activity dates.

The read-only canonical loader and deterministic release constructor now validate repository records, select current published snapshots, resolve Topic Trail membership, construct canonical URLs and redirect descriptors, derive the public Changelog, and prepare the versioned dataset model. Strict production returns no release when a blocking diagnostic exists; private preview retains invalid source records without treating them as valid public data.

The current `/` route is still a technical fixture, not the Stage 1 homepage. No production content has been authored or published yet. Publication commands, snapshot persistence, public pages, dataset serialization, deployment redirect emission, public revision browsing, and the atomic release command remain unimplemented. The Astro application is intended for Cloudflare Pages, but deployment configuration and the final public origin are deliberately deferred.

## Major Milestones Roadmap

- **Stage 1 — Public Seed Ledger.** Users can understand VyDex, read a small set of complete evidence records, inspect the methodology and sources, follow Topic Trails, and export the latest structured dataset.
- **Stage 2 — Searchable Evidence Database.** Users can search real entries, filter by the evidence fields that matter, and understand why results are ordered as they are.
- **Stage 3 — Versioned Ledger and Citation.** Users can inspect entry history, open older versions, understand what changed, see which methodology version applied, and cite an exact version.

Roadmap wording describes direction, not released functionality. See the [changelog](docs/CHANGELOG.md) for what has actually changed.

---

## Links

- [Documentation](https://vyce101.github.io/VyDex/) — These docs track the latest `main` branch. Released app builds may not include every documented feature yet.
- [Quickstart](docs/QUICKSTART.md)
- [Changelog](docs/CHANGELOG.md) — Includes unreleased changes that are available only in the latest commits.

## License And Notices

VyDex uses a split-license structure:

- Application and site source code: [MIT License](LICENSE).
- Original database entries, methodology, reports, metadata, taxonomy, changelog records, and public data exports: [CC BY 4.0](CONTENT_LICENSE.md), unless otherwise noted.
- VyDex names, logos, social-preview images, and brand assets are not included in those licenses.

Third-party material remains subject to its original terms. See [NOTICE.md](NOTICE.md) for attribution and third-party font information. Final public-distribution legal review remains the project owner's responsibility.
