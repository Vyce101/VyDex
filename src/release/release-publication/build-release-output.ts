// Builds and verifies one complete release candidate without selecting active state.
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prepareApplicationExport, type PreparedApplicationExport } from "../../adapters/application-export";
import { loadCanonicalRecords } from "../../adapters/canonical-record-loader";
import { writeDatasetArtifact } from "../../adapters/dataset-artifact-writer";
import { runNpmCommand } from "../../adapters/npm-command-runner";
import {
  constructReleaseModel,
  type ReleaseHistory,
  type ReleaseMetadata,
  type ReleaseModel,
  type SiteOrigin,
} from "../../domain";
import type { ReleaseLogger } from "../../shared/release-logger";
import { collectStageOneRedirects, serializeStageOneRedirects } from "../stage-one-release/redirects";
import { expectedStageOneGeneratedRoutes } from "../stage-one-release/static-output-routes";
import { verifyStageOneStaticOutput } from "../stage-one-release/static-output-verifier";
import { materializeRetainedImmutableArtifacts } from "./immutable-artifacts";
import { buildReleaseManifest, type ReleaseManifest } from "./manifest";

export type ReleaseBuildCommand = "typecheck" | "test" | "build" | "browser";
export type RunReleaseBuildCommand = (input: {
  command: ReleaseBuildCommand;
  working_directory: string;
  output_directory?: string;
  environment: NodeJS.ProcessEnv;
}) => Promise<{ exit_code: number; output: string }>;

async function defaultRunCommand(input: Parameters<RunReleaseBuildCommand>[0]) {
  const argumentsByCommand: Record<ReleaseBuildCommand, string[]> = {
    typecheck: ["run", "typecheck"],
    test: ["test"],
    build: ["exec", "--", "astro", "build", "--outDir", input.output_directory!],
    browser: ["exec", "--", "tsx", "scripts/test/run-stage-one-browser-checks.ts", input.output_directory!],
  };
  return runNpmCommand({
    command_arguments: argumentsByCommand[input.command],
    working_directory: input.working_directory,
    environment: input.environment,
  });
}

function inputFingerprint(records: Awaited<ReturnType<typeof loadCanonicalRecords>>): string {
  const sources = [
    ...records.entries,
    ...records.topic_trails,
    ...records.methodologies,
    ...records.about,
    ...records.methodology_publication_events,
    ...records.entry_publication_snapshots,
  ].sort((left, right) => left.filename.localeCompare(right.filename, "en"));
  const hash = createHash("sha256");
  for (const source of sources) hash.update(`${source.record_type}\0${source.filename}\0${source.raw_text ?? ""}\0`);
  for (const diagnostic of records.diagnostics) hash.update(JSON.stringify(diagnostic));
  return hash.digest("hex");
}

async function requireSuccessfulCommand(input: {
  command: ReleaseBuildCommand;
  repository_root: string;
  output_root?: string;
  environment: NodeJS.ProcessEnv;
  run_command: RunReleaseBuildCommand;
  output_file?: string;
}): Promise<void> {
  const result = await input.run_command({
    command: input.command,
    working_directory: input.repository_root,
    output_directory: input.output_root,
    environment: input.environment,
  });
  if (input.output_file) await writeFile(input.output_file, result.output, "utf8");
  if (result.exit_code !== 0) {
    const summary = result.output.trim().split(/\r?\n/).slice(-20).join("\n");
    throw new Error(`${input.command} returned a non-zero result.${summary ? `\n${summary}` : ""}`);
  }
}

function prepareRelease(input: {
  records: Awaited<ReturnType<typeof loadCanonicalRecords>>;
  descriptor: ReleaseMetadata;
  site_origin: SiteOrigin;
}): { release: ReleaseModel; prepared_export: PreparedApplicationExport } {
  const result = constructReleaseModel({
    records: input.records,
    release_metadata: input.descriptor,
    site_origin: input.site_origin,
    mode: "production",
  });
  if (result.mode !== "production" || !result.success) {
    const codes = result.mode === "production" ? result.diagnostics.map(({ code }) => code).join(", ") : "unexpected_preview";
    throw new Error(`Release construction failed: ${codes}.`);
  }
  const prepared = prepareApplicationExport(result.release);
  if (!prepared.success) throw new Error(`Dataset preparation failed: ${prepared.diagnostics.map(({ code }) => code).join(", ")}.`);
  return { release: result.release, prepared_export: prepared.data };
}

