// Provides the validated Cloudflare Pages production-deployment API boundary.
import { z } from "zod";
import type { CloudflarePagesDeploymentEnvironment } from "../cloudflare-pages-environment";

const deploymentStageSchema = z.strictObject({
  status: z.enum(["success", "idle", "active", "failure", "canceled"]),
});

const deploymentSchema = z.object({
  id: z.string().min(1),
  created_on: z.string().min(1),
  environment: z.enum(["production", "preview"]),
  is_skipped: z.boolean(),
  latest_stage: deploymentStageSchema,
  project_name: z.string().min(1),
  url: z.url({ protocol: /^https$/ }),
  deployment_trigger: z.object({
    metadata: z.object({
      branch: z.string(),
      commit_hash: z.string(),
    }),
  }),
});

const apiErrorSchema = z.object({
  code: z.number().optional(),
  message: z.string(),
});

const deploymentEnvelopeSchema = z.object({
  success: z.boolean(),
  errors: z.array(apiErrorSchema).default([]),
  result: deploymentSchema.nullable(),
});

const deploymentListEnvelopeSchema = z.object({
  success: z.boolean(),
  errors: z.array(apiErrorSchema).default([]),
  result: z.array(deploymentSchema).nullable(),
  result_info: z.object({
    page: z.number().int().positive().optional(),
    total_pages: z.number().int().nonnegative().optional(),
  }).optional(),
});

const projectEnvelopeSchema = z.object({
  success: z.boolean(),
  errors: z.array(apiErrorSchema).default([]),
  result: z.object({
    name: z.string().min(1),
    production_branch: z.string(),
    canonical_deployment: deploymentSchema.nullable(),
  }).nullable(),
});

export type CloudflarePagesDeployment = z.infer<typeof deploymentSchema>;

export type CloudflarePagesProject = {
  name: string;
  production_branch: string;
  canonical_deployment: CloudflarePagesDeployment | null;
};

export type CloudflarePagesApi = {
  getProject(): Promise<CloudflarePagesProject>;
  getProductionDeployment(deploymentId: string): Promise<CloudflarePagesDeployment>;
  listSuccessfulProductionDeployments(): Promise<CloudflarePagesDeployment[]>;
  rollbackProductionTo(deploymentId: string): Promise<CloudflarePagesDeployment>;
  waitForCanonicalDeployment(
    deploymentId: string,
    options?: { timeout_ms?: number; poll_interval_ms?: number },
  ): Promise<CloudflarePagesDeployment>;
  waitForCanonicalDeploymentForCommit(
    commitHash: string,
    options?: { previous_deployment_id?: string; timeout_ms?: number; poll_interval_ms?: number },
  ): Promise<CloudflarePagesDeployment>;
};

type FetchImplementation = typeof fetch;

const CLOUDFLARE_API_ORIGIN = "https://api.cloudflare.com/client/v4";
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const DEPLOYMENTS_PER_PAGE = 100;

function deploymentIsSuccessfulProduction(
  deployment: CloudflarePagesDeployment,
  projectName: string,
): boolean {
  return deployment.project_name === projectName &&
    deployment.environment === "production" &&
    !deployment.is_skipped &&
    deployment.latest_stage.status === "success";
}

function requireSuccessfulProductionDeployment(
  deployment: CloudflarePagesDeployment,
  projectName: string,
): CloudflarePagesDeployment {
  if (deploymentIsSuccessfulProduction(deployment, projectName)) return deployment;
  throw new Error(`Cloudflare deployment ${deployment.id} is not a successful production deployment for the configured Pages project.`);
}

function apiFailureMessage(operation: string, errors: readonly { code?: number; message: string }[]): string {
  const details = errors.map(({ code, message }) => `${code ?? "unknown"}: ${message}`).join("; ");
  return `Cloudflare Pages ${operation} failed${details ? `: ${details}` : "."}`;
}

function malformedResponseMessage(operation: string, error: z.ZodError): string {
  const issues = error.issues
    .map((issue) => `${issue.path.map(String).join(".") || "response"}:${issue.code}`)
    .join(", ");
  return `Cloudflare Pages ${operation} returned a malformed response (${issues}).`;
}

