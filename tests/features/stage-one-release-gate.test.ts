// Exercises the complete Stage 1 gate against isolated repository data and synthetic static output.
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prepareApplicationExport } from "../../src/adapters/application-export";
import { loadPersistedProductionApplicationRelease } from "../../src/adapters/application-release";
import { parseRequiredPublicSiteOrigin } from "../../src/adapters/public-site-origin";
import { createStageOneReleaseDescriptor } from "../../src/adapters/stage-one-release-descriptor";
import { generateVyDexDatasetSchemaV1, type ReleaseModel } from "../../src/domain";
import {
  collectStageOneRedirects,
  runStageOneRelease,
  serializeStageOneRedirects,
  STAGE_ONE_RELEASE_MANIFEST_PATH,
  type RunStageOneCommand,
} from "../../src/release/stage-one-release";
import type { ReleaseLogger } from "../../src/shared/release-logger";

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");
const TEST_SITE_ORIGIN = parseRequiredPublicSiteOrigin("https://vydex-preview-123.pages.dev");
const FIXED_DESCRIPTOR = {
  release_id: "01900000-0000-7000-8000-000000000099",
  generated_at: "2026-07-25T20:00:00.000Z",
} as const;
const roots: string[] = [];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function shell(content: string, canonicalUrl?: string): string {
  const headerLinks = ["/#latest", "/methodology/", "/about/", "/changelog/", "/export/"];
  const footerLinks = ["/about/", "/methodology/", "/changelog/", "/export/"];
  const navigation = `<nav>${headerLinks.map((href) => `<a href="${href}">${href}</a>`).join("")}</nav>`;
  return [
    "<!doctype html><html><head>",
    canonicalUrl ? `<link rel="canonical" href="${canonicalUrl}">` : "",
    "</head><body>",
    `<a href="#main-content">Skip</a><header class="site-header">${navigation}${navigation}</header>`,
    `<main id="main-content">${content}</main>`,
    `<footer class="site-footer"><nav>${footerLinks.map((href) => `<a href="${href}">${href}</a>`).join("")}</nav></footer>`,
    "</body></html>",
  ].join("");
}

function routeFilename(outputRoot: string, route: string): string {
  if (route === "/") return resolve(outputRoot, "index.html");
  const relativeRoute = route.replace(/^\/+/, "");
  return route.endsWith("/")
    ? resolve(outputRoot, relativeRoute, "index.html")
    : resolve(outputRoot, relativeRoute);
}

async function writeRoute(outputRoot: string, route: string, contents: string): Promise<void> {
  const filename = routeFilename(outputRoot, route);
  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, contents, "utf8");
}

function preview(entry: ReleaseModel["current_entries"][number]): string {
  return `<article data-entry-preview><h3 data-entry-preview-field="title"><a href="${entry.canonical_url}">${escapeHtml(entry.entry.title)}</a></h3></article>`;
}

