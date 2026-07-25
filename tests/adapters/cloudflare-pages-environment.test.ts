// Verifies the complete secret-aware Cloudflare Pages environment contract.
import { describe, expect, test } from "vitest";
import { loadCloudflarePagesDeploymentEnvironment } from "../../src/adapters/cloudflare-pages-environment";

const VALID_ENVIRONMENT = {
  CLOUDFLARE_ACCOUNT_ID: "account-id",
  CLOUDFLARE_API_TOKEN: "pages-token",
  CLOUDFLARE_PAGES_PROJECT_NAME: "vydex",
  PUBLIC_SITE_ORIGIN: "https://vydex.pages.dev",
} satisfies NodeJS.ProcessEnv;

describe("Cloudflare Pages deployment environment", () => {
  test("loads the exact Pages deployment boundary", () => {
    expect(loadCloudflarePagesDeploymentEnvironment(VALID_ENVIRONMENT)).toEqual({
      account_id: "account-id",
      api_token: "pages-token",
      project_name: "vydex",
      public_site_origin: "https://vydex.pages.dev",
    });
  });

  test.each(Object.keys(VALID_ENVIRONMENT))("rejects a missing %s", (name) => {
    const environment = { ...VALID_ENVIRONMENT };
    delete environment[name as keyof typeof environment];
    expect(() => loadCloudflarePagesDeploymentEnvironment(environment)).toThrow(name);
  });

  test("refuses to deploy to another project", () => {
    expect(() =>
      loadCloudflarePagesDeploymentEnvironment({
        ...VALID_ENVIRONMENT,
        CLOUDFLARE_PAGES_PROJECT_NAME: "vydex-worker",
      }),
    ).toThrow("must be vydex");
  });

  test("refuses a stale Workers origin or another Pages project origin", () => {
    for (const origin of ["https://vydex.vyce.workers.dev", "https://vydex-4f2.pages.dev"]) {
      expect(() => loadCloudflarePagesDeploymentEnvironment({
        ...VALID_ENVIRONMENT,
        PUBLIC_SITE_ORIGIN: origin,
      })).toThrow("must be https://vydex.pages.dev");
    }
  });
});