export async function buildVerifiedReleaseOutput(input: {
  repository_root: string;
  site_origin: SiteOrigin;
  descriptor: ReleaseMetadata;
  source_commit: string;
  previous_release_id: string | null;
  retained_release_ids: readonly string[];
  retained_history: ReleaseHistory;
  exclude_retained_release_id?: string;
  logger: ReleaseLogger;
  run_quality_checks?: boolean;
  run_command?: RunReleaseBuildCommand;
}): Promise<{
  staging_root: string;
  output_root: string;
  manifest: ReleaseManifest;
  release: ReleaseModel;
  prepared_export: PreparedApplicationExport;
  input_fingerprint: string;
}> {
  const runtimeRoot = resolve(input.repository_root, "runtime");
  await mkdir(runtimeRoot, { recursive: true });
  const stagingRoot = await mkdtemp(resolve(runtimeRoot, "release-publication-"));
  const outputRoot = resolve(stagingRoot, "dist");
  const descriptorFilename = resolve(stagingRoot, "release.json");
  await writeFile(descriptorFilename, `${JSON.stringify(input.descriptor, null, 2)}\n`, "utf8");
  const runCommand = input.run_command ?? defaultRunCommand;
  const qualityEnvironment = {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: "1",
    PUBLIC_SITE_ORIGIN: input.site_origin,
  };
  const buildEnvironment = {
    ...qualityEnvironment,
    VYDEX_ATOMIC_RELEASE_BUILD: "1",
    VYDEX_RELEASE_DESCRIPTOR_PATH: descriptorFilename,
  };
  if (input.run_quality_checks !== false) {
    await input.logger.info("Running strict TypeScript and complete Vitest release checks.");
    await requireSuccessfulCommand({ command: "typecheck", repository_root: input.repository_root, environment: qualityEnvironment, run_command: runCommand });
    await requireSuccessfulCommand({
      command: "test",
      repository_root: input.repository_root,
      environment: qualityEnvironment,
      run_command: runCommand,
      output_file: resolve(runtimeRoot, "test-output.txt"),
    });
  }
  const records = await loadCanonicalRecords({ filesystem_root: input.repository_root });
  const fingerprint = inputFingerprint(records);
  const prepared = prepareRelease({ records, descriptor: input.descriptor, site_origin: input.site_origin });
  await input.logger.info("Building the complete release in isolated runtime storage.");
  await requireSuccessfulCommand({ command: "build", repository_root: input.repository_root, output_root: outputRoot, environment: buildEnvironment, run_command: runCommand });
  const postBuildRecords = await loadCanonicalRecords({ filesystem_root: input.repository_root });
  if (inputFingerprint(postBuildRecords) !== fingerprint) throw new Error("Canonical records or snapshots changed during release construction.");
  const writeResult = await writeDatasetArtifact({ output_root: outputRoot, artifact: prepared.prepared_export.artifact });
  if (!writeResult.success) throw new Error(`Immutable Dataset emission failed: ${writeResult.diagnostics.map(({ code }) => code).join(", ")}.`);
  await writeFile(
    resolve(outputRoot, "_redirects"),
    serializeStageOneRedirects(collectStageOneRedirects(prepared.release, prepared.prepared_export)),
    "utf8",
  );
  const retainedRoutes = await materializeRetainedImmutableArtifacts({
    repository_root: input.repository_root,
    output_root: outputRoot,
    history: input.retained_history,
    exclude_release_id: input.exclude_retained_release_id,
  });
  const verification = await verifyStageOneStaticOutput({
    output_root: outputRoot,
    release: prepared.release,
    prepared_export: prepared.prepared_export,
    retained_immutable_routes: retainedRoutes,
  });
  if (verification.diagnostics.length > 0) {
    throw new Error(`Static release verification failed: ${verification.diagnostics.map(({ code }) => code).join(", ")}.`);
  }
  await input.logger.info("Running Playwright journeys and Axe checks against the exact candidate output.");
  await requireSuccessfulCommand({
    command: "browser",
    repository_root: input.repository_root,
    output_root: outputRoot,
    environment: qualityEnvironment,
    run_command: runCommand,
    output_file: resolve(runtimeRoot, "browser-test-output.txt"),
  });
  const currentRoutes = expectedStageOneGeneratedRoutes(prepared.release);
  const manifest = await buildReleaseManifest({
    output_root: outputRoot,
    release: prepared.release,
    prepared_export: prepared.prepared_export,
    source_commit: input.source_commit,
    previous_release_id: input.previous_release_id,
    retained_release_ids: input.retained_release_ids,
    current_release_routes: currentRoutes,
    retained_immutable_routes: retainedRoutes,
  });
  return { staging_root: stagingRoot, output_root: outputRoot, manifest, ...prepared, input_fingerprint: fingerprint };
}
