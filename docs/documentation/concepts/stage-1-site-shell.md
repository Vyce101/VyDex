---
label: Stage 1 Site Shell
order: 800
---

# Stage 1 Site Shell

The Stage 1 site shell gives every public page the same Header, Main, and Footer structure. It owns the navigation behavior shared by the implemented [Stage 1 Homepage](stage-1-homepage.md), [Stage 1 About Page](stage-1-about-page.md), [Stage 1 Changelog Page](stage-1-changelog-page.md), [Stage 1 Entry Page](stage-1-entry-page.md), [Stage 1 Methodology Page](stage-1-methodology-page.md), [Stage 1 Topic Trail Page](stage-1-topic-trail-page.md), and generic not-found page. This page is for maintainers and coding agents changing shared layout, navigation, document metadata, or page-level accessibility.

## Purpose and Ownership

The shell prevents pages from rebuilding shared navigation or changing the document order. It owns:

- The skip link, Header, Main, and Footer order rendered by `FoundationLayout.astro`.
- Optional canonical-link output supplied by individual routes.
- The Header and Footer link labels and their required order.
- Route-to-active-navigation mapping for Methodology, About, Changelog, and Export JSON.
- The desktop Header and native mobile navigation disclosure.
- Escape-key closing and focus return as progressive enhancement.
- Contextual accessible names for repeated Footer links.
- Shared alignment between the Header, Main content, and Footer.

It does not own:

- The canonical path values, which belong to route generation.
- Page content or the data each Stage 1 route renders.
- Whether a destination is ready for production publication.
- Frontier Atlas colors, typography tokens, focus treatment, or responsive breakpoints.
- Release construction, deployment redirects, or the future atomic release gate.
- Browser telemetry, analytics, or persistent client logging.

## Normal Flow

1. A page renders through `FoundationLayout.astro` and supplies its title, main content, and an optional canonical URL.
2. The layout reads `Astro.url.pathname` and asks the site-shell navigation module for the active navigation key.
3. The layout renders the skip link, shared Header, one focusable Main region, and shared Footer in that order.
4. At 768px and wider, the Header shows the wordmark and desktop navigation. Narrower viewports show the wordmark and a closed native `details` disclosure labelled `Menu`.
5. The browser can open and close the mobile disclosure without JavaScript. A small enhancement listens for Escape, closes an open disclosure, and returns focus to its `summary`.
6. Page content remains inside the layout-owned Main region. Homepage, About, Changelog, Entry, Methodology, Topic Trail, not-found, and later Stage 1 page modules consume the same layout instead of importing the Header or Footer directly.

## Inputs and Output Contract

The shell receives the current pathname from Astro, page content through the layout slot, and an optional route-owned canonical URL. The active-state helper returns `methodology`, `about`, `changelog`, `export`, or no active key.

The output is static semantic HTML with one Header, one Main region, and one Footer. When a route supplies a canonical URL, the layout emits one canonical link in the document head. The only client script enhances Escape-key behavior; it does not reveal links, create navigation, or control page visibility.

## User-Facing Behavior

The desktop Header links appear in this order: Latest, Methodology, About, Changelog, and Export JSON. The wordmark links to `/`, while Latest links to `/#latest`; Latest never has an active state. The mobile disclosure exposes the same links in the same order.

Methodology is active on `/methodology/` and `/methodology/1.0.0/`. About, Changelog, and Export JSON are active only on their matching routes. The Homepage, Entry pages, and Topic Trail pages have no active Header link.

The Footer contains the approved ledger description followed by About, Methodology, Changelog, and Export JSON. Footer links use contextual accessible names so assistive technology can distinguish them from repeated Header links.

The skip link is the first keyboard stop and becomes visible when focused. Activating it moves focus to `#main-content`. Normal focus order then follows the wordmark, Header links or Menu control, main content, and Footer links.

## Internal Edge Cases

- A URL fragment is not part of `Astro.url.pathname`, so `/#latest` resolves to the Homepage pathname and still produces no active link.
- Desktop and mobile navigation use the same ordered item collection. CSS exposes only the version for the current breakpoint, which prevents hidden duplicate links from entering keyboard order.
- The mobile disclosure has no `open` attribute in its initial markup, so it defaults closed even when the enhancement script fails.
- The mobile Header grows to place the open link list below its 60px closed row. It does not cover the page with an overlay.
- Escape only adds closing and focus return. Native disclosure operation remains the fallback when JavaScript is disabled or fails to load.

