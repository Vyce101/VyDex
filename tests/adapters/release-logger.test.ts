// Verifies colored terminal logging and the bounded plain-text release log rotation policy.
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";
import { createReleaseLogger } from "../../src/shared/release-logger";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("rotates one active log plus ten predecessors and strips terminal colors from files", async () => {
  const root = await mkdtemp(join(tmpdir(), "vydex-release-logger-"));
  roots.push(root);
  const logDirectory = resolve(root, "user/logs");
  await mkdir(logDirectory, { recursive: true });
  for (let number = 1; number <= 11; number += 1) {
    await writeFile(resolve(logDirectory, `logs_${number}.txt`), `previous-${number}\n`, "utf8");
  }
  const terminal: string[] = [];
  const logger = await createReleaseLogger({
    filesystem_root: root,
    write_terminal: (value) => terminal.push(value),
    now: () => new Date("2026-07-25T19:00:00.000Z"),
  });

  await logger.info("Release validation started.");

  const filenames = (await readdir(logDirectory)).sort();
  expect(filenames).toHaveLength(11);
  expect(filenames).toContain("logs_11.txt");
  expect(await readFile(resolve(logDirectory, "logs_11.txt"), "utf8")).toBe("previous-10\n");
  expect(terminal.join("")).toContain("\u001b[32m");
  const activeLog = await readFile(logger.filename, "utf8");
  expect(activeLog).toContain("INFO Release validation started.");
  expect(activeLog).not.toContain("\u001b[");
});