async function materializeVerifiedOutput(
  filesystemRoot: string,
  outputRoot: string,
): Promise<void> {
  const release = await loadPersistedProductionApplicationRelease({
    filesystem_root: filesystemRoot,
    site_origin: TEST_SITE_ORIGIN,
  });
  const preparedResult = prepareApplicationExport(release);
  if (!preparedResult.success) throw new Error("Synthetic output requires a valid prepared export.");
  const prepared = preparedResult.data;
  const orderedEntries = [...release.current_entries];
  await writeRoute(
    outputRoot,
    release.routes.home,
    shell(
      `<section data-homepage-latest>${preview(orderedEntries[0]!)}</section>` +
        `<section id="latest" data-homepage-recent-list>${orderedEntries.slice(0, 5).map(preview).join("")}</section>`,
    ),
  );
  await writeRoute(outputRoot, release.routes.about, shell("<h1>About</h1>", `${release.site_origin}${release.routes.about}`));
  await writeRoute(
    outputRoot,
    release.routes.methodology_current,
    shell("<h1>Methodology</h1>", release.methodology.current_url),
  );
  await writeRoute(
    outputRoot,
    release.routes.methodology_version,
    shell("<h1>Methodology</h1>", release.methodology.version_url),
  );
  for (const entry of release.current_entries) {
    await writeRoute(
      outputRoot,
      release.routes.entries[entry.entry.id]!,
      shell(`<h1>${escapeHtml(entry.entry.title)}</h1>`, entry.canonical_url),
    );
  }
  for (const trail of release.topic_trails) {
    const content = [
      `<h1>${escapeHtml(trail.topic_trail.name)}</h1>`,
      `<dl data-topic-trail-section="metadata"><div><dt>Count</dt><dd>${trail.entry_count}</dd></div>` +
        `<div><dt>Activity</dt><dd>${trail.last_activity.published_at.slice(0, 10)}</dd></div></dl>`,
      `<ol data-topic-trail-entry-list>${trail.entries.map(preview).join("")}</ol>`,
    ].join("");
    await writeRoute(
      outputRoot,
      release.routes.topic_trails[trail.topic_trail.id]!,
      shell(content, trail.canonical_url),
    );
  }
  const groupedEvents = Map.groupBy(release.changelog_events, ({ date }) => date);
  const changelogContent = [...groupedEvents].map(([date, events]) =>
    `<section data-changelog-date-group><time>${date}</time>${events.map((event) =>
      `<article data-changelog-record data-change-type="${event.type}"><h4>${escapeHtml(event.title)}</h4></article>`,
    ).join("")}</section>`,
  ).join("");
  await writeRoute(
    outputRoot,
    release.routes.changelog,
    shell(changelogContent, `${release.site_origin}${release.routes.changelog}`),
  );
  await writeRoute(
    outputRoot,
    release.routes.export,
    shell(
      `<dd data-export-entry-count>${release.current_entries.length}</dd>` +
        `<a data-export-download href="${prepared.artifact.public_path}">Download</a>`,
      `${release.site_origin}${release.routes.export}`,
    ),
  );
  await writeRoute(outputRoot, prepared.artifact.public_path, prepared.artifact.serialized_json);
  const schema = generateVyDexDatasetSchemaV1({ site_origin: release.site_origin });
  if (!schema.success) throw new Error("Synthetic output requires a valid Schema.");
  await writeRoute(outputRoot, prepared.artifact.schema_public_path, schema.data.serialized_json);
  await writeRoute(outputRoot, "/404.html", shell("<h1>Not Found</h1>"));
  await writeFile(resolve(outputRoot, "_headers"), "# headers\n", "utf8");
  await writeFile(
    resolve(outputRoot, "_redirects"),
    serializeStageOneRedirects(collectStageOneRedirects(release, prepared)),
    "utf8",
  );
}

async function createRepositoryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vydex-release-gate-"));
  roots.push(root);
  await cp(resolve(PROJECT_ROOT, "data"), resolve(root, "data"), { recursive: true });
  return root;
}

function successfulCommandRunner() {
  return vi.fn(async ({ command, working_directory: root, output_directory }) => {
    if (command === "build") await materializeVerifiedOutput(root, output_directory!);
    return { exit_code: 0, output: `${command} passed` };
  });
}

