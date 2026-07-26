// Composes hosted release checks, browser coverage, evidence files, and Pages uploads.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { prepareApplicationExport } from "../../src/adapters/application-export";
import { loadPersistedProductionApplicationRelease } from "../../src/adapters/application-release";
import { runNpmCommand } from "../../src/adapters/npm-command-runner";
import { generateVyDexDatasetSchemaV1 } from "../../src/domain";
import {
  loadArchivedReleaseState,
  loadReleaseState,
  parseReleaseManifest,
  RELEASE_MANIFEST_PATH,
} from "../../src/release/release-publication";
import {
  verifyHostedStageOneRelease,
  type HostedVerificationReport,
} from "../../src/release/stage-one-hosted-verification";
import type { ReleaseLogger } from "../../src/shared/release-logger";

const require = createRequire(import.meta.url);
const DEFAULT_PROPAGATION_ATTEMPTS = 3;
const DEFAULT_PROPAGATION_RETRY_DELAY_MS = 30_000;

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function manifestFileRoute(path: string): string | undefined {
  if (path === "_headers" || path === "_redirects") return undefined;
  if (path === "index.html") return "/";
  if (path === "404.html") return "/__vydex-hosted-verification-not-found__/";
  if (path.endsWith("/index.html")) return `/${path.slice(0, -"index.html".length)}`;
  return `/${path}`;
}

