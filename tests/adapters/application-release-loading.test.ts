// Verifies explicit persisted-production and fixed non-production release-loading paths.
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  loadFixedMetadataDevelopmentApplicationRelease,
  loadPersistedProductionApplicationRelease,
} from "../../src/adapters/application-release";

const PROJECT_ROOT = join(import.meta.dirname, "../..");

describe("application release loading", { timeout: 15_000 }, () => {
  test("keeps production blocked when the persisted descriptor is absent", async () => {
    await expect(
      loadPersistedProductionApplicationRelease({
        filesystem_root: join(PROJECT_ROOT, "tests", "nonexistent-release-root"),
        site_origin: "https://vydex.example",
      }),
    ).rejects.toThrow("missing or unreadable");
  });

  test("constructs deterministic development releases from fixed non-production metadata", async () => {
    const input = {
      filesystem_root: PROJECT_ROOT,
      site_origin: "https://vydex.example",
    };

    const first = await loadFixedMetadataDevelopmentApplicationRelease(input);
    const second = await loadFixedMetadataDevelopmentApplicationRelease(input);

    expect(first.release_metadata).toEqual(second.release_metadata);
    expect(first.current_entries).toHaveLength(5);
    expect(first).toEqual(second);
  });
});
