<h1 align="center">VyDex</h1>

<p align="center">
  <img src="docs/assets/Social%20Preview%20(186KB).jpg" alt="VyDex — versioned evidence for frontier claims" width="900" />
</p>

<p align="center">
  VyDex helps people follow important claims in AI, science, and technology by keeping the supporting evidence, limits, and later updates together.
</p>

<p align="center">
  <a href="#current-status"><img alt="Current status: Stage 1 seed data ready" src="https://img.shields.io/badge/status-Stage%201%20seed%20data%20ready-0892D0" /></a>
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

These product capabilities describe the intended VyDex system. The repository now includes the static application foundation, canonical data contracts, immutable publication revisions, validated release construction, Dataset `1.0.0` generation, and the first three real evidence records. It does not yet provide the Stage 1 public interface.

## Why It Is Different

VyDex is not intended to be a daily newsletter, prediction market, leaderboard, or general technology-news feed. Those formats prioritize what is new, popular, or forecasted. VyDex instead focuses on whether a specific threshold-crossing claim is supported and how that judgment changes over time.

**History remains visible.** A later update should add context rather than erase the earlier assessment.

**Limits are part of the record.** Scope and caveats are treated as essential evidence, not footnotes to a headline.

**The public output stays portable.** Static pages and exports are designed to remain useful without a proprietary content service or runtime backend.

## Current Status

VyDex has completed the Stage 1 seed-data foundation. The repository contains three real Entries, their three Topic Trails, and immutable revision-1 snapshots, alongside the canonical About record, Methodology `1.0.0`, and its publication event. The framework-independent domain layer defines strict contracts for those records, release metadata, and the public Dataset `1.0.0` format.

The read-only canonical loader and deterministic release constructor validate the repository records, select current published snapshots, resolve Topic Trail membership, construct canonical URLs and redirect descriptors, and derive the public Changelog. An integration test proves that the seed ledger can construct a complete production release using fixed test-only metadata and the approved site origin. Strict production still returns no release when a blocking diagnostic exists; private preview retains invalid source records without treating them as public data.

Dataset generation now consumes only a validated production release. It projects current public Entries into deterministic JSON, validates the result against the origin-specific immutable Schema, derives the release artifact and stable-latest redirect descriptors, and can write the immutable file beneath an injected output root without overwriting different bytes. Astro publishes the versioned Schema at `/schemas/vydex-dataset/1.0.0.json`, and CI verifies the static output with a frozen dependency install.

The current `/` route is still a technical fixture, not the Stage 1 homepage. The seed content is stored and validated, but the public application does not render it and no genuine release descriptor or dataset artifact has been published. Reusable publication persistence, public pages, deployment redirect emission, public revision browsing, and the atomic release command remain unimplemented. The [public site origin](https://vydex.vyce.workers.dev) is configured for the later launch release.

## Major Milestones Roadmap

- **Stage 1 — Public Seed Ledger.** The initial evidence records, Topic Trails, Methodology, About content, and revision-1 snapshots are now stored and validated. Public pages, the genuine dataset release, and deployment integration remain to be completed.
- **Stage 2 — Searchable Evidence Database.** Users can search real entries, filter by the evidence fields that matter, and understand why results are ordered as they are.
- **Stage 3 — Versioned Ledger and Citation.** Users can inspect entry history, open older versions, understand what changed, see which methodology version applied, and cite an exact version.

Roadmap wording describes direction, not released functionality. See the [changelog](docs/CHANGELOG.md) for what has actually changed.

## Links

- [VyDex website](https://vydex.vyce.workers.dev) — The current public site; the Stage 1 interface remains under development.
- [Documentation](https://vyce101.github.io/VyDex/) — These docs track the latest `main` branch. Released app builds may not include every documented feature yet.
- [Quickstart](docs/QUICKSTART.md)
- [Changelog](docs/CHANGELOG.md) — Includes unreleased changes that are available only in the latest commits.

## License And Notices

VyDex uses a split-license structure:

- Application and site source code: [MIT License](LICENSE).
- Original database entries, methodology, reports, metadata, taxonomy, changelog records, and public data exports: [CC BY 4.0](CONTENT_LICENSE.md), unless otherwise noted.
- VyDex names, logos, social-preview images, and brand assets are not included in those licenses.

Third-party material remains subject to its original terms. See [NOTICE.md](NOTICE.md) for attribution and third-party font information. Final public-distribution legal review remains the project owner's responsibility.
