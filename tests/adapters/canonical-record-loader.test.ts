// Verifies deterministic read-only loading from the canonical repository layout.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { loadApplicationRelease } from "../../src/adapters/application-release";
import { loadCanonicalRecords } from "../../src/adapters/canonical-record-loader";
import {
  IDS,
  createValidAboutRecord,
  createValidEntry,
  createValidMethodology,
  createValidMethodologyPublicationEvent,
  createValidSnapshot,
  createValidTopicTrail,
} from "../domain/fixtures";

const temporaryRoots: string[] = [];

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vydex-loader-"));
  temporaryRoots.push(root);
  return root;
}

async function writeJson(root: string, relativePath: string, value: unknown): Promise<string> {
  const filename = join(root, ...relativePath.split("/"));
  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, JSON.stringify(value), "utf8");
  return filename;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("loadCanonicalRecords", () => {
  test("loads every accepted collection and recursively loads only snapshot JSON", async () => {
    const root = await createTemporaryRoot();
    await writeJson(root, "data/canonical-records/entries/z-entry.json", createValidEntry());
    await writeJson(root, "data/canonical-records/topic-trails/trail.json", createValidTopicTrail());
    await writeJson(root, "data/canonical-records/methodologies/1.0.0.json", createValidMethodology());
    await writeJson(root, "data/canonical-records/about/about.json", createValidAboutRecord());
    await writeJson(
      root,
      "data/canonical-records/methodology-publication-events/1.0.0.json",
      createValidMethodologyPublicationEvent(),
    );
    const snapshotPath = `data/publication-snapshots/entries/${IDS.entry}/1-${IDS.snapshot}.json`;
    const absoluteSnapshotPath = await writeJson(root, snapshotPath, createValidSnapshot());
    await writeFile(join(root, "data", "canonical-records", "entries", "ignored.md"), "ignored", "utf8");
    const before = await readFile(absoluteSnapshotPath, "utf8");

    const loaded = await loadCanonicalRecords({ filesystem_root: root });

    expect(loaded.entries.map(({ filename }) => filename)).toEqual([
      "data/canonical-records/entries/z-entry.json",
    ]);
    expect(loaded.topic_trails).toHaveLength(1);
    expect(loaded.methodologies).toHaveLength(1);
    expect(loaded.about).toHaveLength(1);
    expect(loaded.methodology_publication_events).toHaveLength(1);
    expect(loaded.entry_publication_snapshots[0]?.filename).toBe(snapshotPath);
    expect(loaded.diagnostics).toEqual([]);
    expect(await readFile(absoluteSnapshotPath, "utf8")).toBe(before);
  });

  test("returns empty collections when the reserved directories do not exist", async () => {
    const loaded = await loadCanonicalRecords({ filesystem_root: await createTemporaryRoot() });
    expect(loaded.entries).toEqual([]);
    expect(loaded.entry_publication_snapshots).toEqual([]);
    expect(loaded.diagnostics).toEqual([]);
  });

  test("retains invalid JSON source text with a filename diagnostic", async () => {
    const root = await createTemporaryRoot();
    const filename = join(root, "data", "canonical-records", "entries", "broken.json");
    await mkdir(dirname(filename), { recursive: true });
    await writeFile(filename, "{ broken", "utf8");

    const loaded = await loadCanonicalRecords({ filesystem_root: root });

    expect(loaded.entries[0]).toMatchObject({
      filename: "data/canonical-records/entries/broken.json",
      raw_text: "{ broken",
      value: undefined,
    });
    expect(loaded.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid_json", filename: loaded.entries[0]?.filename }),
    );
  });

  test("rejects alternate About filenames without hiding their source", async () => {
    const root = await createTemporaryRoot();
    await writeJson(root, "data/canonical-records/about/about.json", createValidAboutRecord());
    await writeJson(root, "data/canonical-records/about/second.json", createValidAboutRecord());

    const loaded = await loadCanonicalRecords({ filesystem_root: root });

    expect(loaded.about).toHaveLength(2);
    expect(loaded.diagnostics).toContainEqual(
      expect.objectContaining({ code: "unexpected_about_filename", filename: expect.stringContaining("second.json") }),
    );
  });

  test("validates snapshot directory and filename metadata", async () => {
    const root = await createTemporaryRoot();
    await writeJson(
      root,
      `data/publication-snapshots/entries/01900000-0000-7000-8000-000000000099/9-${IDS.snapshot}.json`,
      createValidSnapshot(),
    );

    const loaded = await loadCanonicalRecords({ filesystem_root: root });
    const codes = loaded.diagnostics.map(({ code }) => code);
    expect(codes).toContain("snapshot_directory_entry_id_mismatch");
    expect(codes).toContain("snapshot_filename_metadata_mismatch");
  });
});

describe("loadApplicationRelease", () => {
  test("defaults private preview to the local origin without generating metadata", async () => {
    const result = await loadApplicationRelease({
      filesystem_root: await createTemporaryRoot(),
      mode: "preview",
    });
    expect(result.mode).toBe("preview");
    if (result.mode !== "preview") return;
    expect(result.preview.resolved.site_origin).toBe("http://localhost:4321");
    expect(result.preview.resolved.release_metadata).toBeUndefined();
    expect(result.preview.promotable).toBe(false);
  });
});
