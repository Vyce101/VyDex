// Provides the Git boundary used to capture and validate release provenance.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { gitCommitSchema } from "../../domain";

const executeFile = promisify(execFile);

async function git(repositoryRoot: string, arguments_: string[]): Promise<string> {
  try {
    const result = await executeFile("git", arguments_, {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.stdout.trim();
  } catch (cause) {
    throw new Error(`Git command failed: git ${arguments_.join(" ")}.`, { cause });
  }
}

export type ReleaseGitState = {
  branch: string;
  head: string;
  status: string;
};

export async function readGitHead(repositoryRoot: string): Promise<string> {
  return gitCommitSchema.parse(await git(repositoryRoot, ["rev-parse", "HEAD"]));
}

export async function readReleaseGitState(repositoryRoot: string): Promise<ReleaseGitState> {
  let branch: string;
  try {
    branch = await git(repositoryRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  } catch (cause) {
    throw new Error("Release creation requires a non-detached Git branch.", { cause });
  }
  if (!branch) throw new Error("Release creation requires a non-detached Git branch.");
  const head = await readGitHead(repositoryRoot);
  const status = await git(repositoryRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
  return { branch, head, status };
}

export async function requireCleanReleaseGitState(repositoryRoot: string): Promise<ReleaseGitState> {
  const state = await readReleaseGitState(repositoryRoot);
  if (state.status) throw new Error(`Release creation requires a clean Git working tree.\n${state.status}`);
  return state;
}

export async function requireReleaseStateUnchanged(repositoryRoot: string): Promise<void> {
  const status = await git(repositoryRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    "generated/release-data",
  ]);
  if (status) throw new Error(`Committed release state contains working-tree differences.\n${status}`);
}

export async function requireCommitAncestor(input: {
  repository_root: string;
  source_commit: string;
  descendant_commit: string;
}): Promise<void> {
  const sourceCommit = gitCommitSchema.parse(input.source_commit);
  const descendantCommit = gitCommitSchema.parse(input.descendant_commit);
  await git(input.repository_root, ["cat-file", "-e", `${sourceCommit}^{commit}`]);
  try {
    await git(input.repository_root, ["merge-base", "--is-ancestor", sourceCommit, descendantCommit]);
  } catch (cause) {
    throw new Error(`Release source commit ${sourceCommit} is not an ancestor of ${descendantCommit}.`, { cause });
  }
}

export async function readFileAtCommit(input: {
  repository_root: string;
  source_commit: string;
  repository_path: string;
}): Promise<string> {
  const sourceCommit = gitCommitSchema.parse(input.source_commit);
  return `${await git(input.repository_root, ["show", `${sourceCommit}:${input.repository_path}`])}\n`;
}

export async function addDetachedReleaseWorktree(input: {
  repository_root: string;
  worktree_root: string;
  source_commit: string;
}): Promise<void> {
  await git(input.repository_root, [
    "-c", "core.autocrlf=false",
    "-c", "core.eol=lf",
    "worktree", "add", "--detach", input.worktree_root, input.source_commit,
  ]);
}

export async function removeDetachedReleaseWorktree(input: {
  repository_root: string;
  worktree_root: string;
}): Promise<void> {
  await git(input.repository_root, ["worktree", "remove", "--force", input.worktree_root]);
}