async function appendRetainedImmutableChecks(input: {
  report: HostedVerificationReport;
  filesystem_root: string;
  request_origin: string;
  active_release_id: string;
  fetch: typeof fetch;
}): Promise<void> {
  const state = await loadReleaseState(input.filesystem_root);
  const seen = new Set<string>();
  for (const record of state.history.releases) {
    if (record.release_id === input.active_release_id) continue;
    const archive = await loadArchivedReleaseState(input.filesystem_root, record.release_id);
    for (const route of archive.immutable_contract.routes) {
      const identity = `${route.public_path}\0${route.sha256}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const response = await input.fetch(`${input.request_origin}${route.public_path}`, { headers: { "Accept-Encoding": "identity" } });
      const bytes = new Uint8Array(await response.arrayBuffer());
      input.report.checks.push({
        name: `retained immutable route ${record.release_id} ${route.public_path}`,
        passed: response.ok && bytes.byteLength === route.bytes && sha256(bytes) === route.sha256 &&
          response.headers.get("content-type") === route.content_type &&
          response.headers.get("cache-control") === route.cache_control &&
          (!route.content_disposition || response.headers.get("content-disposition")?.includes("attachment") === true),
      });
    }
  }
  input.report.success = input.report.checks.every(({ passed }) => passed);
}

export async function discoverHostedReleaseId(input: {
  request_origin: string;
  known_release_ids: readonly string[];
  fetch?: typeof fetch;
}): Promise<string> {
  const response = await (input.fetch ?? fetch)(`${input.request_origin}/export/`, { headers: { "Accept-Encoding": "identity" } });
  if (!response.ok) throw new Error(`Hosted release discovery returned HTTP ${response.status}.`);
  const body = await response.text();
  const matches = input.known_release_ids.filter((releaseId) => body.includes(releaseId));
  if (matches.length !== 1) throw new Error("Hosted release discovery did not identify exactly one known Release ID.");
  return matches[0]!;
}

export async function runArchivedHostedVerification(input: {
  filesystem_root: string;
  canonical_origin: string;
  request_origin: string;
  deployment_id: string;
  release_id: string;
  phase: string;
  logger: ReleaseLogger;
  environment?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
}): Promise<CompleteHostedVerificationResult> {
  const environment = input.environment ?? process.env;
  const request = input.fetch ?? fetch;
  const archive = await loadArchivedReleaseState(input.filesystem_root, input.release_id);
  const checks: HostedVerificationReport["checks"] = [];
  for (const file of archive.manifest.files) {
    const route = manifestFileRoute(file.path);
    if (!route) continue;
    const response = await request(`${input.request_origin}${route}`, { headers: { "Accept-Encoding": "identity" }, redirect: "manual" });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const expectedStatus = file.path === "404.html" ? 404 : 200;
    checks.push({ name: `archived file ${file.path}`, passed: response.status === expectedStatus && bytes.byteLength === file.bytes && sha256(bytes) === file.sha256 });
  }
  for (const redirect of archive.manifest.redirects) {
    const response = await request(`${input.request_origin}${redirect.source}`, { redirect: "manual" });
    checks.push({
      name: `archived redirect ${redirect.source}`,
      passed: response.status === redirect.status && response.headers.get("location") === redirect.destination,
    });
  }
  for (const route of archive.immutable_contract.routes) {
    const response = await request(`${input.request_origin}${route.public_path}`, { headers: { "Accept-Encoding": "identity" } });
    const bytes = new Uint8Array(await response.arrayBuffer());
    checks.push({
      name: `archived immutable metadata ${route.public_path}`,
      passed: response.ok && bytes.byteLength === route.bytes && sha256(bytes) === route.sha256 &&
        response.headers.get("content-type") === route.content_type &&
        response.headers.get("cache-control") === route.cache_control &&
        (!route.content_disposition || response.headers.get("content-disposition")?.includes("attachment") === true),
    });
  }
  const completeState = await loadReleaseState(input.filesystem_root);
  const selectedIndex = completeState.history.releases.findIndex(({ release_id }) => release_id === input.release_id);
  for (const laterRecord of completeState.history.releases.slice(selectedIndex + 1)) {
    const laterArchive = await loadArchivedReleaseState(input.filesystem_root, laterRecord.release_id);
    for (const route of laterArchive.immutable_contract.routes) {
      if (archive.manifest.generated_routes.includes(route.public_path)) continue;
      const response = await request(`${input.request_origin}${route.public_path}`, { redirect: "manual" });
      checks.push({ name: `later immutable route absent ${route.public_path}`, passed: response.status === 404 });
    }
  }
  const dataset = archive.immutable_contract.routes.find(({ public_path }) => public_path === archive.manifest.generated_routes.find((route) => route.includes("/datasets/releases/")));
  const startedAt = new Date().toISOString();
  const report: HostedVerificationReport = {
    report_version: "2.0.0",
    phase: input.phase,
    request_origin: input.request_origin,
    canonical_origin: input.canonical_origin,
    deployment_id: input.deployment_id,
    release_id: archive.manifest.release_id,
    source_commit: archive.manifest.source_commit,
    manifest_sha256: sha256(archive.manifest_raw),
    dataset_sha256: dataset?.sha256 ?? "missing",
    artifact_inventory_sha256: sha256(`${JSON.stringify(archive.manifest.files)}\n`),
    commit_sha: environment.GITHUB_SHA ?? "local",
    workflow_run_id: environment.GITHUB_RUN_ID ?? "local",
    workflow_run_attempt: environment.GITHUB_RUN_ATTEMPT ?? "local",
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    success: checks.every(({ passed }) => passed),
    checks,
  };
  const reportFilename = resolve(input.filesystem_root, `runtime/hosted-verification/report-${safePhaseName(input.phase)}.json`);
  await mkdir(dirname(reportFilename), { recursive: true });
  await writeFile(reportFilename, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (report.success) await input.logger.info(`Archived hosted verification ${input.phase} succeeded for ${input.release_id}.`);
  else await input.logger.error(`Archived hosted verification ${input.phase} failed for ${input.release_id}.`);
  return { report, report_filename: reportFilename };
}

type CompleteHostedVerificationInput = {
  filesystem_root: string;
  canonical_origin: string;
  request_origin: string;
  deployment_id: string;
  phase: string;
  logger: ReleaseLogger;
  include_browser?: boolean;
  environment?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
};

type CompleteHostedVerificationResult = {
  report: HostedVerificationReport;
  report_filename: string;
};

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

export async function runCompleteHostedVerification(
  input: CompleteHostedVerificationInput,
): Promise<CompleteHostedVerificationResult> {
  const environment = input.environment ?? process.env;
  const manifestRaw = await readFile(
    resolve(input.filesystem_root, RELEASE_MANIFEST_PATH),
    "utf8",
  );
  const manifest = parseReleaseManifest(manifestRaw);
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
  await appendRetainedImmutableChecks({
    report,
    filesystem_root: input.filesystem_root,
    request_origin: input.request_origin,
    active_release_id: manifest.release_id,
    fetch: input.fetch ?? fetch,
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

export async function runCompleteHostedVerificationAfterPropagation(
  input: CompleteHostedVerificationInput & {
    max_attempts?: number;
    retry_delay_ms?: number;
    sleep?: (milliseconds: number) => Promise<void>;
    run_verification?: (
      verificationInput: CompleteHostedVerificationInput,
    ) => Promise<CompleteHostedVerificationResult>;
  },
): Promise<CompleteHostedVerificationResult> {
  const {
    max_attempts = DEFAULT_PROPAGATION_ATTEMPTS,
    retry_delay_ms = DEFAULT_PROPAGATION_RETRY_DELAY_MS,
    sleep = (milliseconds) => new Promise((complete) => setTimeout(complete, milliseconds)),
    run_verification = runCompleteHostedVerification,
    ...verificationInput
  } = input;
  if (!Number.isInteger(max_attempts) || max_attempts < 1) {
    throw new Error("Hosted propagation verification requires at least one whole-number attempt.");
  }
  if (!Number.isFinite(retry_delay_ms) || retry_delay_ms < 0) {
    throw new Error("Hosted propagation verification requires a non-negative retry delay.");
  }

  let lastResult: CompleteHostedVerificationResult | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= max_attempts; attempt += 1) {
    try {
      lastResult = await run_verification(verificationInput);
      if (lastResult.report.success) return lastResult;
      lastError = undefined;
    } catch (error) {
      lastError = error;
    }
    if (attempt === max_attempts) break;

    const failedChecks = lastResult?.report.checks
      .filter(({ passed }) => !passed)
      .map(({ name }) => name)
      .join(", ");
    await input.logger.warning(
      failedChecks
        ? `Hosted verification phase ${input.phase} attempt ${attempt}/${max_attempts} observed an incomplete Pages surface (${failedChecks}). Waiting ${retry_delay_ms}ms for edge propagation.`
        : `Hosted verification phase ${input.phase} attempt ${attempt}/${max_attempts} could not complete. Waiting ${retry_delay_ms}ms for edge propagation.`,
    );
    await sleep(retry_delay_ms);
  }

  if (lastError) throw lastError;
  if (lastResult) return lastResult;
  throw new Error("Hosted propagation verification ended without an attempt result.");
}