## Cross-System Edge Cases

- [Release Construction](release-construction.md) and route generation own canonical paths. The shell imports the fixed Stage 1 path map instead of maintaining a second set of destination strings.
- [Frontier Atlas](frontier-atlas-design-system.md) owns the colors, type roles, focus outline, page margins, and 768px breakpoint. The shell composes those primitives but does not replace them.
- [Static Application Foundation](static-application-foundation.md) owns the Astro document boundary and build process. The shell is rendered through that boundary and remains static-first.
- The [Stage 1 Methodology Page](stage-1-methodology-page.md) supplies different self-canonical URLs for its current and immutable routes while reusing the same shell and active navigation state.
- The [Stage 1 About Page](stage-1-about-page.md) supplies its self-canonical URL and uses the route-derived active About state on `/about/`.
- The [Stage 1 Changelog Page](stage-1-changelog-page.md) supplies its self-canonical URL and uses the route-derived active Changelog state on `/changelog/`.
- The [Stage 1 Homepage](stage-1-homepage.md), [Stage 1 Entry Page](stage-1-entry-page.md), [Stage 1 Topic Trail Page](stage-1-topic-trail-page.md), and generic not-found page use no active navigation item. Export remains future page work even though the shell already links to its canonical destination.
- The future atomic release gate must reject unresolved navigation destinations before production. The shell does not weaken that release requirement during the current intermediate development state.

## Failure Behavior

A failed enhancement script leaves the disclosure closed but usable through native HTML. It must not hide main content, disable desktop navigation, or remove any destination.

Source and browser tests fail when link order or destinations drift, active-state mapping changes, focus cannot reach or leave the disclosure, Escape does not return focus, the no-JavaScript path breaks, or the shell causes horizontal overflow. Destination availability is a release concern rather than a client-side shell recovery path.

## Invariants

- `FoundationLayout.astro` owns the skip link, Header, Main, and Footer order.
- Pages provide main content and do not compose their own Stage 1 shell.
- Routes that require canonical metadata supply it through the layout rather than writing a second document head.
- Navigation destinations come from the canonical fixed route map.
- Latest remains a Homepage anchor and never becomes an active page link.
- Mobile navigation remains reachable without JavaScript.
- The disclosure is not a modal, dialog, menubar, full-screen overlay, or focus trap.
- The Header remains non-sticky and the Footer remains in normal document flow.
- The shell uses Frontier Atlas tokens and the shared page boundary.
- The shell adds no telemetry, production console logging, or persistent client logging.

## Implementation Landmarks

- `src/layouts/FoundationLayout.astro` — Page-facing document and shell entry point.
- `src/components/site-shell/` — Header, Footer, ordered navigation definitions, and active-state logic.
- `src/styles/site-shell.css` — Responsive shell presentation and skip-link behavior.
- `src/domain/route-generation/` — Canonical fixed Stage 1 path ownership.
- `tests/foundation/site-shell-navigation.test.ts` — Destination, order, and active-route contracts.
- `tests/browser/site-shell.spec.ts` — Responsive, keyboard, no-JavaScript, focus, and accessibility behavior.

## Before Changing the Site Shell

Check:

- Whether the change preserves the canonical destination map and exact link order.
- Whether Homepage, Entry, Topic Trail, and Latest states remain inactive.
- Whether About remains active only on `/about/` and continues to receive its canonical URL from the route.
- Whether Changelog remains active only on `/changelog/` and continues to receive its canonical URL from the route.
- Whether the generic not-found page retains the same shell without inventing an Entry-specific recovery state.
- Whether native disclosure behavior still works with JavaScript disabled.
- Whether Escape closes the disclosure and returns focus without creating a focus trap.
- Whether the skip link still focuses the single Main region.
- Whether both responsive variants retain the approved dimensions, focus treatment, and page-grid alignment.
- Whether repeated visible links retain contextual accessible names.
- Whether routes with canonical requirements still supply one correct absolute URL to the layout.
- Whether source, route-matrix, browser, Axe, and horizontal-overflow tests cover the change.

Read [Frontier Atlas](frontier-atlas-design-system.md) before changing shell presentation and [Static Application Foundation](static-application-foundation.md) before changing the layout or client-script boundary.
