# Repository Data Boundaries

VyDex separates authored records, immutable publication history, generated release data, and static site output. The domain layer defines the record contracts and pure Entry publication behavior, while loaders and the storage lifecycle for these repository locations remain future work.

- `data/canonical-records/` is reserved for canonical editable records. Their Entry, Topic Trail, and Methodology shapes are defined by `src/domain/canonical-records/`; no loader or authored production data exists yet.
- `data/publication-snapshots/` is reserved for immutable Entry publication snapshots. The storage schema and pure domain operations for creation, comparison, numbering, materiality, and activity derivation exist. No adapter currently writes returned snapshots to this location.
- `generated/release-data/` is reserved for generated release output. The current domain model defines only the persisted release ID and generation timestamp; release construction and generated manifests remain unimplemented.
- `dist/` contains generated static output from Astro and must not be used as canonical or historical storage.

These reserved data directories remain absent until their owning tickets add real content or generated output. The publication domain operation does not choose record filenames, tracking policy, loader behavior, or persisted locations.

## Invariants

- Canonical editable records must not be written into immutable snapshot or generated output locations.
- Current canonical records and immutable publication snapshots remain separate storage classes.
- A successful domain publication returns a snapshot to its caller; it does not persist that snapshot or create a storage directory.
- Generated release data and `dist/` are outputs, not authoring sources.
- Filesystem adapters and publication commands must call the framework-independent domain validators rather than duplicating record rules.
- Storage locations must not introduce titles, filenames, or slugs as relationship keys; durable relationships use UUIDv7 IDs.
