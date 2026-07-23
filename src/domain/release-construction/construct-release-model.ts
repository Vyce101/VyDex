// Orchestrates deterministic production and preview release construction.
import type { ValidationDiagnostic } from "../cross-record-validation";
import {
  buildPermanentRedirects,
  buildPublicRouteRegistry,
  toCanonicalUrl,
  type PublicRouteRegistry,
} from "../route-generation";
import { buildInvalidPreviewRecords, deepFreeze } from "./preview-records";
import { deduplicateDiagnostics } from "./release-diagnostics";
import { validateReleaseInputs } from "./release-input-validation";
import {
  deriveChangelog,
  resolveAbout,
  resolveEntries,
  resolveTopicTrails,
} from "./release-resolution";
import type {
  ConstructReleaseModelInput,
  ConstructReleaseModelResult,
  PartialResolvedRelease,
  PublicChangelogEvent,
  ReleaseModel,
  ResolvedAboutRecord,
  ResolvedMethodology,
  ResolvedPublicEntry,
  ResolvedTopicTrail,
} from "./types";

export function constructReleaseModel(input: ConstructReleaseModelInput): ConstructReleaseModelResult {
  const diagnostics: ValidationDiagnostic[] = [...input.records.diagnostics];
  const state = validateReleaseInputs(input, diagnostics);
  const resolved: PartialResolvedRelease = {
    ...(state.releaseMetadata ? { release_metadata: state.releaseMetadata } : {}),
    ...(state.originResult.success ? { site_origin: state.originResult.data } : {}),
  };

  let routes: PublicRouteRegistry | undefined;
  let fixedResolutionRoutes: PublicRouteRegistry | undefined;
  let resolvedEntries: ResolvedPublicEntry[] | undefined;
  let resolvedTrails: ResolvedTopicTrail[] | undefined;
  let resolvedMethodology: ResolvedMethodology | undefined;
  let resolvedAbout: ResolvedAboutRecord | undefined;
  let changelogEvents: PublicChangelogEvent[] | undefined;

  if (state.coreRecordsValid) {
    const selectedEntries = state.parsed.entries.map(
      ({ data }) => state.histories.get(data.id)!.snapshots.at(-1)!.entry,
    );
    const routeResult = buildPublicRouteRegistry({
      entries: selectedEntries,
      topic_trails: state.parsed.topicTrails.map(({ data }) => data),
      ...(state.releaseMetadata ? { release_metadata: state.releaseMetadata } : {}),
    });
    if (!routeResult.success) diagnostics.push(...routeResult.diagnostics);
    else {
      routes = routeResult.data;
      resolved.routes = routes;
    }
  }

  if (!routes) {
    const fixedRouteResult = buildPublicRouteRegistry({
      entries: [],
      topic_trails: [],
      ...(state.releaseMetadata ? { release_metadata: state.releaseMetadata } : {}),
    });
    if (fixedRouteResult.success) fixedResolutionRoutes = fixedRouteResult.data;
  } else {
    fixedResolutionRoutes = routes;
  }

  if (fixedResolutionRoutes && state.originResult.success && state.methodology) {
    resolvedMethodology = {
      methodology: state.methodology,
      current_url: toCanonicalUrl(state.originResult.data, fixedResolutionRoutes.methodology_current),
      version_url: toCanonicalUrl(state.originResult.data, fixedResolutionRoutes.methodology_version),
    };
    resolved.methodology = resolvedMethodology;
  }

  if (routes && state.originResult.success && state.methodology) {
    resolvedEntries = resolveEntries({
      parsed: state.parsed,
      histories: state.histories,
      methodology: state.methodology,
      routes,
      origin: state.originResult.data,
    });
    if (resolvedEntries) {
      resolved.current_entries = resolvedEntries;
      resolvedTrails = resolveTopicTrails({
        trails: state.parsed.topicTrails.map(({ data }) => data),
        entries: resolvedEntries,
        routes,
        origin: state.originResult.data,
        diagnostics,
      });
      if (resolvedTrails) resolved.topic_trails = resolvedTrails;

      const redirectResult = buildPermanentRedirects({
        entries: resolvedEntries.map(({ entry }) => entry),
        topic_trails: state.parsed.topicTrails.map(({ data }) => data),
        routes,
      });
      if (!redirectResult.success) diagnostics.push(...redirectResult.diagnostics);
      else resolved.redirects = redirectResult.data;
    }
  }

  if (fixedResolutionRoutes && state.originResult.success && state.about) {
    resolvedAbout = resolveAbout(state.about, fixedResolutionRoutes, state.originResult.data);
    resolved.about = resolvedAbout;
  }

  if (
    routes &&
    state.originResult.success &&
    state.methodologyEvent &&
    resolvedMethodology &&
    state.coreRecordsValid
  ) {
    changelogEvents = deriveChangelog({
      histories: state.histories,
      methodologyEvent: state.methodologyEvent,
      methodologyUrl: resolvedMethodology.version_url,
      routes,
      origin: state.originResult.data,
      diagnostics,
    });
    if (changelogEvents) resolved.changelog_events = changelogEvents;
  }

  const finalDiagnostics = deduplicateDiagnostics(diagnostics);
  if (input.mode === "preview") {
    const sources = [
      ...input.records.entries,
      ...input.records.topic_trails,
      ...input.records.methodologies,
      ...input.records.about,
      ...input.records.methodology_publication_events,
      ...input.records.entry_publication_snapshots,
    ];
    return {
      mode: "preview",
      success: true,
      preview: deepFreeze({
        mode: "preview",
        promotable: finalDiagnostics.length === 0,
        resolved,
        invalid_records: buildInvalidPreviewRecords(sources, finalDiagnostics),
        diagnostics: finalDiagnostics,
      }),
    };
  }

  if (
    finalDiagnostics.length > 0 ||
    state.releaseMetadata === undefined ||
    !state.originResult.success ||
    routes === undefined ||
    resolvedEntries === undefined ||
    resolvedMethodology === undefined ||
    resolvedTrails === undefined ||
    resolvedAbout === undefined ||
    changelogEvents === undefined ||
    resolved.redirects === undefined ||
    routes.dataset_artifact === undefined
  ) {
    return { mode: "production", success: false, release: null, diagnostics: finalDiagnostics };
  }

  const release: ReleaseModel = {
    mode: "production",
    release_metadata: state.releaseMetadata,
    site_origin: state.originResult.data,
    routes,
    current_entries: resolvedEntries,
    methodology: resolvedMethodology,
    topic_trails: resolvedTrails,
    about: resolvedAbout,
    changelog_events: changelogEvents,
    redirects: resolved.redirects,
  };
  return { mode: "production", success: true, release: deepFreeze(release), diagnostics: [] };
}
