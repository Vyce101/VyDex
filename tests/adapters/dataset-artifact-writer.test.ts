// Verifies safe idempotent emission of immutable dataset artifacts to temporary roots.
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { writeDatasetArtifact } from "../../src/adapters/dataset-artifact-writer";
import { generateVyDexDatasetV1, type GeneratedDatasetArtifactV1 } from "../../src/domain";
import { createDatasetFixtureRelease } from "../domain/dataset-fixtures";

const temporaryRoots: string[] = [];

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vydex-dataset-writer-"));
  temporaryRoots.push(root);
  return root;
}

function createArtifact(): GeneratedDatasetArtifactV1 {
  const result = generateVyDexDatasetV1({ release: createDatasetFixtureRelease() });
  if (!result.success) throw new Error(result.diagnostics.map(({ code }) => code).join(", "));
  return result.data;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("writeDatasetArtifact", () => {
  test("creates parent directories and writes the exact UTF-8 dataset bytes", async () => {
    const root = await createTemporaryRoot();
    const artifact = createArtifact();
    const result = await writeDatasetArtifact({ output_root: root, artifact });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("written");
    const bytes = await readFile(result.data.filename);
    expect(bytes.equals(Buffer.from(artifact.serialized_json, "utf8"))).toBe(true);
    expect(bytes.toString("utf8").endsWith("\n")).toBe(true);
    expect(bytes.toString("utf8").endsWith("\n\n")).toBe(false);
    expect((await stat(dirname(result.data.filename))).isDirectory()).toBe(true);
  });

  test("treats a byte-identical existing immutable artifact as idempotent success", async () => {
    const root = await createTemporaryRoot();
    const artifact = createArtifact();
    const first = await writeDatasetArtifact({ output_root: root, artifact });
    const second = await writeDatasetArtifact({ output_root: root, artifact });

    expect(first.success && first.data.status).toBe("written");
    expect(second.success && second.data.status).toBe("unchanged");
  });

  test("refuses a different artifact at an occupied immutable path without changing it", async () => {
    const root = await createTemporaryRoot();
    const artifact = createArtifact();
    const first = await writeDatasetArtifact({ output_root: root, artifact });
    expect(first.success).toBe(true);
    if (!first.success) return;
    await writeFile(first.data.filename, "different immutable bytes\n", "utf8");

    const collision = await writeDatasetArtifact({ output_root: root, artifact });

    expect(collision.success).toBe(false);
    if (!collision.success) {
      expect(collision.diagnostics.map(({ code }) => code)).toEqual(["immutable_artifact_collision"]);
    }
    expect(await readFile(first.data.filename, "utf8")).toBe("different immutable bytes\n");
  });

  test("rejects paths that escape the injected output root", async () => {
    const root = await createTemporaryRoot();
    const artifact = {
      ...createArtifact(),
      public_path: "../../outside.json" as GeneratedDatasetArtifactV1["public_path"],
    };
    const result = await writeDatasetArtifact({ output_root: root, artifact });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.map(({ code }) => code)).toEqual(["unsafe_artifact_path"]);
    }
  });

  test("does not write a mutable stable-latest copy", async () => {
    const root = await createTemporaryRoot();
    const artifact = createArtifact();
    const result = await writeDatasetArtifact({ output_root: root, artifact });
    expect(result.success).toBe(true);

    await expect(
      stat(join(root, "datasets", "vydex-latest-entry-versions-v1-0-0.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("returns a structured failure when the output root cannot be used as a directory", async () => {
    const root = await createTemporaryRoot();
    const fileRoot = join(root, "not-a-directory");
    await writeFile(fileRoot, "occupied", "utf8");
    const result = await writeDatasetArtifact({ output_root: fileRoot, artifact: createArtifact() });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.map(({ code }) => code)).toEqual(["artifact_write_failed"]);
    }
  });
});