export function createCloudflarePagesApi(input: {
  environment: CloudflarePagesDeploymentEnvironment;
  fetch?: FetchImplementation;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}): CloudflarePagesApi {
  const request = input.fetch ?? fetch;
  const sleep = input.sleep ?? ((milliseconds: number) => new Promise((complete) => setTimeout(complete, milliseconds)));
  const now = input.now ?? Date.now;
  const environment = input.environment;
  const projectPath = `/accounts/${encodeURIComponent(environment.account_id)}/pages/projects/${encodeURIComponent(environment.project_name)}`;

  async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
    const response = await request(`${CLOUDFLARE_API_ORIGIN}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${environment.api_token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Cloudflare Pages request failed with HTTP ${response.status}.`);
    }
    return response.json();
  }

  async function getProject(): Promise<CloudflarePagesProject> {
    const result = projectEnvelopeSchema.safeParse(await requestJson(projectPath));
    if (!result.success) throw new Error(malformedResponseMessage("project lookup", result.error));
    const parsed = result.data;
    if (!parsed.success) throw new Error(apiFailureMessage("project lookup", parsed.errors));
    if (!parsed.result) throw new Error("Cloudflare Pages project lookup returned no project.");
    if (parsed.result.name !== environment.project_name) {
      throw new Error("Cloudflare Pages returned a different project than the configured production project.");
    }
    const canonicalDeployment = parsed.result.canonical_deployment;
    if (canonicalDeployment) {
      requireSuccessfulProductionDeployment(canonicalDeployment, environment.project_name);
    }
    return {
      name: parsed.result.name,
      production_branch: parsed.result.production_branch,
      canonical_deployment: canonicalDeployment,
    };
  }

  async function getProductionDeployment(deploymentId: string): Promise<CloudflarePagesDeployment> {
    const result = deploymentEnvelopeSchema.safeParse(
      await requestJson(`${projectPath}/deployments/${encodeURIComponent(deploymentId)}`),
    );
    if (!result.success) throw new Error(malformedResponseMessage("deployment lookup", result.error));
    const parsed = result.data;
    if (!parsed.success) throw new Error(apiFailureMessage("deployment lookup", parsed.errors));
    if (!parsed.result) throw new Error("Cloudflare Pages deployment lookup returned no deployment.");
    return requireSuccessfulProductionDeployment(parsed.result, environment.project_name);
  }

  async function listSuccessfulProductionDeployments(): Promise<CloudflarePagesDeployment[]> {
    const deployments: CloudflarePagesDeployment[] = [];
    let page = 1;
    while (true) {
      const result = deploymentListEnvelopeSchema.safeParse(
        await requestJson(`${projectPath}/deployments?env=production&page=${page}&per_page=${DEPLOYMENTS_PER_PAGE}`),
      );
      if (!result.success) throw new Error(malformedResponseMessage("deployment listing", result.error));
      const parsed = result.data;
      if (!parsed.success) throw new Error(apiFailureMessage("deployment listing", parsed.errors));
      if (!parsed.result) throw new Error("Cloudflare Pages deployment listing returned no deployments.");
      deployments.push(
        ...parsed.result.filter((deployment) => deploymentIsSuccessfulProduction(deployment, environment.project_name)),
      );
      const totalPages = parsed.result_info?.total_pages;
      if ((totalPages !== undefined && page >= totalPages) || parsed.result.length < DEPLOYMENTS_PER_PAGE) break;
      page += 1;
    }
    return deployments.sort((left, right) => right.created_on.localeCompare(left.created_on));
  }

  async function rollbackProductionTo(deploymentId: string): Promise<CloudflarePagesDeployment> {
    await getProductionDeployment(deploymentId);
    const result = deploymentEnvelopeSchema.safeParse(
      await requestJson(`${projectPath}/deployments/${encodeURIComponent(deploymentId)}/rollback`, { method: "POST" }),
    );
    if (!result.success) throw new Error(malformedResponseMessage("production rollback", result.error));
    const parsed = result.data;
    if (!parsed.success) throw new Error(apiFailureMessage("production rollback", parsed.errors));
    if (!parsed.result) throw new Error("Cloudflare Pages production rollback returned no deployment.");
    if (parsed.result.id !== deploymentId) {
      throw new Error("Cloudflare Pages rollback returned a different deployment ID than requested.");
    }
    return requireSuccessfulProductionDeployment(parsed.result, environment.project_name);
  }

  async function pollForCanonicalDeployment(inputValue: {
    predicate: (deployment: CloudflarePagesDeployment) => boolean;
    description: string;
    timeout_ms?: number;
    poll_interval_ms?: number;
  }): Promise<CloudflarePagesDeployment> {
    const deadline = now() + (inputValue.timeout_ms ?? DEFAULT_TIMEOUT_MS);
    while (now() <= deadline) {
      const canonical = (await getProject()).canonical_deployment;
      if (canonical && inputValue.predicate(canonical)) return canonical;
      await sleep(inputValue.poll_interval_ms ?? DEFAULT_POLL_INTERVAL_MS);
    }
    throw new Error(`Cloudflare Pages did not expose ${inputValue.description} before the production polling timeout.`);
  }

  return {
    getProject,
    getProductionDeployment,
    listSuccessfulProductionDeployments,
    rollbackProductionTo,
    waitForCanonicalDeployment: (deploymentId, options = {}) => pollForCanonicalDeployment({
      ...options,
      description: `deployment ${deploymentId} as canonical`,
      predicate: ({ id }) => id === deploymentId,
    }),
    waitForCanonicalDeploymentForCommit: (commitHash, options = {}) => pollForCanonicalDeployment({
      ...options,
      description: `a new canonical deployment for commit ${commitHash}`,
      predicate: (deployment) =>
        deployment.deployment_trigger.metadata.commit_hash === commitHash &&
        deployment.id !== options.previous_deployment_id,
    }),
  };
}
