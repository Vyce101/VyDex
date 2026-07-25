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

The persisted-descriptor adapter resolves that path beneath an injected repository root, reads it without modification, parses JSON, and validates it with `releaseMetadataSchema`. Production fails closed when the file is missing, unreadable, malformed, or schema-invalid. The canonical loader and framework-independent release constructor do not read or write the descriptor, and no ordinary build, development start, page render, or test generates a release ID or timestamp.

Development and explicit test-mode builds use a named adapter with stable non-production metadata. That adapter performs no writes, cannot be selected as a production fallback, and does not turn its constants into genuine release state. A later atomic release command remains the sole owner of creating or loading a genuine descriptor for a new release.

The release constructor returns one validated in-memory release model. [Dataset Generation](../documentation/concepts/dataset-generation.md) consumes that model, validates the public Dataset `1.0.0` projection against its Schema, and returns deterministic JSON plus immutable and stable-latest descriptors.

The dataset artifact writer accepts an explicit output root and writes only the immutable release-specific dataset file beneath it. It creates missing parent directories, treats identical existing bytes as idempotent success, and refuses to overwrite different bytes. The writer does not choose `generated/release-data/`, `dist/`, or another repository location on its own.

`generated/release-data/` is reserved for durable release state owned by the future atomic release command. The directory and descriptor path are not ignored as disposable cache. Once the command creates a genuine descriptor, it must remain available to clean clones, CI jobs, and later rebuilds; under the current architecture it remains eligible to be checked in with the release artifacts unless a separate durable artifact store is introduced.

The future command will also own stable-latest deployment redirect emission and verification. The current writer does not create a mutable latest copy or a Cloudflare `_redirects` file.

`dist/` contains generated Astro output. It must not be used as canonical, historical, or release-descriptor storage.

## Invariants

- Canonical editable records, immutable snapshots, release descriptors, generated release data, and `dist/` remain separate storage classes.
- The canonical loader is read-only and accepts an injectable filesystem root for tests.
- The production descriptor loader reads exactly `generated/release-data/release.json` and never creates or substitutes it.
- Fixed development/test metadata remains non-production, deterministic, and write-free.
- Missing directories behave as empty collections; syntax and path failures return structured diagnostics with filenames.
- Current public Entry content comes from the newest valid immutable snapshot, not unpublished canonical Entry edits.
- Generated output must not be written into canonical-record or snapshot directories.
- Dataset output must remain under the injected writer root, and immutable paths must never overwrite different bytes.
- Storage paths and filenames must not replace durable IDs as relationship keys.
- Filesystem adapters call framework-independent validators rather than reproducing record rules.

See [Canonical Records](../documentation/concepts/canonical-records.md), [Publication Revisions](../documentation/concepts/publication-revisions.md), and [Release Construction](../documentation/concepts/release-construction.md) for the contracts applied to these locations.
