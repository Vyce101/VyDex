// Guards the static Pages-only CI and deployment configuration contract.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");

describe("Cloudflare Pages deployment contract", () => {
  let workflow: string;
  let rehearsalWorkflow: string;
  let wrangler: string;
  let packageJson: string;
  let gitignore: string;
  let pagesDeploymentVerifier: string;
  let productionDeploymentScript: string;
  let rehearsalScript: string;
  let hostedVerificationScript: string;
  let hostedVerificationSupport: string;
  let playwrightConfig: string;
  let homepageSpec: string;

  beforeAll(async () => {
    [
      workflow,
      rehearsalWorkflow,
      wrangler,
      packageJson,
      gitignore,
      pagesDeploymentVerifier,
      productionDeploymentScript,
      rehearsalScript,
      hostedVerificationScript,
      hostedVerificationSupport,
      playwrightConfig,
      homepageSpec,
    ] = await Promise.all([
      readFile(resolve(PROJECT_ROOT, ".github/workflows/validate-application.yml"), "utf8"),
      readFile(resolve(PROJECT_ROOT, ".github/workflows/rehearse-production-rollback.yml"), "utf8"),
      readFile(resolve(PROJECT_ROOT, "wrangler.jsonc"), "utf8"),
      readFile(resolve(PROJECT_ROOT, "package.json"), "utf8"),
      readFile(resolve(PROJECT_ROOT, ".gitignore"), "utf8"),
      readFile(resolve(PROJECT_ROOT, "scripts/deployment/verify-cloudflare-pages-deployment.ts"), "utf8"),
      readFile(resolve(PROJECT_ROOT, "scripts/deployment/deploy-and-verify-cloudflare-pages.ts"), "utf8"),
      readFile(resolve(PROJECT_ROOT, "scripts/deployment/rehearse-cloudflare-pages-rollback.ts"), "utf8"),
      readFile(resolve(PROJECT_ROOT, "scripts/deployment/verify-hosted-stage-one.ts"), "utf8"),
      readFile(resolve(PROJECT_ROOT, "scripts/deployment/hosted-verification-support.ts"), "utf8"),
      readFile(resolve(PROJECT_ROOT, "tests/browser/playwright-config.ts"), "utf8"),
      readFile(resolve(PROJECT_ROOT, "tests/browser/homepage.spec.ts"), "utf8"),
    ]);
  });

  test("configures Pages static output without a Worker boundary", () => {
    expect(wrangler).toContain('"name": "vydex"');
    expect(wrangler).toContain('"pages_build_output_dir": "./dist"');
    expect(wrangler).not.toMatch(/"(?:assets|main|workers_dev|d1_databases|kv_namespaces)"/);
    expect(packageJson).toContain('"build:pages-preview"');
    expect(packageJson).toContain('"verify:production-sitemap"');
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
    expect(workflow).toContain("npm run release:ci");
    expect(workflow).toContain("npm run release:check");
    expect(workflow.indexOf("npm run release:check")).toBeLessThan(workflow.indexOf("npm run release:ci"));
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("actions/upload-artifact@v7");
    expect(workflow).toContain("actions/download-artifact@v7");
    expect(workflow).toContain("npm run verify:pages-deployment");
    expect(pagesDeploymentVerifier).toContain("verifyProductionSitemapArtifact");
    expect(workflow).toContain("npm run deploy:pages-production");
    expect(workflow).toContain("vydex-hosted-verification-");
    expect(workflow).toContain("if: always()");
    expect(workflow).not.toContain("https://vydex.example");

    const deployJob = workflow.slice(workflow.indexOf("  deploy:"));
    expect(deployJob).not.toMatch(/npm run (?:build|release:ci)/);
  });

  test("keeps rollback rehearsal manual, protected, confirmed, and mutually exclusive", () => {
    expect(rehearsalWorkflow).toContain("workflow_dispatch:");
    expect(rehearsalWorkflow).not.toMatch(/\n\s+(?:push|pull_request):/);
    expect(rehearsalWorkflow).toContain("REHEARSE_PRODUCTION_ROLLBACK");
    expect(rehearsalWorkflow).toContain("name: production");
    expect(rehearsalWorkflow).toContain("group: vydex-cloudflare-pages-production");
    expect(rehearsalWorkflow).toContain("cancel-in-progress: false");
    expect(rehearsalWorkflow).toContain("npm run rehearse:pages-rollback");
    expect(rehearsalWorkflow).toContain("if: always()");
    expect(rehearsalWorkflow).not.toMatch(/wrangler deploy|workers_dev|pages functions/i);
  });

  test("retries complete hosted verification after canonical deployment switches", () => {
    expect(productionDeploymentScript).toContain("runCompleteHostedVerificationAfterPropagation");
    expect(rehearsalScript).toContain("runCompleteHostedVerificationAfterPropagation");
    expect(hostedVerificationScript).toContain("runCompleteHostedVerificationAfterPropagation");
  });

  test("separates previous-production checks from candidate metadata expectations", () => {
    expect(hostedVerificationSupport).toContain(
      "VYDEX_HOSTED_VERIFICATION_PHASE: input.phase",
    );
    expect(playwrightConfig).toContain('"pre-deployment-current-production"');
    expect(playwrightConfig).toContain('"failed-deployment-restoration"');
    expect(homepageSpec).toContain("IS_PREVIOUS_PRODUCTION_BROWSER_VERIFICATION");
  });

  test("keeps generated output disposable and release state authoritative", () => {
    expect(gitignore.split(/\r?\n/)).toContain("dist/");
    expect(gitignore).not.toContain("generated/release-data");
    expect(gitignore.split(/\r?\n/)).toContain(".env");
    expect(gitignore.split(/\r?\n/)).toContain("!.env.example");
  });
});
