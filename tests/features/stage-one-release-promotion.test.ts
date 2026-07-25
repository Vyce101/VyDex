// Verifies successful release promotion and rollback of both promotable resources.
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";
import {
  promoteStageOneReleaseOutput,
  STAGE_ONE_RELEASE_MANIFEST_PATH,
} from "../../src/release/stage-one-release";

const roots: string[] = [];

async function createPromotionFixture() {
  const root = await mkdtemp(join(tmpdir(), "vydex-release-promotion-"));
  roots.push(root);
  const manifest = resolve(root, STAGE_ONE_RELEASE_MANIFEST_PATH);
  const stagedOutput = resolve(root, "runtime/staged-dist");
  await mkdir(resolve(root, "dist"), { recursive: true });
  await mkdir(stagedOutput, { recursive: true });
  await mkdir(dirname(manifest), { recursive: true });
  await writeFile(resolve(root, "dist/index.html"), "previous output", "utf8");
  await writeFile(resolve(stagedOutput, "index.html"), "verified output", "utf8");
  await writeFile(manifest, "previous manifest", "utf8");
  return { root, manifest, stagedOutput };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("promotes verified dist and manifest together", async () => {
  const fixture = await createPromotionFixture();
  await promoteStageOneReleaseOutput({
    filesystem_root: fixture.root,
    staged_output_root: fixture.stagedOutput,
    serialized_manifest: "verified manifest",
    transaction_id: "success",
  });

  expect(await readFile(resolve(fixture.root, "dist/index.html"), "utf8")).toBe("verified output");
  expect(await readFile(fixture.manifest, "utf8")).toBe("verified manifest");
});

test("restores both previous resources when manifest promotion fails", async () => {
  const fixture = await createPromotionFixture();
  let injectedFailure = false;
  await expect(
    promoteStageOneReleaseOutput({
      filesystem_root: fixture.root,
      staged_output_root: fixture.stagedOutput,
      serialized_manifest: "verified manifest",
      transaction_id: "rollback",
      operations: {
        rename: async (source, destination) => {
          if (!injectedFailure && destination === fixture.manifest) {
            injectedFailure = true;
            throw new Error("injected manifest failure");
          }
          await rename(source, destination);
        },
      },
    }),
  ).rejects.toThrow("previous output was restored");

  expect(await readFile(resolve(fixture.root, "dist/index.html"), "utf8")).toBe("previous output");
  expect(await readFile(fixture.manifest, "utf8")).toBe("previous manifest");
});
