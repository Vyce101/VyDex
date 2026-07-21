# Repository Data Boundaries

VyDex separates authored records, immutable publication history, generated release data, and static site output. The domain contracts now exist in code, but the loaders and storage lifecycle for these repository locations remain future work.

- `data/canonical-records/` is reserved for canonical editable records. Their Entry, Topic Trail, and Methodology shapes are defined by `src/domain/canonical-records/`; no loader or authored production data exists yet.
- `data/publication-snapshots/` is reserved for immutable Entry publication snapshots. The snapshot storage schema exists, but snapshot creation, comparison, numbering, and publication behavior do not.
- `generated/release-data/` is reserved for generated release output. The current domain model defines only the persisted release ID and generation timestamp; release construction and generated manifests remain unimplemented.
- `dist/` contains generated static output from Astro and must not be used as canonical or historical storage.

These reserved data directories remain absent until their owning tickets add real content or generated output. The current schema ticket does not choose record filenames, tracking policy, loader behavior, or the persisted location of release metadata.

## Invariants

- Canonical editable records must not be written into immutable snapshot or generated output locations.
- Current canonical records and immutable publication snapshots remain separate storage classes.
- Generated release data and `dist/` are outputs, not authoring sources.
- Filesystem adapters and publication commands must call the framework-independent domain validators rather than duplicating record rules.
- Storage locations must not introduce titles, filenames, or slugs as relationship keys; durable relationships use UUIDv7 IDs.
