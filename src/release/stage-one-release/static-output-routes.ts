// Enumerates staged output files and derives the exact allowed Stage 1 public route set.
import { readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import type { ReleaseModel } from "../../domain";

export async function listStaticOutputFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const values = await Promise.all(
    entries.map(async (entry) => {
      const filename = resolve(directory, entry.name);
      return entry.isDirectory() ? listStaticOutputFiles(filename) : entry.isFile() ? [filename] : [];
    }),
  );
  return values.flat();
}

export function staticFilenameToPublicRoute(outputRoot: string, filename: string): string | undefined {
  const path = relative(outputRoot, filename).split(sep).join("/");
  if (path === "index.html") return "/";
  if (path === "404.html" || path.startsWith("_astro/") || path === "_headers" || path === "_redirects") {
    return undefined;
  }
  if (path.endsWith("/index.html")) return `/${path.slice(0, -"index.html".length)}`;
  if (path.endsWith(".json") || path.endsWith(".html")) return `/${path}`;
  return undefined;
}

export function expectedStageOneGeneratedRoutes(release: ReleaseModel): string[] {
  return [
    release.routes.home,
    release.routes.methodology_current,
    release.routes.methodology_version,
    release.routes.about,
    release.routes.changelog,
    release.routes.export,
    release.routes.dataset_schema,
    release.routes.dataset_artifact!,
    ...Object.values(release.routes.entries),
    ...Object.values(release.routes.topic_trails),
  ].map(String).sort((left, right) => left.localeCompare(right, "en"));
}
