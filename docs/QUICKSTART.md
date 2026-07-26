# Quickstart

## Requirements

- **Operating system:** Windows, macOS, or Linux. Windows also includes `setup_and_run.bat`.
- **Node.js:** `24.11.1`
- **npm:** `11.6.2`
- **Local services:** None. VyDex does not require a backend, database, CMS, Worker, or Pages Function.
- **API keys:** None for local development or tests. Cloudflare credentials are required only for the protected production deployment job.
- **Hardware:** No special hardware is required. Browser testing downloads Chromium and needs additional disk space.

## Git Commands

Run commands from the repository root, which contains `package.json`.

Clone the repository:

```powershell
git clone https://github.com/Vyce101/VyDex.git
cd VyDex
```

Pull later changes without creating a merge commit:

```powershell
git pull --ff-only
```

On Windows, `update.bat` performs the same fast-forward update and stops before fetching when local changes are present.

## Install

Install the dependency versions recorded in the lockfile:

```powershell
npm ci
```

## Run VyDex

Start the local Astro application:

```powershell
npm run dev
```

Open `http://127.0.0.1:4321/`. Development uses fixed non-production metadata and does not write production release state.

On Windows, `setup_and_run.bat` can install missing dependencies, start Astro, wait for the page to respond, and open it in your browser.

## Verify The Installation

Run the non-production validation build:

```powershell
npm run build:test
```

This command runs type checking and unit tests, generates deterministic test output, and verifies that `dist/sitemap-index.xml`, `dist/sitemap-0.xml`, and `dist/robots.txt` describe exactly the generated public HTML pages at the production origin. It does not create or modify the production release descriptor or manifest.

Install Chromium once, then run the responsive browser and accessibility suite:

```powershell
npm run test:browser:install
npm run test:browser
```

The browser command uses the reserved `https://vydex.example` test origin, writes disposable output to ignored `dist/`, serves it through the pinned Wrangler Pages development server, and runs the Playwright and Axe checks.

## Keep The Active Release In Sync

After committing application, content, metadata, dependency, or build changes, check whether current `HEAD` still produces the active release's exact public artifact:

```powershell
npm run release:check
```

The read-only check requires a clean branch. It builds current source with the active descriptor in ignored runtime storage and compares the complete result with the committed manifest. Test-only and documentation-only commits pass when public bytes are unchanged.

When public bytes changed, synchronize release selection with one command:

```powershell
npm run release:sync -- --confirm CREATE_NEXT_RELEASE
```

The sync command repeats the byte comparison. It exits without creating identity when the active artifact is already current; otherwise it runs the verified successor-release workflow and leaves descriptor, manifest, history, archive, and `dist/` changes for review. It never commits, pushes, or deploys. CI runs the read-only check before release reproduction and blocks stale selection with the same remediation command.

## Reproduce The Active Release

The authoritative release origin is `https://vydex.pages.dev`. Set it before running production validation.

PowerShell:

```powershell
$env:PUBLIC_SITE_ORIGIN = "https://vydex.pages.dev"
npm run release:ci
```

macOS or Linux:

```bash
export PUBLIC_SITE_ORIGIN="https://vydex.pages.dev"
npm run release:ci
```

The strict command requires both committed files:

```text
generated/release-data/release.json
generated/release-data/release-manifest.json
generated/release-data/release-history.json
generated/release-data/releases/{release-id}/
```

It checks that the descriptor, manifest, and configured origin agree; runs type checking and the complete Vitest suite; builds into isolated runtime storage; verifies every static surface; and runs Playwright and Axe against the staged output. The complete file inventory, including sitemap files and `robots.txt` for sitemap-enabled releases, is compared with committed release state. A mismatch returns a non-zero result instead of creating a new release identity.

On success, the terminal prints the release ID, generation timestamp, immutable export filename, manifest path, and `dist/` location. You can also read the release ID from `generated/release-data/release.json` and the export filename from `generated/release-data/release-manifest.json`.

`npm run release:stage-1:ci` remains a compatibility alias. It does not bootstrap or rotate identity.

## Create The Next Release

For normal committed changes, prefer `release:sync` so unchanged public output does not create unnecessary release identity. Use the direct next-release command when a successor is intentionally required regardless of the preliminary comparison.

First commit the accepted canonical records, Topic Trails, Methodology records, and authoritative Entry publication snapshots. From that clean, non-detached branch run:

```powershell
npm run release:next -- --confirm CREATE_NEXT_RELEASE
```

The command captures the clean `HEAD` as `source_commit`, verifies the active release, creates and verifies one successor, retains historical immutable Dataset routes, and leaves generated release state for review and a separate commit. It does not deploy, commit, tag, or push.

A failed release leaves the previous successful `dist/` and manifest unchanged. Private diagnostics appear in the terminal and rotating ignored files under `user/logs/`; complete test output remains under ignored `runtime/` storage.

For production rollback instructions, see [How To Redeploy A Complete Stage 1 Release](documentation/guides/how-to-redeploy-stage-1-release.md). For the hosting and validation boundaries, see [Cloudflare Pages Deployment](documentation/concepts/cloudflare-pages-deployment.md).

## Downloading The Latest Installation

1. Open the [VyDex repository](https://github.com/Vyce101/VyDex).
2. Select **Code**, then **Download ZIP**.
3. Unzip the downloaded archive.
4. On Windows, run `setup_and_run.bat`. On macOS or Linux, open a terminal in the extracted folder, then run the install and run commands above.
