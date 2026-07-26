// Verifies complete four-Entry and material-revision fixtures across successor releases.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { loadCanonicalRecords, type LoadedCanonicalRecords } from "../../src/adapters/canonical-record-loader";
import {
  constructReleaseModel,
  releaseHistorySchema,
  type CanonicalRecordSource,
  type Entry,
  type EntryPublicationSnapshot,
  type ReleaseMetadata,
  type ReleaseModel,
} from "../../src/domain";

const ROOT = resolve(import.meta.dirname, "../..");
const STAGE_ONE_RELEASE_ID = "019f9b40-a3a8-75ad-b2b2-05a7100bcc34";
const RELEASE_TWO_ID = "019fa000-0000-7000-8000-000000000001";
const RELEASE_THREE_ID = "019fa000-0001-7000-8000-000000000001";
const FOURTH_ENTRY_ID = "019f9fff-0000-7000-8000-000000000001";
const FOURTH_SNAPSHOT_ID = "019f9fff-0001-7000-8000-000000000001";
const RELEASE_TWO_REVISION_ID = "019f9fff-0002-7000-8000-000000000001";
const RELEASE_THREE_REVISION_ID = "019f9fff-0003-7000-8000-000000000001";

function source(recordType: CanonicalRecordSource["record_type"], filename: string, value: unknown): CanonicalRecordSource {
  return { record_type: recordType, filename, raw_text: JSON.stringify(value), value };
}

function construct(records: LoadedCanonicalRecords, metadata: ReleaseMetadata): ReleaseModel {
  const result = constructReleaseModel({
    records,
    release_metadata: metadata,
    site_origin: "https://vydex.pages.dev",
    mode: "production",
  });
  if (result.mode !== "production" || !result.success) {
    const codes = result.mode === "production" ? result.diagnostics.map(({ code }) => code) : ["wrong_mode"];
    throw new Error(`Release fixture failed: ${codes.join(", ")}`);
  }
  return result.release;
}

function addMaterialRevision(input: {
  records: LoadedCanonicalRecords;
  entryId: string;
  revisionId: string;
  revisionNumber: number;
  publishedAt: string;
  titleSuffix: string;
}): void {
  const history = input.records.entry_publication_snapshots
    .map(({ value }) => value as EntryPublicationSnapshot)
    .filter(({ entry_id }) => entry_id === input.entryId)
    .sort((left, right) => left.revision_number - right.revision_number);
  const snapshot = structuredClone(history.at(-1)!);
  snapshot.revision_id = input.revisionId as EntryPublicationSnapshot["revision_id"];
  snapshot.revision_number = input.revisionNumber;
  snapshot.published_at = input.publishedAt as EntryPublicationSnapshot["published_at"];
  snapshot.revision_category = "material_update";
  snapshot.materiality = "material";
  snapshot.update_summary = `Accepted material revision ${input.revisionNumber}.`;
  snapshot.entry.title = `${snapshot.entry.title} ${input.titleSuffix}`;
  input.records.entry_publication_snapshots.push(source(
    "entry_publication_snapshot",
    `data/publication-snapshots/entries/${input.entryId}/${input.revisionNumber}-${input.revisionId}.json`,
    snapshot,
  ));
}

function createReleaseTwoRecords(stageOne: LoadedCanonicalRecords): { records: LoadedCanonicalRecords; revisedEntryId: string } {
  const records = structuredClone(stageOne);
  const snapshotCounts = new Map<string, number>();
  for (const { value } of records.entry_publication_snapshots) {
    const entryId = (value as EntryPublicationSnapshot).entry_id;
    snapshotCounts.set(entryId, (snapshotCounts.get(entryId) ?? 0) + 1);
  }
  const templateSource = records.entries.find(({ value }) => snapshotCounts.get((value as Entry).id) === 1)!;
  const templateEntry = structuredClone(templateSource.value as Entry);
  const templateSnapshot = structuredClone(records.entry_publication_snapshots.find(
    ({ value }) => (value as EntryPublicationSnapshot).entry_id === templateEntry.id,
  )!.value as EntryPublicationSnapshot);
  const revisedEntryId = templateEntry.id;

  const fourthEntry = structuredClone(templateEntry);
  fourthEntry.id = FOURTH_ENTRY_ID as Entry["id"];
  fourthEntry.slug = "release-two-fourth-entry" as Entry["slug"];
  fourthEntry.aliases = [];
  fourthEntry.title = "Release 2 fourth accepted Entry fixture";
  const fourthSnapshot = structuredClone(templateSnapshot);
  fourthSnapshot.revision_id = FOURTH_SNAPSHOT_ID as EntryPublicationSnapshot["revision_id"];
  fourthSnapshot.entry_id = fourthEntry.id;
  fourthSnapshot.revision_number = 1;
  fourthSnapshot.published_at = "2026-07-25T14:00:00Z" as EntryPublicationSnapshot["published_at"];
  fourthSnapshot.revision_category = "initial_publication";
  fourthSnapshot.materiality = "material";
  fourthSnapshot.update_summary = "Accepted the fourth Entry fixture for Release 2.";
  fourthSnapshot.entry = structuredClone(fourthEntry);
  records.entries.push(source("entry", "data/canonical-records/entries/release-two-fourth-entry.json", fourthEntry));
  records.entry_publication_snapshots.push(source(
    "entry_publication_snapshot",
    `data/publication-snapshots/entries/${FOURTH_ENTRY_ID}/1-${FOURTH_SNAPSHOT_ID}.json`,
    fourthSnapshot,
  ));
  addMaterialRevision({
    records,
    entryId: revisedEntryId,
    revisionId: RELEASE_TWO_REVISION_ID,
    revisionNumber: 2,
    publishedAt: "2026-07-25T15:00:00Z",
    titleSuffix: "with a Release 2 material revision",
  });
  return { records, revisedEntryId };
}

