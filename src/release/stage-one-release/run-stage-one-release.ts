// Orchestrates the all-or-nothing Stage 1 production release gate.
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { v7 as uuidV7 } from "uuid";
import { prepareApplicationExport, type PreparedApplicationExport } from "../../adapters/application-export";
import { loadCanonicalRecords } from "../../adapters/canonical-record-loader";
import { writeDatasetArtifact } from "../../adapters/dataset-artifact-writer";
import {
  createStageOneReleaseDescriptor,
  readStageOneReleaseDescriptor,
} from "../../adapters/stage-one-release-descriptor";
import {
  constructReleaseModel,
  releaseMetadataSchema,
  type ReleaseMetadata,
  type ReleaseModel,
} from "../../domain";
import type { ReleaseLogger } from "../../shared/release-logger";
import { enrichValidationDiagnostic, releaseGateDiagnostic, type StageOneReleaseDiagnostic } from "./diagnostics";
import {
  buildStageOneReleaseManifest,
  parseExistingStageOneReleaseManifest,
  serializeStageOneReleaseManifest,
  STAGE_ONE_RELEASE_MANIFEST_PATH,
  validateImmutableDatasetAgainstPreviousManifest,
  type StageOneReleaseManifest,
} from "./manifest";
import { promoteStageOneReleaseOutput } from "./promotion";
import { collectStageOneRedirects, serializeStageOneRedirects } from "./redirects";
import { verifyStageOneStaticOutput } from "./static-output-verifier";

export const STAGE_ONE_PUBLIC_SITE_ORIGIN = "https://vydex.vyce.workers.dev" as const;

export type StageOneReleaseCommand = "typecheck" | "test" | "build";
export type StageOneCommandResult = { exit_code: number; output: string };
export type RunStageOneCommand = (input: {
  command: StageOneReleaseCommand;
  working_directory: string;
  output_directory?: string;
  environment: NodeJS.ProcessEnv;
}) => Promise<StageOneCommandResult>;

export type RunStageOneReleaseResult =
  | {
      success: true;
      descriptor_status: "created" | "existing";
      manifest: StageOneReleaseManifest;
      diagnostics: readonly [];
    }
  | { success: false; diagnostics: StageOneReleaseDiagnostic[] };

type StageOneReleaseDependencies = {
  now: () => Date;
  create_release_id: () => string;
  run_command: RunStageOneCommand;
  logger: ReleaseLogger;
};

const NOOP_LOGGER: ReleaseLogger = {
  log: async () => undefined,
  debug: async () => undefined,
  info: async () => undefined,
  warning: async () => undefined,
  error: async () => undefined,
  critical: async () => undefined,
  filename: "",
};

