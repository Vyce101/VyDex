// Verifies the framework-independent domain boundary and its import direction.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");
const DOMAIN_ROOT = join(PROJECT_ROOT, "src", "domain");
const DOMAIN_PUBLIC_ENTRY = join(DOMAIN_ROOT, "index.ts");
const FOUNDATION_PAGE = join(PROJECT_ROOT, "src", "pages", "index.astro");
const APPLICATION_RELEASE_ADAPTER = join(
  PROJECT_ROOT,
  "src",
  "adapters",
  "application-release",
  "index.ts",
);
const EXPECTED_BOUNDARIES = [
  "canonical-records",
  "cross-record-validation",
  "json-export-generation",
  "material-activity",
  "publication-revisions",
  "release-construction",
  "route-generation",
] as const;

function getTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? getTypeScriptFiles(path) : extname(path) === ".ts" ? [path] : [];
  });
}

function getModuleSpecifiers(sourceText: string, fileName: string): string[] {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  return sourceFile.statements.flatMap((statement) => {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      return [statement.moduleSpecifier.text];
    }

    return [];
  });
}

function isForbiddenDomainImport(specifier: string, fileName: string): boolean {
  const normalizedSpecifier = specifier.replaceAll("\\", "/");
  const importsUiModule = ["pages", "components", "layouts"].some(
    (directory) =>
      normalizedSpecifier === directory ||
      normalizedSpecifier.startsWith(`${directory}/`) ||
      normalizedSpecifier.startsWith(`src/${directory}/`) ||
      normalizedSpecifier.startsWith(`@/${directory}/`) ||
      normalizedSpecifier.startsWith(`@${directory}/`),
  );

  if (
    normalizedSpecifier === "astro" ||
    normalizedSpecifier.startsWith("astro/") ||
    normalizedSpecifier.endsWith(".astro") ||
    importsUiModule
  ) {
    return true;
  }

  if (!specifier.startsWith(".")) {
    return false;
  }

  const resolvedImport = normalize(resolve(dirname(fileName), specifier));
  return !resolvedImport.startsWith(`${normalize(DOMAIN_ROOT)}\\`) && resolvedImport !== normalize(DOMAIN_ROOT);
}

describe("domain module boundaries", () => {
  test("provides each domain boundary through the public entry point", () => {
    expect(existsSync(DOMAIN_PUBLIC_ENTRY)).toBe(true);

    const publicExports = getModuleSpecifiers(readFileSync(DOMAIN_PUBLIC_ENTRY, "utf8"), DOMAIN_PUBLIC_ENTRY);
    for (const boundary of EXPECTED_BOUNDARIES) {
      expect(existsSync(join(DOMAIN_ROOT, boundary, "index.ts"))).toBe(true);
      expect(publicExports).toContain(`./${boundary}`);
    }
  });

  test("keeps current domain modules independent from Astro and UI source", () => {
    const forbiddenImports = getTypeScriptFiles(DOMAIN_ROOT).flatMap((fileName) =>
      getModuleSpecifiers(readFileSync(fileName, "utf8"), fileName)
        .filter((specifier) => isForbiddenDomainImport(specifier, fileName))
        .map((specifier) => ({ fileName, specifier })),
    );

    expect(forbiddenImports).toEqual([]);
  });

  test("allows direct Zod imports and rejects representative framework imports", () => {
    const sampleFile = join(DOMAIN_ROOT, "sample.ts");

    expect(isForbiddenDomainImport("zod", sampleFile)).toBe(false);
    expect(isForbiddenDomainImport("astro/zod", sampleFile)).toBe(true);
    expect(isForbiddenDomainImport("../pages/index.astro", sampleFile)).toBe(true);
    expect(isForbiddenDomainImport("@/components/Card.astro", sampleFile)).toBe(true);
  });

  test("has the Astro fixture consume the domain public entry point", () => {
    const pageSource = readFileSync(FOUNDATION_PAGE, "utf8");
    expect(pageSource).toContain('import type {} from "@domain";');
  });

  test("keeps authoring-file parsing behind the canonical loader", () => {
    const presentationDirectories = ["pages", "components"].map((directory) =>
      join(PROJECT_ROOT, "src", directory),
    );
    const presentationFiles = presentationDirectories.flatMap((directory) =>
      existsSync(directory)
        ? readdirSync(directory, { recursive: true })
            .filter((entry): entry is string => typeof entry === "string")
            .filter((entry) => [".astro", ".ts", ".tsx"].includes(extname(entry)))
            .map((entry) => join(directory, entry))
        : [],
    );
    const violations = presentationFiles.flatMap((fileName) => {
      const source = readFileSync(fileName, "utf8");
      return source.includes("node:fs") || source.includes("data/canonical-records")
        ? [fileName]
        : [];
    });
    expect(violations).toEqual([]);
  });

  test("provides one application adapter that composes loading and release construction", () => {
    const source = readFileSync(APPLICATION_RELEASE_ADAPTER, "utf8");
    expect(source).toContain("loadCanonicalRecords");
    expect(source).toContain("constructReleaseModel");
    expect(source).toContain("PUBLIC_SITE_ORIGIN");
  });
});