function capturingLogger(): ReleaseLogger {
  const log = vi.fn(async () => undefined);
  return {
    log,
    debug: vi.fn(async () => undefined),
    info: vi.fn(async () => undefined),
    warning: vi.fn(async () => undefined),
    error: vi.fn(async () => undefined),
    critical: vi.fn(async () => undefined),
    filename: "",
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("atomic Stage 1 release gate", { timeout: 15_000 }, () => {
  test("creates one descriptor and promotes one coherent manifest and static output", async () => {
    const root = await createRepositoryRoot();
    const runCommand = successfulCommandRunner();
    const result = await runStageOneRelease({
      filesystem_root: root,
      site_origin: TEST_SITE_ORIGIN,
      release_state_policy: "bootstrap",
      dependencies: {
        now: () => new Date(FIXED_DESCRIPTOR.generated_at),
        create_release_id: () => FIXED_DESCRIPTOR.release_id,
        run_command: runCommand,
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.descriptor_status).toBe("created");
    expect(result.manifest.release_id).toBe(FIXED_DESCRIPTOR.release_id);
    expect(await readFile(resolve(root, "dist/index.html"), "utf8")).toContain("data-homepage-latest");
    expect(JSON.parse(await readFile(resolve(root, STAGE_ONE_RELEASE_MANIFEST_PATH), "utf8"))).toEqual(result.manifest);
    expect(runCommand.mock.calls.map(([input]) => input.command)).toEqual([
      "typecheck",
      "test",
      "build",
      "browser",
    ]);
    const browserInput = runCommand.mock.calls.find(([input]) => input.command === "browser")?.[0];
    expect(browserInput?.output_directory).toContain("stage-one-release-");
    expect(browserInput?.environment.PUBLIC_SITE_ORIGIN).toBe(TEST_SITE_ORIGIN);
    expect(await readFile(resolve(root, "runtime/browser-test-output.txt"), "utf8")).toBe(
      "browser passed",
    );
  });

  test("rebuilds with the exact persisted descriptor without rewriting it", async () => {
    const root = await createRepositoryRoot();
    await createStageOneReleaseDescriptor(root, FIXED_DESCRIPTOR);
    const descriptorFilename = resolve(root, "generated/release-data/release.json");
    const originalDescriptor = await readFile(descriptorFilename, "utf8");

    const first = await runStageOneRelease({
      filesystem_root: root,
      site_origin: TEST_SITE_ORIGIN,
      release_state_policy: "bootstrap",
      dependencies: { run_command: successfulCommandRunner() },
    });
    const second = await runStageOneRelease({
      filesystem_root: root,
      site_origin: TEST_SITE_ORIGIN,
      release_state_policy: "bootstrap",
      dependencies: {
        now: () => new Date("2030-01-01T00:00:00.000Z"),
        create_release_id: () => "01900000-0000-7000-8000-000000000100",
        run_command: successfulCommandRunner(),
      },
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.descriptor_status).toBe("existing");
    expect(second.manifest.release_id).toBe(FIXED_DESCRIPTOR.release_id);
    expect(second.manifest.generated_at).toBe(FIXED_DESCRIPTOR.generated_at);
    expect(await readFile(descriptorFilename, "utf8")).toBe(originalDescriptor);
  });

  test("reproduces committed release state in existing-only CI mode", async () => {
    const root = await createRepositoryRoot();
    const bootstrap = await runStageOneRelease({
      filesystem_root: root,
      site_origin: TEST_SITE_ORIGIN,
      release_state_policy: "bootstrap",
      dependencies: {
        now: () => new Date(FIXED_DESCRIPTOR.generated_at),
        create_release_id: () => FIXED_DESCRIPTOR.release_id,
        run_command: successfulCommandRunner(),
      },
    });
    expect(bootstrap.success).toBe(true);

    const createReleaseId = vi.fn(() => "01900000-0000-7000-8000-000000000100");
    const existingOnly = await runStageOneRelease({
      filesystem_root: root,
      site_origin: TEST_SITE_ORIGIN,
      release_state_policy: "existing_only",
      dependencies: {
        create_release_id: createReleaseId,
        run_command: successfulCommandRunner(),
      },
    });

    expect(existingOnly.success).toBe(true);
    expect(createReleaseId).not.toHaveBeenCalled();
  });

  test("keeps ephemeral CI from creating missing release state", async () => {
    const root = await createRepositoryRoot();
    const createReleaseId = vi.fn(() => FIXED_DESCRIPTOR.release_id);
    const missingDescriptor = await runStageOneRelease({
      filesystem_root: root,
      site_origin: TEST_SITE_ORIGIN,
      release_state_policy: "existing_only",
      dependencies: { create_release_id: createReleaseId, run_command: successfulCommandRunner() },
    });
    expect(missingDescriptor.success).toBe(false);
    if (!missingDescriptor.success) {
      expect(missingDescriptor.diagnostics.map(({ code }) => code)).toContain("release_descriptor_required");
    }
    expect(createReleaseId).not.toHaveBeenCalled();

    await createStageOneReleaseDescriptor(root, FIXED_DESCRIPTOR);
    const missingManifest = await runStageOneRelease({
      filesystem_root: root,
      site_origin: TEST_SITE_ORIGIN,
      release_state_policy: "existing_only",
      dependencies: { run_command: successfulCommandRunner() },
    });
    expect(missingManifest.success).toBe(false);
    if (!missingManifest.success) {
      expect(missingManifest.diagnostics.map(({ code }) => code)).toContain("release_manifest_required");
    }
  });

  test("blocks CI when the environment origin differs from the committed manifest", async () => {
    const root = await createRepositoryRoot();
    const bootstrap = await runStageOneRelease({
      filesystem_root: root,
      site_origin: TEST_SITE_ORIGIN,
      release_state_policy: "bootstrap",
      dependencies: {
        now: () => new Date(FIXED_DESCRIPTOR.generated_at),
        create_release_id: () => FIXED_DESCRIPTOR.release_id,
        run_command: successfulCommandRunner(),
      },
    });
    expect(bootstrap.success).toBe(true);

    const result = await runStageOneRelease({
      filesystem_root: root,
      site_origin: parseRequiredPublicSiteOrigin("https://vydex-other.pages.dev"),
      release_state_policy: "existing_only",
      dependencies: { run_command: successfulCommandRunner() },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.map(({ code }) => code)).toContain("release_state_origin_mismatch");
    }
  });

  test("blocks an incomplete Entry while preserving the previous manifest and dist", async () => {
    const root = await createRepositoryRoot();
    await createStageOneReleaseDescriptor(root, FIXED_DESCRIPTOR);
    await mkdir(resolve(root, "dist"), { recursive: true });
    await mkdir(resolve(root, "generated/release-data"), { recursive: true });
    await writeFile(resolve(root, "dist/index.html"), "previous successful output", "utf8");
    await writeFile(resolve(root, STAGE_ONE_RELEASE_MANIFEST_PATH), "previous successful manifest", "utf8");
    const entryFilename = resolve(root, "data/canonical-records/entries/dreamer-4-offline-minecraft-diamonds.json");
    const entry = JSON.parse(await readFile(entryFilename, "utf8"));
    delete entry.sources[0].used_for;
    await writeFile(entryFilename, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
    const runCommand = successfulCommandRunner();

    const result = await runStageOneRelease({
      filesystem_root: root,
      site_origin: TEST_SITE_ORIGIN,
      release_state_policy: "bootstrap",
      dependencies: { run_command: runCommand },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ field: expect.stringContaining("used_for") }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "release_artifacts_unavailable" }),
    );
    expect(runCommand).not.toHaveBeenCalledWith(expect.objectContaining({ command: "build" }));
    expect(await readFile(resolve(root, "dist/index.html"), "utf8")).toBe("previous successful output");
    expect(await readFile(resolve(root, STAGE_ONE_RELEASE_MANIFEST_PATH), "utf8")).toBe("previous successful manifest");
  });

  test("rejects an unexpected future route without promoting staged output", async () => {
    const root = await createRepositoryRoot();
    await createStageOneReleaseDescriptor(root, FIXED_DESCRIPTOR);
    await mkdir(resolve(root, "dist"), { recursive: true });
    await writeFile(resolve(root, "dist/index.html"), "previous successful output", "utf8");
    const runCommand: RunStageOneCommand = async ({ command, working_directory, output_directory }) => {
      if (command === "build") {
        await materializeVerifiedOutput(working_directory, output_directory!);
        await writeRoute(output_directory!, "/search/", shell("<h1>Future Search</h1>"));
      }
      return { exit_code: 0, output: `${command} passed` };
    };

    const result = await runStageOneRelease({
      filesystem_root: root,
      site_origin: TEST_SITE_ORIGIN,
      release_state_policy: "bootstrap",
      dependencies: { run_command: runCommand },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "generated_route_set_mismatch" }),
    );
    expect(await readFile(resolve(root, "dist/index.html"), "utf8")).toBe("previous successful output");
  });

  test("preserves previous output when the production build returns non-zero", async () => {
    const root = await createRepositoryRoot();
    await createStageOneReleaseDescriptor(root, FIXED_DESCRIPTOR);
    await mkdir(resolve(root, "dist"), { recursive: true });
    await writeFile(resolve(root, "dist/index.html"), "previous successful output", "utf8");
    const runCommand: RunStageOneCommand = async ({ command }) => ({
      exit_code: command === "build" ? 1 : 0,
      output: command === "build" ? "Astro build failed deliberately" : `${command} passed`,
    });

    const result = await runStageOneRelease({
      filesystem_root: root,
      site_origin: TEST_SITE_ORIGIN,
      release_state_policy: "bootstrap",
      dependencies: { run_command: runCommand },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "build_failed" }));
    expect(await readFile(resolve(root, "dist/index.html"), "utf8")).toBe("previous successful output");
  });

  test("blocks browser failures and preserves previous promoted resources", async () => {
    const root = await createRepositoryRoot();
    await createStageOneReleaseDescriptor(root, FIXED_DESCRIPTOR);
    await mkdir(resolve(root, "dist"), { recursive: true });
    await mkdir(resolve(root, "generated/release-data"), { recursive: true });
    await writeFile(resolve(root, "dist/index.html"), "previous successful output", "utf8");
    await writeFile(resolve(root, STAGE_ONE_RELEASE_MANIFEST_PATH), "previous successful manifest", "utf8");
    const logger = capturingLogger();
    const runCommand: RunStageOneCommand = async ({ command, working_directory, output_directory }) => {
      if (command === "build") await materializeVerifiedOutput(working_directory, output_directory!);
      return {
        exit_code: command === "browser" ? 1 : 0,
        output: command === "browser" ? "Critical journey failed deliberately" : `${command} passed`,
      };
    };

    const result = await runStageOneRelease({
      filesystem_root: root,
      site_origin: TEST_SITE_ORIGIN,
      release_state_policy: "bootstrap",
      dependencies: { run_command: runCommand, logger },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "browser_failed" }));
    expect(await readFile(resolve(root, "runtime/browser-test-output.txt"), "utf8")).toBe(
      "Critical journey failed deliberately",
    );
    expect(await readFile(resolve(root, "dist/index.html"), "utf8")).toBe("previous successful output");
    expect(await readFile(resolve(root, STAGE_ONE_RELEASE_MANIFEST_PATH), "utf8")).toBe(
      "previous successful manifest",
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Running Stage 1 Playwright journeys and accessibility checks.",
    );
    expect(logger.debug).toHaveBeenCalledWith("Critical journey failed deliberately");
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Stage 1 release blocked"));
  });

  test("blocks a dead generated navigation destination", async () => {
    const root = await createRepositoryRoot();
    await createStageOneReleaseDescriptor(root, FIXED_DESCRIPTOR);
    const runCommand: RunStageOneCommand = async ({ command, working_directory, output_directory }) => {
      if (command === "build") {
        await materializeVerifiedOutput(working_directory, output_directory!);
        const aboutFilename = routeFilename(output_directory!, "/about/");
        const aboutHtml = await readFile(aboutFilename, "utf8");
        await writeFile(
          aboutFilename,
          aboutHtml.replace("</main>", '<a href="/missing-stage-one-route/">Broken</a></main>'),
          "utf8",
        );
      }
      return { exit_code: 0, output: `${command} passed` };
    };

    const result = await runStageOneRelease({
      filesystem_root: root,
      site_origin: TEST_SITE_ORIGIN,
      release_state_policy: "bootstrap",
      dependencies: { run_command: runCommand },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "dead_navigation_link" }),
    );
  });
});
