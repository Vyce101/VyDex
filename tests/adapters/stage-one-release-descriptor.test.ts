// Verifies exclusive creation and immutable reuse of the initial Stage 1 release descriptor.
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  createStageOneReleaseDescriptor,
  readStageOneReleaseDescriptor,
} from "../../src/adapters/stage-one-release-descriptor";
import { PERSISTED_RELEASE_DESCRIPTOR_PATH } from "../../src/adapters/persisted-release-descriptor";

const roots: string[] = [];
const FIRST_DESCRIPTOR = {
  release_id: "01900000-0000-7000-8000-000000000099",
  generated_at: "2026-07-25T18:00:00.000Z",
} as const;
const SECOND_DESCRIPTOR = {
  release_id: "01900000-0000-7000-8000-000000000100",
  generated_at: "2026-07-25T18:01:00.000Z",
} as const;

async function createRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vydex-stage-one-descriptor-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Stage 1 release descriptor writing", () => {
  test("creates the validated descriptor once with deterministic formatting", async () => {
    const root = await createRoot();
    expect(await readStageOneReleaseDescriptor(root)).toEqual({ status: "missing" });

    const result = await createStageOneReleaseDescriptor(root, FIRST_DESCRIPTOR);
    const rawText = await readFile(resolve(root, PERSISTED_RELEASE_DESCRIPTOR_PATH), "utf8");

    expect(result).toEqual({ status: "created", descriptor: FIRST_DESCRIPTOR });
    expect(rawText).toBe(`${JSON.stringify(FIRST_DESCRIPTOR, null, 2)}\n`);
  });

  test("never rewrites an existing valid descriptor", async () => {
    const root = await createRoot();
    const filename = resolve(root, PERSISTED_RELEASE_DESCRIPTOR_PATH);
    await mkdir(dirname(filename), { recursive: true });
    const originalBytes = `{\n  "release_id": "${FIRST_DESCRIPTOR.release_id}",\n  "generated_at": "${FIRST_DESCRIPTOR.generated_at}"\n}\n`;
    await writeFile(filename, originalBytes, "utf8");

    const result = await createStageOneReleaseDescriptor(root, SECOND_DESCRIPTOR);

    expect(result).toEqual({ status: "existing", descriptor: FIRST_DESCRIPTOR });
    expect(await readFile(filename, "utf8")).toBe(originalBytes);
  });

  test("concurrent creation returns the one exclusively persisted descriptor", async () => {
    const root = await createRoot();
    const results = await Promise.all([
      createStageOneReleaseDescriptor(root, FIRST_DESCRIPTOR),
      createStageOneReleaseDescriptor(root, SECOND_DESCRIPTOR),
    ]);
    const loaded = await readStageOneReleaseDescriptor(root);
    expect(loaded.status).toBe("existing");
    if (loaded.status !== "existing") return;
    expect(results.map(({ descriptor }) => descriptor)).toEqual([
      loaded.descriptor,
      loaded.descriptor,
    ]);
  });

  test("rejects malformed or invalid existing descriptors without repairing them", async () => {
    const root = await createRoot();
    const filename = resolve(root, PERSISTED_RELEASE_DESCRIPTOR_PATH);
    await mkdir(dirname(filename), { recursive: true });
    await writeFile(filename, "{broken", "utf8");

    await expect(readStageOneReleaseDescriptor(root)).rejects.toThrow("malformed JSON");
    await expect(createStageOneReleaseDescriptor(root, FIRST_DESCRIPTOR)).rejects.toThrow("malformed JSON");
    expect(await readFile(filename, "utf8")).toBe("{broken");
  });
});
