// Builds normalized public routes, canonical URLs, and permanent alias redirects.
import type { Entry, ReleaseMetadata, TopicTrail, UUIDv7 } from "../canonical-records";
import type { ValidationDiagnostic, ValidationResult } from "../cross-record-validation";

export type PublicPath = string & { readonly __brand: "PublicPath" };
export type AbsoluteCanonicalUrl = string & { readonly __brand: "AbsoluteCanonicalUrl" };
export type SiteOrigin = string & { readonly __brand: "SiteOrigin" };

export const DATASET_SCHEMA_PUBLIC_PATH = "/schemas/vydex-dataset/1.0.0.json" as const;
export const DATASET_LATEST_PUBLIC_PATH = "/datasets/vydex-latest-entry-versions-v1-0-0.json" as const;
export const DATASET_ARTIFACT_FILENAME = "vydex-latest-entry-versions-v1-0-0.json" as const;

export type PermanentRedirect = {
  source: PublicPath;
  destination: PublicPath;
  status: 301;
  record_type: "entry" | "topic_trail";
  record_id: UUIDv7;
};

export type PublicRouteRegistry = {
  home: PublicPath;
  latest: PublicPath;
  methodology_current: PublicPath;
  methodology_version: PublicPath;
  about: PublicPath;
  changelog: PublicPath;
  export: PublicPath;
  dataset_schema: PublicPath;
  dataset_latest: PublicPath;
  dataset_artifact?: PublicPath;
  entries: Readonly<Record<string, PublicPath>>;
  topic_trails: Readonly<Record<string, PublicPath>>;
};

type RouteRecord = {
  path: PublicPath;
  recordType: string;
  recordId?: UUIDv7;
};

function routeDiagnostic(
  code: string,
  recordType: string,
  path: PropertyKey[],
  rule: string,
  invalidValue?: unknown,
  recordId?: UUIDv7,
  relatedRecordId?: UUIDv7,
): ValidationDiagnostic {
  return {
    severity: "error",
    code,
    record_type: recordType,
    ...(recordId ? { record_id: recordId } : {}),
    path,
    ...(invalidValue !== undefined ? { invalid_value: invalidValue } : {}),
    rule,
    ...(relatedRecordId ? { related_record_id: relatedRecordId } : {}),
  };
}

export function validateSiteOrigin(
  value: unknown,
  mode: "production" | "preview",
): ValidationResult<SiteOrigin> {
  if (typeof value !== "string" || value.trim().length === 0) {
    return {
      success: false,
      diagnostics: [
        routeDiagnostic(
          "site_origin_required",
          "release",
          ["site_origin"],
          "A site origin is required to construct canonical URLs.",
          value,
        ),
      ],
    };
  }

  const trimmedValue = value.trim();
  let url: URL;
  try {
    url = new URL(trimmedValue);
  } catch {
    return {
      success: false,
      diagnostics: [
        routeDiagnostic(
          "invalid_site_origin",
          "release",
          ["site_origin"],
          "Site origin must be an absolute URL origin.",
          value,
        ),
      ],
    };
  }

  const isProductionProtocol = url.protocol === "https:";
  const isPreviewProtocol = isProductionProtocol || (url.protocol === "http:" && url.hostname === "localhost");
  const isAllowedProtocol = mode === "production" ? isProductionProtocol : isPreviewProtocol;
  const hasOnlyOriginSyntax = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]+\/?$/i.test(trimmedValue);
  const isRootOnly =
    hasOnlyOriginSyntax && url.pathname === "/" && url.search === "" && url.hash === "";
  if (
    !isAllowedProtocol ||
    url.hostname.length === 0 ||
    url.username !== "" ||
    url.password !== "" ||
    !isRootOnly
  ) {
    return {
      success: false,
      diagnostics: [
        routeDiagnostic(
          "invalid_site_origin",
          "release",
          ["site_origin"],
          mode === "production"
            ? "Production site origin must be a root-only absolute HTTPS origin without credentials, query, or fragment."
            : "Preview site origin must be HTTPS or HTTP localhost and contain only the root path.",
          value,
        ),
      ],
    };
  }

  return { success: true, data: url.origin as SiteOrigin, diagnostics: [] };
}

