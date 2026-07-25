// Serves one staged Stage 1 output directory and runs Playwright against it.
import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { BROWSER_TEST_HOST, BROWSER_TEST_PORT, BROWSER_TEST_URL } from "../../tests/browser/playwright-config";

const require = createRequire(import.meta.url);
const SERVER_START_TIMEOUT_MS = 30_000;
const SERVER_POLL_INTERVAL_MS = 100;

function packageExecutable(packageName: string, relativeExecutable: string): string {
  return resolve(dirname(require.resolve(`${packageName}/package.json`)), relativeExecutable);
}

function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise((complete, reject) => {
    child.once("error", reject);
    child.once("close", (code) => complete(code ?? 1));
  });
}

async function waitForServer(server: ChildProcess): Promise<void> {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Wrangler Pages preview exited with code ${server.exitCode}.`);
    }
    try {
      const response = await fetch(BROWSER_TEST_URL);
      if (response.ok) return;
    } catch {}
    await new Promise((complete) => setTimeout(complete, SERVER_POLL_INTERVAL_MS));
  }
  throw new Error("Wrangler Pages preview did not become ready before the browser-test timeout.");
}

async function main(): Promise<void> {
  const outputRootArgument = process.argv[2];
  if (!outputRootArgument) throw new Error("A staged static output directory is required.");
  const filesystemRoot = process.cwd();
  const outputRoot = resolve(outputRootArgument);
  const persistenceRoot = resolve(filesystemRoot, "runtime/wrangler-state");
  const wranglerExecutable = packageExecutable("wrangler", "bin/wrangler.js");
  const playwrightExecutable = require.resolve("@playwright/test/cli");
  const server = spawn(
    process.execPath,
    [
      wranglerExecutable,
      "pages",
      "dev",
      outputRoot,
      "--ip",
      BROWSER_TEST_HOST,
      "--port",
      String(BROWSER_TEST_PORT),
      "--persist-to",
      persistenceRoot,
      "--log-level",
      "error",
      "--show-interactive-dev-session=false",
    ],
    { cwd: filesystemRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  server.stdout?.pipe(process.stdout);
  server.stderr?.pipe(process.stderr);

  try {
    await waitForServer(server);
    const tests = spawn(
      process.execPath,
      [playwrightExecutable, "test", "--config", "playwright.release.config.ts"],
      { cwd: filesystemRoot, env: process.env, stdio: "inherit", windowsHide: true },
    );
    process.exitCode = await waitForExit(tests);
  } finally {
    server.kill();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Stage 1 browser checks failed unexpectedly: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
