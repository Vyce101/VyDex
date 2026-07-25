# Repository Data Boundaries

VyDex separates authored records, immutable publication history, explicit release metadata, generated release data, and static site output. The canonical loader reads the authored and historical locations; it does not create, rename, rewrite, or delete their files.

## Authored Canonical Records

`data/canonical-records/` contains the editable inputs accepted by the loader:

- `entries/*.json` contains canonical editable Entries.
- `topic-trails/*.json` contains Topic Trails.
- `methodologies/*.json` contains Methodology versions.
- `about/about.json` is the only accepted About file.
- `methodology-publication-events/*.json` contains the separately authored Stage 1 Methodology event.

The loader reads only `.json` files. Filenames do not identify records or relationships; Entry, Topic Trail, and Methodology relationships use validated UUIDv7 values stored inside each record.

## Immutable Publication History

Entry snapshots live under:

```text
data/publication-snapshots/entries/{entry-id}/{revision-number}-{revision-id}.json
```

Snapshot loading is recursive only below `data/publication-snapshots/entries/`. The directory Entry ID and filename metadata must agree with the snapshot contents, while validated revision numbers determine history order. The loader never uses filesystem enumeration order, file modification time, or Git history as publication state.

The publication domain returns new immutable snapshots to its caller, but it does not persist them. Snapshot persistence remains the responsibility of a later publication command.

## Release Metadata and Generated Output

`PersistedReleaseDescriptor` is the application contract for the existing validated `ReleaseMetadata` shape. Its exact production path is:

```text
generated/release-data/release.json
```

The persisted-descriptor adapter resolves that path beneath an injected repository root, reads it without modification, parses JSON, and validates it with `releaseMetadataSchema`. Production page loading fails closed when the file is missing, unreadable, malformed, or schema-invalid. The canonical loader and framework-independent release constructor do not read or write the descriptor, and no ordinary build, development start, page render, or test generates a release ID or timestamp.

Development and explicit test-mode builds use a named adapter with stable non-production metadata. That adapter performs no writes, cannot be selected as a production fallback, and does not turn its constants into genuine release state. The separate Stage 1 descriptor adapter may create `release.json` only during the explicitly selected one-time bootstrap path. If the file already exists, the gate loads it without rewriting any bytes. It does not rotate the descriptor or begin a later release.

The release constructor returns one validated in-memory release model. [Dataset Generation](../documentation/concepts/dataset-generation.md) consumes that model, validates the public Dataset `1.0.0` projection against its Schema, and returns deterministic JSON plus immutable and stable-latest descriptors. The application export boundary prepares that artifact twice, rejects inconsistent output, and derives the [Export JSON Page](../documentation/concepts/stage-1-export-json-page.md) presentation model from the same generated dataset rather than a second metadata source.

The dataset artifact writer accepts an explicit output root and writes only the immutable release-specific dataset file beneath it. It creates missing parent directories, treats identical existing bytes as idempotent success, and refuses to overwrite different bytes. The writer does not choose `generated/release-data/`, `dist/`, or another repository location on its own.

Astro's release-specific dataset endpoint is a separate static-publication boundary. Development and test builds use the fixed non-production descriptor to prerender one dated artifact into `dist/` so the Export JSON download can be exercised. This build output is disposable and never becomes a genuine descriptor or durable release artifact. Ordinary production builds use only the persisted genuine descriptor and therefore fail before publication while that descriptor is absent.

`generated/release-data/` is reserved for durable release state owned by the Stage 1 release gate. The descriptor and internal `release-manifest.json` are committed inputs rather than disposable cache. Clean clones and CI require both files. Strict release mode verifies their shared identity and origin, regenerates the complete release, and rejects any manifest or file-inventory difference instead of creating new release state.

The gate builds into a unique ignored directory under `runtime/`, calls the artifact writer with that explicit staging root, and writes a Cloudflare `_redirects` file beside the staged site. It verifies the permanent slug aliases and stable-latest dataset redirect, then serves that same directory through a local Wrangler Pages process for browser checks. This local server does not create a mutable dataset copy or invoke a deployment workflow.

`dist/` contains generated Astro output, including the test-mode Export JSON artifact. The release gate may replace it only after the complete staged output passes verification. It must not be used as canonical, historical, durable release-artifact, or release-descriptor storage. Promotion temporarily backs up `dist/` and the internal manifest so a failure while replacing either resource can restore the previous successful pair.

## Hosting and Deployment State

[Cloudflare Pages Deployment](../documentation/concepts/cloudflare-pages-deployment.md) consumes a complete validated copy of `dist/`. GitHub Actions transfers that output between validation and deployment jobs as a workflow artifact retained for 30 days. The artifact is operational rollback support, not a canonical source of truth, and the deployment job verifies every downloaded byte against the committed manifest before upload.

Cloudflare Pages stores hosted deployments and their rollback history. That history can restore a previously successful production deployment, but it does not replace Git, canonical records, immutable snapshots, the lockfile, pinned toolchain, descriptor, or manifest. A preview hostname is not a public-origin record, and a Cloudflare rollback does not modify repository state.

The public site remains static HTML, CSS, JavaScript, and JSON. No Worker, Pages Function, runtime database, or Cloudflare-owned data store participates in record loading or page rendering.

Release logs are private runtime data under ignored `user/logs/`. Complete browser output is stored at ignored `runtime/browser-test-output.txt`, and Wrangler local state remains under ignored runtime storage or `.wrangler/`. These files may contain validation diagnostics and must never be copied into `dist/` or exposed through a public route.

## Invariants

- Canonical editable records, immutable snapshots, release descriptors, generated release data, and `dist/` remain separate storage classes.
- The canonical loader is read-only and accepts an injectable filesystem root for tests.
- The production descriptor loader reads exactly `generated/release-data/release.json` and never creates or substitutes it; only the Stage 1 descriptor adapter may create that file.
- CI requires both committed release files and never invokes the bootstrap identity path.
- Fixed development/test metadata remains non-production, deterministic, and write-free.
- Test-mode static artifact publication writes only to disposable Astro output and never persists its fixed metadata as genuine release state.
- Missing directories behave as empty collections; syntax and path failures return structured diagnostics with filenames.
- Current public Entry content comes from the newest valid immutable snapshot, not unpublished canonical Entry edits.
- Generated output must not be written into canonical-record or snapshot directories.
- Dataset output must remain under the injected writer root, and immutable paths must never overwrite different bytes.
- The Export JSON page and static artifact endpoint must consume one prepared application export from the selected release rather than reconstructing metadata independently.
- The internal manifest must describe the exact verified `dist/` inventory and must not be replaced after a failed release attempt.
- Release staging, browser output, Wrangler state, and logs remain ignored private data, while descriptor and manifest state remain separate from `dist/`.
- Workflow artifacts and Cloudflare deployment history remain operational copies rather than authoritative evidence or release metadata.
- Preview and production hosting use the production origin recorded by the committed manifest for canonical URLs.
- Storage paths and filenames must not replace durable IDs as relationship keys.
- Filesystem adapters call framework-independent validators rather than reproducing record rules.

See [Canonical Records](../documentation/concepts/canonical-records.md), [Publication Revisions](../documentation/concepts/publication-revisions.md), [Release Construction](../documentation/concepts/release-construction.md), [Stage 1 Release Gate](../documentation/concepts/stage-1-release-gate.md), [Cloudflare Pages Deployment](../documentation/concepts/cloudflare-pages-deployment.md), and the [Export JSON Page](../documentation/concepts/stage-1-export-json-page.md) for the contracts applied to these locations.