function publicPath(value: string): PublicPath {
  return value as PublicPath;
}

function routePathname(path: PublicPath): string {
  return new URL(path, "https://route.invalid").pathname;
}

function validateCurrentRouteCollisions(routes: readonly RouteRecord[]): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  const byPathname = new Map<string, RouteRecord>();
  for (const route of routes) {
    const pathname = routePathname(route.path);
    const existing = byPathname.get(pathname);
    if (!existing) {
      byPathname.set(pathname, route);
      continue;
    }
    diagnostics.push(
      routeDiagnostic(
        "public_route_collision",
        route.recordType,
        ["slug"],
        "Every current public route pathname must be unique.",
        pathname,
        route.recordId,
        existing.recordId,
      ),
    );
  }
  return diagnostics;
}

export function buildPublicRouteRegistry(input: {
  entries: readonly Entry[];
  topic_trails: readonly TopicTrail[];
  release_metadata?: ReleaseMetadata;
}): ValidationResult<PublicRouteRegistry> {
  const entries = Object.fromEntries(
    input.entries.map((entry) => [entry.id, publicPath(`/entries/${entry.slug}/`)]),
  );
  const topicTrails = Object.fromEntries(
    input.topic_trails.map((trail) => [trail.id, publicPath(`/topic-trails/${trail.slug}/`)]),
  );
  const registry: PublicRouteRegistry = {
    home: publicPath("/"),
    latest: publicPath("/#latest"),
    methodology_current: publicPath("/methodology/"),
    methodology_version: publicPath("/methodology/1.0.0/"),
    about: publicPath("/about/"),
    changelog: publicPath("/changelog/"),
    export: publicPath("/export/"),
    dataset_schema: publicPath(DATASET_SCHEMA_PUBLIC_PATH),
    dataset_latest: publicPath(DATASET_LATEST_PUBLIC_PATH),
    ...(input.release_metadata
      ? {
          dataset_artifact: publicPath(
            `/datasets/releases/${input.release_metadata.release_id}/${DATASET_ARTIFACT_FILENAME}`,
          ),
        }
      : {}),
    entries,
    topic_trails: topicTrails,
  };
  const fixedRoutes: RouteRecord[] = [
    { path: registry.home, recordType: "route" },
    { path: registry.methodology_current, recordType: "route" },
    { path: registry.methodology_version, recordType: "route" },
    { path: registry.about, recordType: "route" },
    { path: registry.changelog, recordType: "route" },
    { path: registry.export, recordType: "route" },
    { path: registry.dataset_schema, recordType: "route" },
    { path: registry.dataset_latest, recordType: "route" },
    ...(registry.dataset_artifact ? [{ path: registry.dataset_artifact, recordType: "route" }] : []),
  ];
  const currentRoutes = [
    ...fixedRoutes,
    ...input.entries.map((entry) => ({
      path: entries[entry.id]!,
      recordType: "entry",
      recordId: entry.id,
    })),
    ...input.topic_trails.map((trail) => ({
      path: topicTrails[trail.id]!,
      recordType: "topic_trail",
      recordId: trail.id,
    })),
  ];
  const diagnostics = validateCurrentRouteCollisions(currentRoutes);
  return diagnostics.length > 0
    ? { success: false, diagnostics }
    : { success: true, data: registry, diagnostics: [] };
}

