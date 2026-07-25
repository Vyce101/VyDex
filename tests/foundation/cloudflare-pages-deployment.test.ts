// Guards the static Pages-only CI and deployment configuration contract.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");

describe("Cloudflare Pages deployment contract", () => {
  let workflow: string;
  let wrangler: string;
  let packageJson: string;
  let gitignore: string;

  beforeAll(async () => {
    [workflow, wrangler, packageJson, gitignore] = await Promise.all([
      readFile(resolve(PROJECT_ROOT, ".github/workflows/validate-application.yml"), "utf8"),
      readFile(resolve(PROJECT_ROOT, "wrangler.jsonc"), "utf8"),
      readFile(resolve(PROJECT_ROOT, "package.json"), "utf8"),
      readFile(resolve(PROJECT_ROOT, ".gitignore"), "utf8"),
    ]);
  });

  test("configures Pages static output without a Worker boundary", () => {
    expect(wrangler).toContain('"name": "vydex"');
    expect(wrangler).toContain('"pages_build_output_dir": "./dist"');
    expect(wrangler).not.toMatch(/"(?:assets|main|workers_dev|d1_databases|kv_namespaces)"/);
    expect(packageJson).toContain('"build:pages-preview"');
    expect(packageJson).not.toContain("wrangler deploy");
  });

  test("deploys only the validated artifact and requires every external value", () => {
    for (const name of [
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_PAGES_PROJECT_NAME",
      "PUBLIC_SITE_ORIGIN",
    ]) {
      expect(workflow).toContain(name);
    }
    expect(workflow).toContain("needs: validate");
    expect(workflow).toContain("npm run release:stage-1:ci");
    expect(workflow).toContain("actions/upload-artifact@v7");
    expect(workflow).toContain("actions/download-artifact@v7");
    expect(workflow).toContain("npm run verify:pages-deployment");
    expect(workflow).toContain("wrangler pages deploy dist");
    expect(workflow).not.toContain("https://vydex.example");

    const deployJob = workflow.slice(workflow.indexOf("  deploy:"));
    expect(deployJob).not.toMatch(/npm run (?:build|release:stage-1:ci)/);
  });

  test("keeps generated output disposable and release state authoritative", () => {
    expect(gitignore.split(/\r?\n/)).toContain("dist/");
    expect(gitignore).not.toContain("generated/release-data");
    expect(gitignore.split(/\r?\n/)).toContain(".env");
    expect(gitignore.split(/\r?\n/)).toContain("!.env.example");
  });
});
