// Verifies release reproduction initializes its ignored runtime storage.
import { access, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { reproduceReleaseFromSource } from "../../src/release/release-publication";
import type { ReleaseLogger } from "../../src/shared/release-logger";

const logger: ReleaseLogger = {
  filename: "",
  log: vi.fn(async () => {}),
  debug: vi.fn(async () => {}),
  info: vi.fn(async () => {}),
  warning: vi.fn(async () => {}),
  error: vi.fn(async () => {}),
  critical: vi.fn(async () => {}),
};

describe("release CI runtime storage", () => {
  test("creates runtime storage before loading release state", async () => {
    const root = await mkdtemp(join(tmpdir(), "vydex-release-ci-"));

    await expect(reproduceReleaseFromSource({
      repository_root: root,
      site_origin: "https://vydex.pages.dev" as never,
      logger,
    })).rejects.toThrow("Active release descriptor is missing or unreadable");

    await expect(access(resolve(root, "runtime"))).resolves.toBeUndefined();
  });
});
