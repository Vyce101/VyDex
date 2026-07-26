// Verifies next-release confirmation, CI, and concurrency guards before construction.
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { runNextRelease } from "../../src/release/release-publication";
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

describe("next-release guards", () => {
  test("rejects CI before accessing release state", async () => {
    await expect(runNextRelease({
      repository_root: "missing",
      site_origin: "https://vydex.pages.dev" as never,
      confirmation: "CREATE_NEXT_RELEASE",
      environment: { CI: "true" },
      logger,
    })).rejects.toThrow("forbidden in CI");
  });

  test("requires the exact confirmation", async () => {
    await expect(runNextRelease({
      repository_root: "missing",
      site_origin: "https://vydex.pages.dev" as never,
      confirmation: "yes",
      environment: {},
      logger,
    })).rejects.toThrow("--confirm CREATE_NEXT_RELEASE");
  });

  test("allows at most one owner of the next-release lock", async () => {
    const root = await mkdtemp(join(tmpdir(), "vydex-release-lock-"));
    await mkdir(join(root, "runtime"));
    await mkdir(join(root, "runtime", "release-next.lock"));
    await expect(runNextRelease({
      repository_root: root,
      site_origin: "https://vydex.pages.dev" as never,
      confirmation: "CREATE_NEXT_RELEASE",
      environment: {},
      logger,
    })).rejects.toThrow("Another next-release attempt");
  });
});