describe("repeatable release sequence fixtures", { timeout: 15_000 }, () => {
  let stageOneRecords: LoadedCanonicalRecords;
  let stageOneMetadata: ReleaseMetadata;

  beforeAll(async () => {
    stageOneRecords = await loadCanonicalRecords({ filesystem_root: ROOT });
    stageOneMetadata = JSON.parse(await readFile(resolve(
      ROOT,
      `generated/release-data/releases/${STAGE_ONE_RELEASE_ID}/release.json`,
    ), "utf8")) as ReleaseMetadata;
  });

  test("constructs Release 2 with a fourth Entry and more than one accepted Entry change", () => {
    const stageOne = construct(structuredClone(stageOneRecords), stageOneMetadata);
    const releaseTwoFixture = createReleaseTwoRecords(stageOneRecords);
    const releaseTwo = construct(releaseTwoFixture.records, {
      release_id: RELEASE_TWO_ID as ReleaseMetadata["release_id"],
      generated_at: "2026-07-26T12:00:00Z" as ReleaseMetadata["generated_at"],
    });

    expect(stageOne.current_entries).toHaveLength(3);
    expect(releaseTwo.current_entries).toHaveLength(4);
    expect(releaseTwo.current_entries.some(({ entry }) => entry.id === FOURTH_ENTRY_ID)).toBe(true);
    expect(releaseTwo.changelog_events).toEqual(expect.arrayContaining([
      expect.objectContaining({ source_identity: FOURTH_SNAPSHOT_ID, type: "added" }),
      expect.objectContaining({ source_identity: RELEASE_TWO_REVISION_ID, type: "updated" }),
    ]));
  });

  test("constructs Release 3 from a later material Entry revision and preserves the predecessor chain", () => {
    const releaseTwoFixture = createReleaseTwoRecords(stageOneRecords);
    const releaseThreeRecords = structuredClone(releaseTwoFixture.records);
    addMaterialRevision({
      records: releaseThreeRecords,
      entryId: releaseTwoFixture.revisedEntryId,
      revisionId: RELEASE_THREE_REVISION_ID,
      revisionNumber: 3,
      publishedAt: "2026-07-26T15:00:00Z",
      titleSuffix: "with a Release 3 material revision",
    });
    const releaseThree = construct(releaseThreeRecords, {
      release_id: RELEASE_THREE_ID as ReleaseMetadata["release_id"],
      generated_at: "2026-07-27T12:00:00Z" as ReleaseMetadata["generated_at"],
    });
    const history = releaseHistorySchema.parse({
      history_version: "1.0.0",
      releases: [
        {
          release_id: stageOneMetadata.release_id,
          generated_at: stageOneMetadata.generated_at,
          source_commit: "655b7c8bf4a8b5cbb88bbc9427735084c5f19973",
          descriptor_path: `generated/release-data/releases/${stageOneMetadata.release_id}/release.json`,
          manifest_path: `generated/release-data/releases/${stageOneMetadata.release_id}/release-manifest.json`,
          dataset_public_path: `/datasets/releases/${stageOneMetadata.release_id}/stage-one.json`,
          previous_release_id: null,
        },
        {
          release_id: RELEASE_TWO_ID,
          generated_at: "2026-07-26T12:00:00Z",
          source_commit: "a".repeat(40),
          descriptor_path: `generated/release-data/releases/${RELEASE_TWO_ID}/release.json`,
          manifest_path: `generated/release-data/releases/${RELEASE_TWO_ID}/release-manifest.json`,
          dataset_public_path: `/datasets/releases/${RELEASE_TWO_ID}/release-two.json`,
          previous_release_id: stageOneMetadata.release_id,
        },
        {
          release_id: RELEASE_THREE_ID,
          generated_at: "2026-07-27T12:00:00Z",
          source_commit: "b".repeat(40),
          descriptor_path: `generated/release-data/releases/${RELEASE_THREE_ID}/release.json`,
          manifest_path: `generated/release-data/releases/${RELEASE_THREE_ID}/release-manifest.json`,
          dataset_public_path: `/datasets/releases/${RELEASE_THREE_ID}/release-three.json`,
          previous_release_id: RELEASE_TWO_ID,
        },
      ],
    });

    expect(releaseThree.current_entries).toHaveLength(4);
    expect(releaseThree.changelog_events).toContainEqual(expect.objectContaining({
      source_identity: RELEASE_THREE_REVISION_ID,
      type: "updated",
    }));
    expect(history.releases.map(({ previous_release_id }) => previous_release_id)).toEqual([
      null,
      stageOneMetadata.release_id,
      RELEASE_TWO_ID,
    ]);
  });
});
