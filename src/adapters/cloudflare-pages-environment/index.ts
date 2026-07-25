// Validates the Cloudflare Pages deployment environment without logging secrets.
import { parseRequiredPublicSiteOrigin } from "../public-site-origin";

export const STAGE_ONE_CLOUDFLARE_PAGES_PROJECT_NAME = "vydex" as const;
export const STAGE_ONE_PUBLIC_SITE_ORIGIN = "https://vydex.pages.dev" as const;

export type CloudflarePagesDeploymentEnvironment = {
  account_id: string;
  api_token: string;
  project_name: typeof STAGE_ONE_CLOUDFLARE_PAGES_PROJECT_NAME;
  public_site_origin: ReturnType<typeof parseRequiredPublicSiteOrigin>;
};

function requireEnvironmentValue(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (value) return value;
  throw new Error(`${name} is required for Cloudflare Pages production deployment.`);
}

export function loadCloudflarePagesDeploymentEnvironment(
  environment: NodeJS.ProcessEnv,
): CloudflarePagesDeploymentEnvironment {
  const projectName = requireEnvironmentValue(environment, "CLOUDFLARE_PAGES_PROJECT_NAME");
  if (projectName !== STAGE_ONE_CLOUDFLARE_PAGES_PROJECT_NAME) {
    throw new Error(
      `CLOUDFLARE_PAGES_PROJECT_NAME must be ${STAGE_ONE_CLOUDFLARE_PAGES_PROJECT_NAME}.`,
    );
  }

  const publicSiteOrigin = parseRequiredPublicSiteOrigin(environment.PUBLIC_SITE_ORIGIN);
  if (publicSiteOrigin !== STAGE_ONE_PUBLIC_SITE_ORIGIN) {
    throw new Error(`PUBLIC_SITE_ORIGIN must be ${STAGE_ONE_PUBLIC_SITE_ORIGIN}.`);
  }

  return {
    account_id: requireEnvironmentValue(environment, "CLOUDFLARE_ACCOUNT_ID"),
    api_token: requireEnvironmentValue(environment, "CLOUDFLARE_API_TOKEN"),
    project_name: projectName,
    public_site_origin: publicSiteOrigin,
  };
}
