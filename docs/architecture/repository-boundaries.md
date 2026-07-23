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

`ReleaseMetadata` is an explicit release-constructor input. The canonical loader does not read, create, or persist a release descriptor, and neither the constructor nor the dataset generator creates a release ID or timestamp. A later atomic release command will own descriptor creation, reuse, and persistence.

The release constructor returns one validated in-memory release model. [Dataset Generation](../documentation/concepts/dataset-generation.md) consumes that model, validates the public Dataset `1.0.0` projection against its Schema, and returns deterministic JSON plus immutable and stable-latest descriptors.

The dataset artifact writer accepts an explicit output root and writes only the immutable release-specific dataset file beneath it. It creates missing parent directories, treats identical existing bytes as idempotent success, and refuses to overwrite different bytes. The writer does not choose `generated/release-data/`, `dist/`, or another repository location on its own.

`generated/release-data/` remains reserved for a future atomic release command to use as generated release output. That command will also own stable-latest deployment redirect emission and verification. The current writer does not create a mutable latest copy or a Cloudflare `_redirects` file.

`dist/` contains generated Astro output. It must not be used as canonical, historical, or release-descriptor storage.

## Invariants

- Canonical editable records, immutable snapshots, release descriptors, generated release data, and `dist/` remain separate storage classes.
- The canonical loader is read-only and accepts an injectable filesystem root for tests.
- Missing directories behave as empty collections; syntax and path failures return structured diagnostics with filenames.
- Current public Entry content comes from the newest valid immutable snapshot, not unpublished canonical Entry edits.
- Generated output must not be written into canonical-record or snapshot directories.
- Dataset output must remain under the injected writer root, and immutable paths must never overwrite different bytes.
- Storage paths and filenames must not replace durable IDs as relationship keys.
- Filesystem adapters call framework-independent validators rather than reproducing record rules.

See [Canonical Records](../documentation/concepts/canonical-records.md), [Publication Revisions](../documentation/concepts/publication-revisions.md), and [Release Construction](../documentation/concepts/release-construction.md) for the contracts applied to these locations.
