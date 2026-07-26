// Verifies clean-branch capture and immutable source-commit ancestry checks.
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import {
  addDetachedReleaseWorktree,
  readGitHead,
  removeDetachedReleaseWorktree,
  requireCleanReleaseGitState,
  requireCommitAncestor,
  requireReleaseStateUnchanged,
} from "../../src/adapters/release-git";

const executeFile = promisify(execFile);

async function git(root: string, ...arguments_: string[]): Promise<string> {
  const result = await executeFile("git", arguments_, { cwd: root, encoding: "utf8", windowsHide: true });
  return result.stdout.trim();
}

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vydex-release-git-"));
  await git(root, "init", "--initial-branch=main");
  await git(root, "config", "user.name", "VyDex Test");
  await git(root, "config", "user.email", "test@example.invalid");
  await writeFile(join(root, "record.txt"), "first\n", "utf8");
  await git(root, "add", "record.txt");
  await git(root, "commit", "-m", "first");
  return root;
}

describe("release Git boundary", () => {
  test("captures the full clean HEAD and validates ancestry", async () => {
    const root = await repository();
    const state = await requireCleanReleaseGitState(root);
    expect(state.branch).toBe("main");
    expect(state.head).toBe(await readGitHead(root));
    await expect(requireCommitAncestor({ repository_root: root, source_commit: state.head, descendant_commit: state.head })).resolves.toBeUndefined();
  });

  test("checks out source worktrees with stable LF bytes when Git enables autocrlf", async () => {
    const root = await repository();
    await git(root, "config", "core.autocrlf", "true");
    const worktree = await mkdtemp(join(tmpdir(), "vydex-release-source-"));
    await rm(worktree, { recursive: true, force: true });
    try {
      await addDetachedReleaseWorktree({
        repository_root: root,
        worktree_root: worktree,
        source_commit: await readGitHead(root),
      });
      await expect(readFile(join(worktree, "record.txt"), "utf8")).resolves.toBe("first\n");
    } finally {
      await removeDetachedReleaseWorktree({ repository_root: root, worktree_root: worktree }).catch(() => undefined);
    }
  });

  test("rejects dirty and detached repositories", async () => {
    const root = await repository();
    await writeFile(join(root, "untracked.txt"), "dirty\n", "utf8");
    await expect(requireCleanReleaseGitState(root)).rejects.toThrow("clean Git working tree");
    await executeFile("git", ["clean", "-f"], { cwd: root, windowsHide: true });
    await git(root, "checkout", "--detach");
    await expect(requireCleanReleaseGitState(root)).rejects.toThrow("non-detached Git branch");
    await expect(readGitHead(root)).resolves.toMatch(/^[a-f0-9]{40}$/);
  });

  test("rejects committed release-state differences without rejecting unrelated files", async () => {
    const root = await repository();
    await mkdir(join(root, "generated/release-data"), { recursive: true });
    await writeFile(join(root, "generated/release-data/release.json"), "committed\n", "utf8");
    await git(root, "add", "generated/release-data/release.json");
    await git(root, "commit", "-m", "release state");
    await writeFile(join(root, "unrelated.txt"), "allowed for reproduction\n", "utf8");
    await expect(requireReleaseStateUnchanged(root)).resolves.toBeUndefined();
    await writeFile(join(root, "generated/release-data/release.json"), "different\n", "utf8");
    await expect(requireReleaseStateUnchanged(root)).rejects.toThrow("Committed release state contains working-tree differences");
  });
});
