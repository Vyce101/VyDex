// Verifies rollback-safe selection of descriptor, manifest, history, archive, and dist.
import { mkdir, mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { promoteNextRelease, recoverInterruptedReleasePromotions } from "../../src/release/release-publication";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "vydex-next-promotion-"));
  const releaseRoot = resolve(root, "generated/release-data");
  const output = resolve(root, "dist");
  const stagedOutput = resolve(root, "runtime/candidate/dist");
  const stagedArchive = resolve(root, "runtime/candidate/archive");
  await mkdir(output, { recursive: true });
  await mkdir(stagedOutput, { recursive: true });
  await mkdir(stagedArchive, { recursive: true });
  await mkdir(releaseRoot, { recursive: true });
  await writeFile(resolve(releaseRoot, "release.json"), "old descriptor", "utf8");
  await writeFile(resolve(releaseRoot, "release-manifest.json"), "old manifest", "utf8");
  await writeFile(resolve(releaseRoot, "release-history.json"), "old history", "utf8");
  await writeFile(resolve(output, "index.html"), "old output", "utf8");
  await writeFile(resolve(stagedOutput, "index.html"), "new output", "utf8");
  await writeFile(resolve(stagedArchive, "release.json"), "new descriptor", "utf8");
  return { root, releaseRoot, output, stagedOutput, stagedArchive, archiveTarget: resolve(releaseRoot, "releases/new") };
}

describe("next-release promotion", () => {
  test("selects every new resource in one transaction", async () => {
    const values = await fixture();
    await promoteNextRelease({
      repository_root: values.root,
      staged_output_root: values.stagedOutput,
      staged_archive_root: values.stagedArchive,
      archive_target_root: values.archiveTarget,
      descriptor_raw: "new descriptor",
      manifest_raw: "new manifest",
      history_raw: "new history",
      transaction_id: "success",
    });
    await expect(readFile(resolve(values.releaseRoot, "release.json"), "utf8")).resolves.toBe("new descriptor");
    await expect(readFile(resolve(values.output, "index.html"), "utf8")).resolves.toBe("new output");
    await expect(readFile(resolve(values.archiveTarget, "release.json"), "utf8")).resolves.toBe("new descriptor");
  });

  test("restores all previous active resources when selection fails", async () => {
    const values = await fixture();
    let calls = 0;
    const failingRename = vi.fn(async (source: string, destination: string) => {
      calls += 1;
      if (calls === 7) throw new Error("injected promotion failure");
      await rename(source, destination);
    }) as typeof rename;
    await expect(promoteNextRelease({
      repository_root: values.root,
      staged_output_root: values.stagedOutput,
      staged_archive_root: values.stagedArchive,
      archive_target_root: values.archiveTarget,
      descriptor_raw: "new descriptor",
      manifest_raw: "new manifest",
      history_raw: "new history",
      transaction_id: "failure",
      operations: { rename: failingRename },
    })).rejects.toThrow("previous active state was restored");
    await expect(readFile(resolve(values.releaseRoot, "release.json"), "utf8")).resolves.toBe("old descriptor");
    await expect(readFile(resolve(values.releaseRoot, "release-manifest.json"), "utf8")).resolves.toBe("old manifest");
    await expect(readFile(resolve(values.releaseRoot, "release-history.json"), "utf8")).resolves.toBe("old history");
    await expect(readFile(resolve(values.output, "index.html"), "utf8")).resolves.toBe("old output");
  });

  test("recovers an interrupted prepared transaction before another release command starts", async () => {
    const values = await fixture();
    const transactionRoot = resolve(values.root, "runtime/release-promotion/interrupted");
    const backups = {
      descriptor: resolve(transactionRoot, "release-backup.json"),
      manifest: resolve(transactionRoot, "manifest-backup.json"),
      history: resolve(transactionRoot, "history-backup.json"),
      output: resolve(transactionRoot, "dist-backup"),
    };
    const targets = {
      descriptor: resolve(values.releaseRoot, "release.json"),
      manifest: resolve(values.releaseRoot, "release-manifest.json"),
      history: resolve(values.releaseRoot, "release-history.json"),
      output: values.output,
      archive: values.archiveTarget,
    };
    await mkdir(transactionRoot, { recursive: true });
    for (const key of ["descriptor", "manifest", "history", "output"] as const) await rename(targets[key], backups[key]);
    await mkdir(targets.output, { recursive: true });
    await writeFile(resolve(targets.output, "index.html"), "partial output", "utf8");
    await mkdir(resolve(values.releaseRoot, "releases"), { recursive: true });
    await rename(values.stagedArchive, targets.archive);
    await writeFile(resolve(transactionRoot, "transaction.json"), `${JSON.stringify({
      version: "1.0.0",
      kind: "next-release",
      phase: "prepared",
      targets,
      backups,
      had_targets: { descriptor: true, manifest: true, history: true, output: true, archive: false },
    }, null, 2)}\n`, "utf8");

    await recoverInterruptedReleasePromotions(values.root);

    await expect(readFile(resolve(values.releaseRoot, "release.json"), "utf8")).resolves.toBe("old descriptor");
    await expect(readFile(resolve(values.output, "index.html"), "utf8")).resolves.toBe("old output");
    await expect(readFile(resolve(values.archiveTarget, "release.json"), "utf8")).rejects.toThrow();
  });
});