export function buildPermanentRedirects(input: {
  entries: readonly Entry[];
  topic_trails: readonly TopicTrail[];
  routes: PublicRouteRegistry;
}): ValidationResult<PermanentRedirect[]> {
  const diagnostics: ValidationDiagnostic[] = [];
  const currentPathnames = new Set<string>([
    routePathname(input.routes.home),
    routePathname(input.routes.methodology_current),
    routePathname(input.routes.methodology_version),
    routePathname(input.routes.about),
    routePathname(input.routes.changelog),
    routePathname(input.routes.export),
    routePathname(input.routes.dataset_schema),
    routePathname(input.routes.dataset_latest),
    ...(input.routes.dataset_artifact ? [routePathname(input.routes.dataset_artifact)] : []),
    ...Object.values(input.routes.entries).map(routePathname),
    ...Object.values(input.routes.topic_trails).map(routePathname),
  ]);
  const redirects: PermanentRedirect[] = [];

  const addAliases = (record: Entry | TopicTrail, recordType: "entry" | "topic_trail") => {
    const destination =
      recordType === "entry" ? input.routes.entries[record.id] : input.routes.topic_trails[record.id];
    if (!destination) return;
    for (const [index, alias] of record.aliases.entries()) {
      const source = publicPath(
        recordType === "entry" ? `/entries/${alias}/` : `/topic-trails/${alias}/`,
      );
      if (alias === record.slug) {
        diagnostics.push(
          routeDiagnostic(
            "slug_alias_collision",
            recordType,
            ["aliases", index],
            "An alias must not equal the current slug.",
            alias,
            record.id,
          ),
        );
      }
      if (currentPathnames.has(routePathname(source))) {
        diagnostics.push(
          routeDiagnostic(
            "redirect_source_route_collision",
            recordType,
            ["aliases", index],
            "A redirect source must not collide with a current public route.",
            source,
            record.id,
          ),
        );
      }
      redirects.push({ source, destination, status: 301, record_type: recordType, record_id: record.id });
    }
  };
  input.entries.forEach((entry) => addAliases(entry, "entry"));
  input.topic_trails.forEach((trail) => addAliases(trail, "topic_trail"));

  const bySource = new Map<PublicPath, PermanentRedirect>();
  for (const redirect of redirects) {
    const existing = bySource.get(redirect.source);
    if (existing) {
      diagnostics.push(
        routeDiagnostic(
          "duplicate_redirect_source",
          redirect.record_type,
          ["aliases"],
          "Permanent redirect sources must be unique.",
          redirect.source,
          redirect.record_id,
          existing.record_id,
        ),
      );
    } else {
      bySource.set(redirect.source, redirect);
    }
  }
  const sources = new Set(bySource.keys());
  for (const redirect of redirects) {
    if (redirect.source === redirect.destination) {
      diagnostics.push(
        routeDiagnostic(
          "redirect_loop",
          redirect.record_type,
          ["aliases"],
          "A permanent redirect must not point to itself.",
          redirect.source,
          redirect.record_id,
        ),
      );
    }
    if (sources.has(redirect.destination)) {
      diagnostics.push(
        routeDiagnostic(
          "redirect_chain",
          redirect.record_type,
          ["aliases"],
          "Every alias must redirect directly to a current canonical route.",
          redirect.destination,
          redirect.record_id,
        ),
      );
    }
    if (!currentPathnames.has(routePathname(redirect.destination))) {
      diagnostics.push(
        routeDiagnostic(
          "invalid_redirect_destination",
          redirect.record_type,
          ["slug"],
          "Every permanent redirect destination must resolve to a current canonical route.",
          redirect.destination,
          redirect.record_id,
        ),
      );
    }
  }

  return diagnostics.length > 0
    ? { success: false, diagnostics }
    : {
        success: true,
        data: [...redirects].sort((left, right) => left.source.localeCompare(right.source, "en")),
        diagnostics: [],
      };
}

export function toCanonicalUrl(origin: SiteOrigin, path: PublicPath): AbsoluteCanonicalUrl {
  return `${origin}${path}` as AbsoluteCanonicalUrl;
}
