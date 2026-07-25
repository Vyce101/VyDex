// Verifies that npm subprocesses launch portably and fail clearly without npm context.
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { runNpmCommand } from "../../src/adapters/npm-command-runner";

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");
const NPM_CLI_STUB = resolve(import.meta.dirname, "../fixtures/npm-cli-stub.cjs");

describe("npm command runner", () => {
  test("runs the active npm CLI through Node", async () => {
    const result = await runNpmCommand({
      command_arguments: ["--version"],
      working_directory: PROJECT_ROOT,
      environment: { ...process.env, npm_execpath: NPM_CLI_STUB },
    });

    expect(result.exit_code).toBe(0);
    expect(result.output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("fails clearly when the command was not started through npm", async () => {
    await expect(
      runNpmCommand({
        command_arguments: ["--version"],
        working_directory: PROJECT_ROOT,
        environment: {},
      }),
    ).rejects.toThrow("run the Stage 1 release through an npm script");
  });
});
