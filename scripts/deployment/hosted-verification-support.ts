// Composes hosted release checks, browser coverage, evidence files, and Pages uploads.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { prepareApplicationExport } from "../../src/adapters/application-export";
import { loadPersistedProductionApplicationRelease } from "../../src/adapters/application-release";
import { runNpmCommand } from "../../src/adapters/npm-command-runner";
import { generateVyDexDatasetSchemaV1 } from "../../src/domain";
import {
  parseExistingStageOneReleaseManifest,
  STAGE_ONE_RELEASE_MANIFEST_PATH,
} from "../../src/release/stage-one-release";
import {
  verifyHostedStageOneRelease,
  type HostedVerificationReport,
} from "../../src/release/stage-one-hosted-verification";
import type { ReleaseLogger } from "../../src/shared/release-logger";

const require = createRequire(import.meta.url);

function safePhaseName(phase: string): string {
  return phase.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "verification";
}

function waitForExit(child: ReturnType<typeof spawn>): Promise<number> {
  return new Promise((complete, reject) => {
    child.once("error", reject);
    child.once("close", (code) => complete(code ?? 1));
  });
}

export async function deployPagesOutput(input: {
  filesystem_root: string;
  project_name: string;
  commit_sha: string;
  environment: NodeJS.ProcessEnv;
  output_root?: string;
}): Promise<void> {
  const wranglerExecutable = resolve(
    dirname(require.resolve("wrangler/package.json")),
    "bin/wrangler.js",
  );
  const outputRoot = resolve(input.filesystem_root, input.output_root ?? "dist");
  const child = spawn(
    process.execPath,
    [
      wranglerExecutable,
      "pages",
      "deploy",
      outputRoot,
      "--project-name",
      input.project_name,
      "--branch",
      "main",
      "--commit-hash",
      input.commit_sha,
    ],
    {
      cwd: input.filesystem_root,
      env: input.environment,
      stdio: "inherit",
      windowsHide: true,
    },
  );
  const exitCode = await waitForExit(child);
  if (exitCode !== 0) throw new Error(`Wrangler Pages deployment exited with code ${exitCode}.`);
}

export async function runCompleteHostedVerification(input: {
  filesystem_root: string;
  canonical_origin: string;
  request_origin: string;
  deployment_id: string;
  phase: string;
  logger: ReleaseLogger;
  include_browser?: boolean;
  environment?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
}): Promise<{ report: HostedVerificationReport; report_filename: string }> {
  const environment = input.environment ?? process.env;
  const manifestRaw = await readFile(
    resolve(input.filesystem_root, STAGE_ONE_RELEASE_MANIFEST_PATH),
    "utf8",
  );
  const manifest = parseExistingStageOneReleaseManifest(manifestRaw);
  const release = await loadPersistedProductionApplicationRelease({
    filesystem_root: input.filesystem_root,
    site_origin: input.canonical_origin,
  });
  const prepared = prepareApplicationExport(release);
  if (!prepared.success) {
    throw new Error(`Hosted verification could not prepare the Dataset: ${prepared.diagnostics.map(({ code }) => code).join(", ")}.`);
  }
  const schema = generateVyDexDatasetSchemaV1({ site_origin: input.canonical_origin });
  if (!schema.success) {
    throw new Error(`Hosted verification could not prepare the Schema: ${schema.diagnostics.map(({ code }) => code).join(", ")}.`);
  }

  await input.logger.info(`Starting hosted verification phase ${input.phase} for deployment ${input.deployment_id}.`);
  const report = await verifyHostedStageOneRelease({
    phase: input.phase,
    request_origin: input.request_origin,
    canonical_origin: input.canonical_origin,
    deployment_id: input.deployment_id,
    release,
    prepared_export: prepared.data,
    schema_serialized_json: schema.data.serialized_json,
    manifest,
    manifest_serialized_json: manifestRaw,
    commit_sha: environment.GITHUB_SHA,
    workflow_run_id: environment.GITHUB_RUN_ID,
    workflow_run_attempt: environment.GITHUB_RUN_ATTEMPT,
    fetch: input.fetch,
  });

  if (input.include_browser !== false) {
    const phaseName = safePhaseName(input.phase);
    const browserOutputFilename = resolve(
      input.filesystem_root,
      `runtime/hosted-verification/browser-${phaseName}.txt`,
    );
    await mkdir(dirname(browserOutputFilename), { recursive: true });
    try {
      const browserResult = await runNpmCommand({
        command_arguments: ["run", "test:browser:hosted:run"],
        working_directory: input.filesystem_root,
        environment: {
          ...environment,
          PUBLIC_SITE_ORIGIN: input.canonical_origin,
          VYDEX_BROWSER_BASE_URL: input.request_origin,
        },
      });
      await writeFile(browserOutputFilename, browserResult.output, "utf8");
      report.checks.push({
        name: "hosted Playwright and Axe suite",
        passed: browserResult.exit_code === 0,
        ...(browserResult.exit_code === 0
          ? {}
          : { detail: `Hosted browser checks exited with code ${browserResult.exit_code}; see ${browserOutputFilename}.` }),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.stack ?? error.message : String(error);
      await writeFile(browserOutputFilename, `${detail}\n`, "utf8");
      report.checks.push({
        name: "hosted Playwright and Axe suite",
        passed: false,
        detail: `Hosted browser checks could not start; see ${browserOutputFilename}.`,
      });
    }
    report.success = report.checks.every(({ passed }) => passed);
  }
  report.completed_at = new Date().toISOString();

  const phaseName = safePhaseName(input.phase);
  const reportFilename = resolve(
    input.filesystem_root,
    `runtime/hosted-verification/report-${phaseName}.json`,
  );
  await mkdir(dirname(reportFilename), { recursive: true });
  await writeFile(reportFilename, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (report.success) await input.logger.info(`Hosted verification phase ${input.phase} succeeded.`);
  else await input.logger.error(`Hosted verification phase ${input.phase} failed; see ${reportFilename}.`);
  return { report, report_filename: reportFilename };
}
