<h1 align="center">VyDex</h1>

<p align="center">
  VyDex helps people follow important claims in AI, science, and technology by keeping the evidence, limits, and later updates together.
</p>

<p align="center">
  <a href="#current-status"><img alt="Current status: Stage 1 live" src="https://img.shields.io/badge/status-Stage%201%20live-0892D0" /></a>
  <a href="#what-it-does"><img alt="Build: static Astro site" src="https://img.shields.io/badge/build-static%20Astro-1B2430" /></a>
  <a href="#current-status"><img alt="Tests: Vitest, Playwright, and Axe" src="https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright%20%2B%20Axe-22C55E" /></a>
  <a href="#license-and-notices"><img alt="License: MIT and CC BY 4.0" src="https://img.shields.io/badge/license-MIT%20%2B%20CC%20BY%204.0-4A5568" /></a>
  <a href="https://vydex.pages.dev"><img alt="Website: vydex.pages.dev" src="https://img.shields.io/badge/site-vydex.pages.dev-0892D0" /></a>
  <a href="https://vyce101.github.io/VyDex/"><img alt="Documentation: Retype" src="https://img.shields.io/badge/docs-Retype-0892D0" /></a>
  <a href="docs/CHANGELOG.md"><img alt="Release status: no tagged release" src="https://img.shields.io/badge/release-no%20tagged%20release-7A90A4" /></a>
</p>

<p align="center">
  <img src="docs/assets/Social%20Preview%20(186KB).jpg" alt="VyDex — versioned evidence for frontier claims" width="900" />
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

Important frontier claims are often scattered across announcements, papers, articles, and later corrections. Readers, researchers, and builders then have to reconstruct what was claimed, what the evidence supports, and whether later information changed the conclusion. VyDex keeps that history in one evidence record.

## What It Does

**Maintains versioned evidence records.** Each Entry keeps the claim, evidence, scope, caveats, statuses, sources, and methodology context together. Immutable publication snapshots preserve the history behind the current record.

**Publishes a portable static ledger.** The public site is generated as HTML, CSS, JavaScript, and JSON from repository-controlled records. It does not require a runtime database, backend, Pages Function, or Worker.

**Produces deterministic data releases.** Each dataset release has a fixed release identity, an immutable Schema and export path, and a complete file manifest. A stable convenience URL can point to the latest immutable artifact without replacing it.

**Checks the release before and after publication.** Type checking, unit tests, release validation, static generation, sitemap completeness, Playwright journeys, and Axe checks must pass before deployment. The production workflow then checks the actual Pages routes, redirects, headers, canonical URLs, sitemap responses, Dataset, Schema, accessibility behavior, and no-JavaScript journeys.

Search, filtering, public Entry revision browsing, and exact historical citation remain planned capabilities rather than current Stage 1 behavior.

## Why It Is Different

VyDex is not a daily newsletter, prediction market, leaderboard, or general technology-news feed. Those formats organize information around recency, popularity, or forecasts. VyDex organizes it around a maintained claim and the evidence needed to assess it.

**History remains authoritative.** Current pages come from canonical records and immutable snapshots; generated hosting output and deployment history cannot replace them.

**Limits stay beside the claim.** Scope and caveats are part of the record rather than footnotes added after a conclusion.

**Hosting remains replaceable.** Cloudflare Pages serves complete static output, but it does not own release identity or the permanent evidence archive. A future custom domain can replace the Pages hostname without changing route paths or record IDs.

## Current Status

Stage 1 contains the Homepage, three public Entry pages, three Topic Trail pages, the material Changelog, Methodology `1.0.0`, the About and Scope Limits page, the Export JSON page, and a static not-found page. These surfaces share the Frontier Atlas design system and remain readable without browser JavaScript. Production builds also generate a complete sitemap index and child sitemap, and `robots.txt` advertises the production sitemap index.

The active committed release is successor `019fa023-d4fa-775e-af1f-25aa42de7cf9`, with canonical origin `https://vydex.pages.dev` and immutable export filename `vydex-latest-entry-versions-v1-0-0-2026-07-26.json`. The initial release `019f9b40-a3a8-75ad-b2b2-05a7100bcc34` and its July 25 Dataset remain retained in the committed history and immutable archive under `generated/release-data/`.

The release gate validates canonical records and snapshots, constructs one release model, builds into isolated runtime storage, verifies the Schema, export, routes, redirects, links, counts, and navigation, then runs the complete Playwright and Axe matrix against that exact staged output. A byte-based selection check first detects whether committed source changed the active public artifact; the explicit synchronization command creates a successor only when one is needed. Promotion replaces local `dist/` and the manifest only after every check succeeds.

Git-integrated Cloudflare Pages previews are enabled for repository changes. Production-branch automatic deployment is disabled in Cloudflare; the gated GitHub Actions workflow instead regenerates the committed release byte-for-byte, validates the sitemap files inside the complete `dist/` artifact before upload, waits for the matching Cloudflare production deployment to become canonical, and verifies `https://vydex.pages.dev`. If that hosted check fails and the previous deployment was verified as a matching known-good release, the workflow restores and verifies it.

A separate manually dispatched workflow rehearses production rollback under the protected GitHub `production` environment. It records two successful production deployment IDs for the same persisted release, verifies the earlier deployment after rollback, restores the intended deployment in unconditional cleanup, and verifies production again. It does not create another VyDex release identity.

Stage 1 is live at `https://vydex.pages.dev`. The initial production deployment passed the complete hosted verification suite, and the protected rollback rehearsal verified the earlier deployment, restored the intended deployment, and passed final verification. Public Entry revision browsing and search remain later work.

## Major Milestones Roadmap

- **Stage 1 — Public Seed Ledger.** Complete and live. The initial evidence records, Topic Trails, Methodology, About content, immutable Entry histories, Frontier Atlas interface, public pages, JSON export, release identity, gated Cloudflare Pages deployment, hosted verification, and protected rollback rehearsal have passed live acceptance.
- **Stage 2 — Searchable Evidence Database.** Users can search real Entries, filter by evidence fields, and understand why results are ordered as they are.
- **Stage 3 — Versioned Ledger and Citation.** Users can inspect Entry history, open older versions, see what changed, and cite an exact version with its applicable Methodology.

Roadmap wording describes direction, not released functionality. See the [changelog](docs/CHANGELOG.md) for implemented changes.

## Links

- [VyDex website](https://vydex.pages.dev) — The canonical public origin; the latest branch may be ahead of the deployed site.
- [Documentation](https://vyce101.github.io/VyDex/) — These docs track the latest `main` branch. Released app builds may not include every documented change yet.
- [Quickstart](docs/QUICKSTART.md)
- [Changelog](docs/CHANGELOG.md) — Includes unreleased changes available only in the latest commits.
- [License](LICENSE)

## License And Notices

VyDex uses a split-license structure:

- Application and site source code: [MIT License](LICENSE).
- Original database entries, methodology, reports, metadata, taxonomy, changelog records, and public data exports: [CC BY 4.0](CONTENT_LICENSE.md), unless otherwise noted.
- VyDex names, logos, social-preview images, and brand assets are not included in those licenses.

Third-party material remains subject to its original terms. See [NOTICE.md](NOTICE.md) for attribution and third-party font information. Final public-distribution legal review remains the project owner's responsibility.
