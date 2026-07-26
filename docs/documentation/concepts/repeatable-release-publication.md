---
label: Repeatable Release Publication
order: 1400
---

# Repeatable Release Publication

VyDex separates rebuilding a committed release from creating its successor. Both workflows are static, repository-controlled, and all-or-nothing. Neither workflow deploys, commits, tags, or pushes.

## Durable State

The active descriptor and manifest remain at `generated/release-data/release.json` and `generated/release-data/release-manifest.json`. The versioned `release-history.json` and `releases/{release-id}/` archive retain byte-identical descriptors and manifests plus immutable Dataset and Schema bytes at their public path layout.

Each archive has an internal immutable-public contract recording path, hash, byte length, content type, immutable cache policy, and download behavior. A later build copies earlier artifacts into `dist/` without regenerating or rewriting them.

## Reproduce The Active Release

Run `npm run release:ci`. The compatibility command `npm run release:stage-1:ci` invokes the same workflow.

Reproduction loads all committed state, validates every archive and source commit, reconstructs the active release from its recorded source, runs static, browser, and Axe verification, compares the complete manifest and inventory, and replaces only ignored `dist/`. It never calls the clock or UUID generator.

CI fetches full Git history because every `source_commit` must exist and be an ancestor of the commit being reproduced.

## Create The Next Release

Complete and commit authoring before release construction:

```text
Author or revise a canonical record
→ publish its authoritative immutable Entry snapshot
→ review all accepted ledger inputs
→ create the next complete release
```

From a clean, non-detached branch run:

```powershell
npm run release:next -- --confirm CREATE_NEXT_RELEASE
```

The command captures `HEAD`, verifies the active release, creates one UUIDv7 and one later UTC timestamp, builds and verifies a candidate under ignored runtime storage, retains historical immutable routes, and promotes one local transaction. It leaves descriptor, manifest, history, and archive changes for review and a later commit.

It does not publish Entry snapshots, repair records, invent Changelog events, run Wrangler, deploy, commit, tag, push, or mutate GitHub.

## Source Commit Semantics

For Release 2 onward, `source_commit` is the clean repository input commit captured at the start of `release:next`. It contains the code, canonical records, publication snapshots, Methodology records, Topic Trails, and other repository-controlled inputs consumed during construction.

It is not the later commit containing generated release state. Embedding that commit would be circular because changing the files changes the commit SHA. Deployment evidence separately records the GitHub Actions commit and Cloudflare deployment ID.

Stage 1 is the migration exception. Its source is `655b7c8bf4a8b5cbb88bbc9427735084c5f19973`, the first commit containing its final descriptor, corrected inventory, and reproducible public bytes. Multiple later commits and Cloudflare deployments may reproduce the same VyDex Release ID.

The later repository commit `e774b55f3a164411b6b0c0e32c99713966c64de3` belongs in Stage 1 deployment or rollback evidence when that operational run is described. It does not replace the archived Stage 1 `source_commit`.

## Failure And Recovery

`release:next` holds an exclusive runtime lock and rechecks branch, `HEAD`, clean status, inputs, and active-state bytes before promotion. Promotion journals and backs up the prior descriptor, manifest, history, and `dist/`. A failed selection restores previous state and leaves no authoritative partial release.

After a failed deployment, repository state may be newer than production. The workflow identifies the hosted Release ID, verifies it against its matching archive, deploys committed active `dist/`, and restores the verified earlier Cloudflare deployment if verification fails. Cloudflare history is operational support, not the permanent release archive.

## Invariants

- The stable latest Dataset path is a redirect to the active immutable Dataset.
- Earlier Dataset and Schema routes retain paths, bytes, headers, and download behavior.
- Current pages and latest-entry data use accepted records and authoritative snapshots only.
- Manifests and history remain internal; no public archive browser or API exists.
- Local construction, Git commit, CI reproduction, deployment, and hosted verification are separate boundaries.

## Related Pages

- [Release Construction](release-construction.md)
- [Dataset Generation](dataset-generation.md)
- [Cloudflare Pages Deployment](cloudflare-pages-deployment.md)
- [Hosted Release Verification](hosted-release-verification.md)
