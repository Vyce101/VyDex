// Resolves validated records into public Entries, trails, and About links.
import type { AboutRecord, Methodology, TopicTrail } from "../canonical-records";
import type { ValidationDiagnostic } from "../cross-record-validation";
import { toCanonicalUrl, type PublicRouteRegistry, type SiteOrigin } from "../route-generation";
import { compareResolvedPublicEntriesByLatestMaterialActivity } from "./compare-resolved-public-entries";
import { compareResolvedTopicTrailEntriesByLatestUpdates } from "./compare-resolved-topic-trail-entries";
import { createReleaseDiagnostic } from "./release-diagnostics";
import { orderEntrySourcesForPublicDisplay } from "../source-ordering";
import type { ValidatedHistory, ValidatedInputs } from "./release-input-validation";
import type {
  ResolvedAboutRecord,
  ResolvedPublicEntry,
  ResolvedTopicTrail,
  ResolvedTopicTrailReference,
} from "./types";

export function resolveEntries(input: {
  parsed: ValidatedInputs;
  histories: ReadonlyMap<string, ValidatedHistory>;
  methodology: Methodology;
  routes: PublicRouteRegistry;
  origin: SiteOrigin;
}): ResolvedPublicEntry[] | undefined {
  const trailsById = new Map(input.parsed.topicTrails.map(({ data }) => [data.id, data]));
  const resolved: ResolvedPublicEntry[] = [];
  for (const { data: canonicalEntry } of input.parsed.entries) {
    const history = input.histories.get(canonicalEntry.id);
    if (!history) continue;
    const snapshot = history.snapshots.at(-1)!;
    const snapshotEntry = snapshot.entry;
    const entry = {
      ...snapshotEntry,
      sources: orderEntrySourcesForPublicDisplay(snapshotEntry.sources),
    };
    const entryPath = input.routes.entries[entry.id];
    const primaryTrail = trailsById.get(entry.primary_topic_trail_id);
    const secondaryTrails = entry.secondary_topic_trail_ids.map((id) => trailsById.get(id));
    if (!entryPath || !primaryTrail || secondaryTrails.some((trail) => !trail)) return undefined;

    const resolveTrail = (trail: TopicTrail): ResolvedTopicTrailReference => ({
      id: trail.id,
      slug: trail.slug,
      name: trail.name,
      canonical_url: toCanonicalUrl(input.origin, input.routes.topic_trails[trail.id]!),
    });
    const primaryReference = resolveTrail(primaryTrail);
    const secondaryReferences = secondaryTrails.map((trail) => resolveTrail(trail!));
    const methodologyReference = {
      id: input.methodology.id,
      public_version: input.methodology.public_version,
      title: input.methodology.title,
      canonical_url: toCanonicalUrl(input.origin, input.routes.methodology_version),
    };
    const canonicalUrl = toCanonicalUrl(input.origin, entryPath);
    resolved.push({
      entry,
      snapshot,
      activity: history.activity,
      canonical_url: canonicalUrl,
      primary_topic_trail: primaryReference,
      secondary_topic_trails: secondaryReferences,
      methodology: methodologyReference,
    });
  }
  return resolved.sort(compareResolvedPublicEntriesByLatestMaterialActivity);
}

export function resolveTopicTrails(input: {
  trails: readonly TopicTrail[];
  entries: readonly ResolvedPublicEntry[];
  routes: PublicRouteRegistry;
  origin: SiteOrigin;
  diagnostics: ValidationDiagnostic[];
}): ResolvedTopicTrail[] | undefined {
  const resolved: ResolvedTopicTrail[] = [];
  let hasEmptyTrail = false;
  for (const trail of input.trails) {
    const entries = input.entries
      .filter(
        ({ entry }) =>
          entry.primary_topic_trail_id === trail.id ||
          entry.secondary_topic_trail_ids.includes(trail.id),
      )
      .sort(compareResolvedTopicTrailEntriesByLatestUpdates);
    if (entries.length === 0) {
      hasEmptyTrail = true;
      input.diagnostics.push(
        createReleaseDiagnostic(
          "empty_public_topic_trail",
          "topic_trail",
          ["id"],
          "Every public Topic Trail must contain at least one public Entry.",
          trail.id,
          trail.id,
        ),
      );
      continue;
    }
    const latestEntry = entries[0]!;
    resolved.push({
      topic_trail: trail,
      canonical_url: toCanonicalUrl(input.origin, input.routes.topic_trails[trail.id]!),
      entries,
      entry_count: entries.length,
      last_activity: {
        ...latestEntry.activity.latest_meaningful_activity,
        entry_id: latestEntry.entry.id,
      },
    });
  }
  if (hasEmptyTrail) return undefined;
  return resolved.sort((left, right) => left.topic_trail.name.localeCompare(right.topic_trail.name, "en"));
}

export function resolveAbout(
  about: AboutRecord,
  routes: PublicRouteRegistry,
  origin: SiteOrigin,
): ResolvedAboutRecord {
  return {
    ...about,
    related_links: {
      methodology: {
        ...about.related_links.methodology,
        url: toCanonicalUrl(origin, routes.methodology_current),
      },
      changelog: {
        ...about.related_links.changelog,
        url: toCanonicalUrl(origin, routes.changelog),
      },
      export_json: {
        ...about.related_links.export_json,
        url: toCanonicalUrl(origin, routes.export),
      },
    },
  };
}
