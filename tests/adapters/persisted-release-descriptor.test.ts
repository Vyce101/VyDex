// Verifies fail-closed loading for the durable production release descriptor.
import { resolve } from "node:path";
import { describe, expect, test, vi } from "vitest";
import {
  loadPersistedReleaseDescriptor,
  PERSISTED_RELEASE_DESCRIPTOR_PATH,
} from "../../src/adapters/persisted-release-descriptor";

const VALID_DESCRIPTOR = {
  release_id: "01900000-0000-7000-8000-000000000099",
  generated_at: "2026-07-24T20:30:00Z",
};

describe("loadPersistedReleaseDescriptor", () => {
  test("reads the exact reserved path and validates the persisted contract", async () => {
    const readTextFile = vi.fn(async () => JSON.stringify(VALID_DESCRIPTOR));

    const descriptor = await loadPersistedReleaseDescriptor({
      filesystem_root: "C:/repository",
      read_text_file: readTextFile,
    });

    expect(readTextFile).toHaveBeenCalledWith(
      resolve("C:/repository", PERSISTED_RELEASE_DESCRIPTOR_PATH),
    );
    expect(descriptor).toEqual(VALID_DESCRIPTOR);
  });

  test("fails closed when the descriptor is missing or unreadable", async () => {
    await expect(
      loadPersistedReleaseDescriptor({
        filesystem_root: "C:/repository",
        read_text_file: async () => {
          throw new Error("ENOENT");
        },
      }),
    ).rejects.toThrow("missing or unreadable");
  });

  test("fails closed for malformed JSON", async () => {
    await expect(
      loadPersistedReleaseDescriptor({
        filesystem_root: "C:/repository",
        read_text_file: async () => "{not-json",
      }),
    ).rejects.toThrow("malformed JSON");
  });

  test("fails closed for schema-invalid metadata", async () => {
    await expect(
      loadPersistedReleaseDescriptor({
        filesystem_root: "C:/repository",
        read_text_file: async () => JSON.stringify({ ...VALID_DESCRIPTOR, release_id: "not-a-uuid" }),
      }),
    ).rejects.toThrow("schema-invalid");
  });
});
