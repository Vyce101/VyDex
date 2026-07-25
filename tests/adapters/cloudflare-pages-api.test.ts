// Verifies production-only Cloudflare Pages discovery, rollback, polling, and secret safety.
import { describe, expect, test, vi } from "vitest";
import {
  createCloudflarePagesApi,
  type CloudflarePagesDeployment,
} from "../../src/adapters/cloudflare-pages-api";
import { loadCloudflarePagesDeploymentEnvironment } from "../../src/adapters/cloudflare-pages-environment";

const ENVIRONMENT = loadCloudflarePagesDeploymentEnvironment({
  CLOUDFLARE_ACCOUNT_ID: "private-account",
  CLOUDFLARE_API_TOKEN: "private-token",
  CLOUDFLARE_PAGES_PROJECT_NAME: "vydex",
  PUBLIC_SITE_ORIGIN: "https://vydex.pages.dev",
});

function deployment(
  id: string,
  overrides: Partial<CloudflarePagesDeployment> = {},
): CloudflarePagesDeployment {
  return {
    id,
    created_on: `2026-07-26T00:00:${id.padStart(2, "0")}Z`,
    environment: "production",
    is_skipped: false,
    latest_stage: { status: "success" },
    project_name: "vydex",
    url: `https://${id}.vydex.pages.dev`,
    deployment_trigger: { metadata: { branch: "main", commit_hash: "commit" } },
    ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Cloudflare Pages API adapter", () => {
  test("paginates and returns only successful production deployments", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      deployment(`production-${index.toString().padStart(3, "0")}`));
    firstPage[0] = deployment("preview", { environment: "preview" });
    firstPage[1] = deployment("failed", { latest_stage: { status: "failure" } });
    const request = vi.fn<typeof fetch>(async (url, init) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer private-token");
      return new URL(String(url)).searchParams.get("page") === "1"
        ? jsonResponse({ success: true, errors: [], result: firstPage, result_info: { page: 1, total_pages: 2 } })
        : jsonResponse({ success: true, errors: [], result: [deployment("production-latest")], result_info: { page: 2, total_pages: 2 } });
    });
    const api = createCloudflarePagesApi({ environment: ENVIRONMENT, fetch: request });

    const result = await api.listSuccessfulProductionDeployments();

    expect(request).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(99);
    expect(result.map(({ id }) => id)).not.toContain("preview");
    expect(result.map(({ id }) => id)).not.toContain("failed");
  });

  test("refuses preview deployment lookup before rollback", async () => {
    const request = vi.fn<typeof fetch>(async () =>
      jsonResponse({ success: true, errors: [], result: deployment("preview", { environment: "preview" }) }));
    const api = createCloudflarePagesApi({ environment: ENVIRONMENT, fetch: request });

    await expect(api.rollbackProductionTo("preview")).rejects.toThrow("not a successful production deployment");
    expect(request).toHaveBeenCalledTimes(1);
  });

  test("validates the target before calling the production rollback endpoint", async () => {
    const target = deployment("target");
    const request = vi.fn<typeof fetch>(async (_url, init) =>
      jsonResponse({ success: true, errors: [], result: target, method: init?.method }));
    const api = createCloudflarePagesApi({ environment: ENVIRONMENT, fetch: request });

    await expect(api.rollbackProductionTo(target.id)).resolves.toEqual(target);

    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[1]?.method).toBeUndefined();
    expect(request.mock.calls[1]?.[1]?.method).toBe("POST");
    expect(String(request.mock.calls[1]?.[0]).endsWith("/target/rollback")).toBe(true);
  });

  test("polls until the requested deployment is canonical", async () => {
    let currentTime = 0;
    const earlier = deployment("earlier");
    const intended = deployment("intended");
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        errors: [],
        result: { name: "vydex", production_branch: "main", canonical_deployment: earlier },
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        errors: [],
        result: { name: "vydex", production_branch: "main", canonical_deployment: intended },
      }));
    const api = createCloudflarePagesApi({
      environment: ENVIRONMENT,
      fetch: request,
      now: () => currentTime,
      sleep: async (milliseconds) => { currentTime += milliseconds; },
    });

    await expect(api.waitForCanonicalDeployment("intended", {
      timeout_ms: 10,
      poll_interval_ms: 1,
    })).resolves.toEqual(intended);
  });

  test("keeps credentials and account identifiers out of request failures", async () => {
    const api = createCloudflarePagesApi({
      environment: ENVIRONMENT,
      fetch: async () => new Response("failure", { status: 500 }),
    });

    let error: Error | undefined;
    try {
      await api.getProject();
    } catch (value) {
      error = value as Error;
    }
    expect(error).toBeDefined();
    if (!error) return;
    expect(error.message).toContain("HTTP 500");
    expect(error.message).not.toContain(ENVIRONMENT.api_token);
    expect(error.message).not.toContain(ENVIRONMENT.account_id);
  });
});