function executableName(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function defaultRunCommand(input: Parameters<RunStageOneCommand>[0]): Promise<StageOneCommandResult> {
  const argsByCommand: Record<StageOneReleaseCommand, string[]> = {
    typecheck: ["run", "typecheck"],
    test: ["test"],
    build: ["exec", "--", "astro", "build", "--outDir", input.output_directory!],
  };
  return new Promise((complete, reject) => {
    const child = spawn(executableName(), argsByCommand[input.command], {
      cwd: input.working_directory,
      env: input.environment,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => complete({ exit_code: code ?? 1, output }));
  });
}

function commandFailure(
  command: StageOneReleaseCommand,
  output: string,
): StageOneReleaseDiagnostic {
  const summary = output.trim().split(/\r?\n/).slice(-20).join("\n");
  return releaseGateDiagnostic({
    code: `${command}_failed`,
    field: command,
    rule: `${command} returned a non-zero result.${summary ? `\n${summary}` : ""}`,
    generated_surfaces: ["Production static output"],
  });
}

async function runQualityChecks(input: {
  filesystem_root: string;
  runtime_root: string;
  run_command: RunStageOneCommand;
  logger: ReleaseLogger;
}): Promise<StageOneReleaseDiagnostic[]> {
  const environment = {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: "1",
    PUBLIC_SITE_ORIGIN: STAGE_ONE_PUBLIC_SITE_ORIGIN,
  };
  await input.logger.info("Running strict TypeScript and Astro checks.");
  const typecheck = await input.run_command({
    command: "typecheck",
    working_directory: input.filesystem_root,
    environment,
  });
  await input.logger.debug(typecheck.output.trim());
  if (typecheck.exit_code !== 0) return [commandFailure("typecheck", typecheck.output)];

  await input.logger.info("Running the complete Vitest release suite.");
  const tests = await input.run_command({
    command: "test",
    working_directory: input.filesystem_root,
    environment,
  });
  await writeFile(resolve(input.runtime_root, "test-output.txt"), tests.output, "utf8");
  if (tests.exit_code !== 0) return [commandFailure("test", tests.output)];
  const summary = tests.output.trim().split(/\r?\n/).slice(-8).join("\n");
  await input.logger.info(`Vitest completed successfully.\n${summary}`);
  return [];
}

function createCandidateMetadata(dependencies: StageOneReleaseDependencies): ReleaseMetadata {
  return releaseMetadataSchema.parse({
    release_id: dependencies.create_release_id(),
    generated_at: dependencies.now().toISOString(),
  });
}

function constructPreparedRelease(input: {
  records: Awaited<ReturnType<typeof loadCanonicalRecords>>;
  metadata: ReleaseMetadata;
}):
  | { success: true; release: ReleaseModel; prepared_export: PreparedApplicationExport }
  | { success: false; diagnostics: StageOneReleaseDiagnostic[] } {
  const result = constructReleaseModel({
    records: input.records,
    release_metadata: input.metadata,
    site_origin: STAGE_ONE_PUBLIC_SITE_ORIGIN,
    mode: "production",
  });
  if (result.mode !== "production" || !result.success) {
    const validationDiagnostics = result.mode === "production" ? result.diagnostics : [];
    return {
      success: false,
      diagnostics: [
        ...validationDiagnostics.map(enrichValidationDiagnostic),
        releaseGateDiagnostic({
          code: "release_artifacts_unavailable",
          field: "schema/export",
          rule: "JSON Schema and export output are unavailable because strict release construction failed.",
          generated_surfaces: ["JSON Schema", "JSON export"],
        }),
      ],
    };
  }
  const prepared = prepareApplicationExport(result.release);
  if (!prepared.success) {
    return {
      success: false,
      diagnostics: [
        ...prepared.diagnostics.map(enrichValidationDiagnostic),
        releaseGateDiagnostic({
          code: "release_artifacts_unavailable",
          field: "schema/export",
          rule: "JSON Schema and export output are unavailable because export preparation failed.",
          generated_surfaces: ["JSON Schema", "JSON export"],
        }),
      ],
    };
  }
  return { success: true, release: result.release, prepared_export: prepared.data };
}

function canonicalInputFingerprint(records: Awaited<ReturnType<typeof loadCanonicalRecords>>): string {
  const sources = [
    ...records.entries,
    ...records.topic_trails,
    ...records.methodologies,
    ...records.about,
    ...records.methodology_publication_events,
    ...records.entry_publication_snapshots,
  ].sort((left, right) => left.filename.localeCompare(right.filename, "en"));
  const hash = createHash("sha256");
  for (const source of sources) {
    hash.update(source.record_type);
    hash.update("\u0000");
    hash.update(source.filename);
    hash.update("\u0000");
    hash.update(source.raw_text ?? "");
    hash.update("\u0000");
  }
  for (const diagnostic of records.diagnostics) hash.update(JSON.stringify(diagnostic));
  return hash.digest("hex");
}

async function readPreviousManifest(filesystemRoot: string): Promise<StageOneReleaseManifest | undefined> {
  try {
    const rawText = await readFile(resolve(filesystemRoot, STAGE_ONE_RELEASE_MANIFEST_PATH), "utf8");
    return parseExistingStageOneReleaseManifest(rawText);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error(`Existing Stage 1 release manifest is unreadable or invalid at ${STAGE_ONE_RELEASE_MANIFEST_PATH}.`, {
      cause: error,
    });
  }
}

async function fail(
  logger: ReleaseLogger,
  diagnostics: StageOneReleaseDiagnostic[],
): Promise<RunStageOneReleaseResult> {
  await logger.error(`Stage 1 release blocked with ${diagnostics.length} diagnostic(s).`);
  return { success: false, diagnostics };
}

export async function runStageOneRelease(input: {
  filesystem_root: string;
  dependencies?: Partial<StageOneReleaseDependencies>;
}): Promise<RunStageOneReleaseResult> {
  const filesystemRoot = resolve(input.filesystem_root);
  const runtimeRoot = resolve(filesystemRoot, "runtime");
  await mkdir(runtimeRoot, { recursive: true });
  const dependencies: StageOneReleaseDependencies = {
    now: input.dependencies?.now ?? (() => new Date()),
    create_release_id: input.dependencies?.create_release_id ?? uuidV7,
    run_command: input.dependencies?.run_command ?? defaultRunCommand,
    logger: input.dependencies?.logger ?? NOOP_LOGGER,
  };
  const logger = dependencies.logger;
  await logger.info(`Starting the Stage 1 release gate for ${STAGE_ONE_PUBLIC_SITE_ORIGIN}.`);

  const qualityDiagnostics = await runQualityChecks({
    filesystem_root: filesystemRoot,
    runtime_root: runtimeRoot,
    run_command: dependencies.run_command,
    logger,
  });
  if (qualityDiagnostics.length > 0) return fail(logger, qualityDiagnostics);

  let descriptorRead;
  try {
    descriptorRead = await readStageOneReleaseDescriptor(filesystemRoot);
  } catch (error) {
    return fail(logger, [
      releaseGateDiagnostic({
        code: "release_descriptor_invalid",
        field: "generated/release-data/release.json",
        rule: error instanceof Error ? error.message : String(error),
        generated_surfaces: ["All public routes", "JSON export", "Release manifest"],
      }),
    ]);
  }

  const records = await loadCanonicalRecords({ filesystem_root: filesystemRoot });
  const inputFingerprint = canonicalInputFingerprint(records);
  let metadata = descriptorRead.status === "existing"
    ? descriptorRead.descriptor
    : createCandidateMetadata(dependencies);
  let prepared = constructPreparedRelease({ records, metadata });
  if (!prepared.success) return fail(logger, prepared.diagnostics);

  let descriptorStatus: "created" | "existing" = "existing";
  if (descriptorRead.status === "missing") {
    let persisted;
    try {
      persisted = await createStageOneReleaseDescriptor(filesystemRoot, metadata);
    } catch (error) {
      return fail(logger, [
        releaseGateDiagnostic({
          code: "release_descriptor_creation_failed",
          field: "generated/release-data/release.json",
          rule: error instanceof Error ? error.message : String(error),
          generated_surfaces: ["All public routes", "JSON export", "Release manifest"],
        }),
      ]);
    }
    descriptorStatus = persisted.status;
    metadata = persisted.descriptor;
    if (
      metadata.release_id !== prepared.release.release_metadata.release_id ||
      metadata.generated_at !== prepared.release.release_metadata.generated_at
    ) {
      prepared = constructPreparedRelease({ records, metadata });
      if (!prepared.success) return fail(logger, prepared.diagnostics);
    }
    await logger.info(
      descriptorStatus === "created"
        ? "Created the initial persisted Stage 1 release descriptor."
        : "Loaded the descriptor created by a concurrent Stage 1 release run.",
    );
  } else {
    await logger.info("Loaded and preserved the existing Stage 1 release descriptor.");
  }

  const stagingRoot = await mkdtemp(resolve(runtimeRoot, "stage-one-release-"));
  const stagingOutput = resolve(stagingRoot, "dist");
  try {
    await logger.info("Building production static output in isolated staging.");
    const build = await dependencies.run_command({
      command: "build",
      working_directory: filesystemRoot,
      output_directory: stagingOutput,
      environment: {
        ...process.env,
        ASTRO_TELEMETRY_DISABLED: "1",
        PUBLIC_SITE_ORIGIN: STAGE_ONE_PUBLIC_SITE_ORIGIN,
        VYDEX_ATOMIC_RELEASE_BUILD: "1",
      },
    });
    await logger.debug(build.output.trim());
    if (build.exit_code !== 0) return fail(logger, [commandFailure("build", build.output)]);

    const postBuildRecords = await loadCanonicalRecords({ filesystem_root: filesystemRoot });
    if (canonicalInputFingerprint(postBuildRecords) !== inputFingerprint) {
      return fail(logger, [
        releaseGateDiagnostic({
          code: "canonical_inputs_changed_during_build",
          field: "data/canonical-records,data/publication-snapshots",
          rule: "Canonical records and snapshots must remain byte-identical throughout the atomic build.",
          generated_surfaces: ["All public routes", "Changelog", "JSON export"],
        }),
      ]);
    }

    const artifactWrite = await writeDatasetArtifact({
      output_root: stagingOutput,
      artifact: prepared.prepared_export.artifact,
    });
    if (!artifactWrite.success) {
      return fail(logger, artifactWrite.diagnostics.map(enrichValidationDiagnostic));
    }

    const redirects = collectStageOneRedirects(prepared.release, prepared.prepared_export);
    await writeFile(resolve(stagingOutput, "_redirects"), serializeStageOneRedirects(redirects), "utf8");
    const verification = await verifyStageOneStaticOutput({
      output_root: stagingOutput,
      release: prepared.release,
      prepared_export: prepared.prepared_export,
    });
    if (verification.diagnostics.length > 0) return fail(logger, verification.diagnostics);

    const manifest = await buildStageOneReleaseManifest({
      output_root: stagingOutput,
      release: prepared.release,
      prepared_export: prepared.prepared_export,
      generated_routes: verification.generated_routes,
    });
    let previousManifest: StageOneReleaseManifest | undefined;
    try {
      previousManifest = await readPreviousManifest(filesystemRoot);
    } catch (error) {
      return fail(logger, [
        releaseGateDiagnostic({
          code: "previous_release_manifest_invalid",
          field: STAGE_ONE_RELEASE_MANIFEST_PATH,
          rule: error instanceof Error ? error.message : String(error),
          generated_surfaces: ["Release manifest", "Promotable static output"],
        }),
      ]);
    }
    const immutableDiagnostics = validateImmutableDatasetAgainstPreviousManifest({
      previous_manifest: previousManifest,
      next_manifest: manifest,
      export_public_path: prepared.prepared_export.artifact.public_path,
    });
    if (immutableDiagnostics.length > 0) return fail(logger, immutableDiagnostics);

    await promoteStageOneReleaseOutput({
      filesystem_root: filesystemRoot,
      staged_output_root: stagingOutput,
      serialized_manifest: serializeStageOneReleaseManifest(manifest),
      transaction_id: randomUUID(),
    });
    await logger.info(`Stage 1 release verified and promoted with ${manifest.generated_routes.length} public routes.`);
    return { success: true, descriptor_status: descriptorStatus, manifest, diagnostics: [] };
  } catch (error) {
    return fail(logger, [
      releaseGateDiagnostic({
        code: "release_gate_operation_failed",
        rule: error instanceof Error ? error.message : String(error),
        generated_surfaces: ["Promotable static output", "Release manifest"],
      }),
    ]);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}
