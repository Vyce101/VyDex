// Resolves validated records into public Entries, trails, About links, and changelog events.
import type { AboutRecord, Methodology, MethodologyPublicationEvent, TopicTrail } from "../canonical-records";
import type { ValidationDiagnostic } from "../cross-record-validation";
import { toCanonicalUrl, type PublicRouteRegistry, type SiteOrigin } from "../route-generation";
import { createReleaseDiagnostic } from "./release-diagnostics";
import type { ValidatedHistory, ValidatedInputs } from "./release-input-validation";
import type {
  EntryChangelogEvent,
  MethodologyChangelogEvent,
  PublicChangelogEvent,
  ResolvedAboutRecord,
  ResolvedPublicEntry,
  ResolvedTopicTrail,
  ResolvedTopicTrailReference,
} from "./types";

function compareResolvedEntries(left: ResolvedPublicEntry, right: ResolvedPublicEntry): number {
  const timestampOrder = right.activity.latest_meaningful_activity.published_at.localeCompare(
    left.activity.latest_meaningful_activity.published_at,
  );
  if (timestampOrder !== 0) return timestampOrder;
  const titleOrder = left.entry.title.localeCompare(right.entry.title, "en");
  return titleOrder !== 0 ? titleOrder : left.entry.id.localeCompare(right.entry.id, "en");
}

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
    const entry = snapshot.entry;
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
  return resolved.sort(compareResolvedEntries);
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
    const entries = input.entries.filter(
      ({ entry }) =>
        entry.primary_topic_trail_id === trail.id || entry.secondary_topic_trail_ids.includes(trail.id),
    );
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
        entry_title: latestEntry.entry.title,
      },
    });
  }
  if (hasEmptyTrail) return undefined;
  return resolved.sort((left, right) => left.topic_trail.name.localeCompare(right.topic_trail.name, "en"));
}

const CHANGELOG_TYPE_ORDER = {
  methodology_change: 0,
  added: 1,
  updated: 2,
  removed: 3,
} as const;

function compareChangelogEvents(left: PublicChangelogEvent, right: PublicChangelogEvent): number {
  const dateOrder = right.date.localeCompare(left.date);
  if (dateOrder !== 0) return dateOrder;
  if ("timestamp" in left && "timestamp" in right) {
    const timestampOrder = right.timestamp.localeCompare(left.timestamp);
    if (timestampOrder !== 0) return timestampOrder;
  }
  const typeOrder = CHANGELOG_TYPE_ORDER[left.type] - CHANGELOG_TYPE_ORDER[right.type];
  if (typeOrder !== 0) return typeOrder;
  const titleOrder = left.title.localeCompare(right.title, "en");
  return titleOrder !== 0
    ? titleOrder
    : left.source_identity.localeCompare(right.source_identity, "en");
}

export function deriveChangelog(input: {
  histories: ReadonlyMap<string, ValidatedHistory>;
  methodologyEvent: MethodologyPublicationEvent;
  methodologyUrl: ReturnType<typeof toCanonicalUrl>;
  routes: PublicRouteRegistry;
  origin: SiteOrigin;
  diagnostics: ValidationDiagnostic[];
}): PublicChangelogEvent[] | undefined {
  const events: PublicChangelogEvent[] = [];
  const categoryTypes = {
    initial_publication: "added",
    material_update: "updated",
    removal: "removed",
  } as const;
  for (const history of input.histories.values()) {
    for (const snapshot of history.snapshots) {
      if (snapshot.materiality !== "material") continue;
      const type = categoryTypes[snapshot.revision_category as keyof typeof categoryTypes];
      if (!type) continue;
      const entryPath = input.routes.entries[snapshot.entry_id];
      const event: EntryChangelogEvent = {
        type,
        date: snapshot.published_at.slice(0, 10) as EntryChangelogEvent["date"],
        timestamp: snapshot.published_at,
        title: snapshot.entry.title,
        summary: snapshot.update_summary,
        source_identity: snapshot.revision_id,
        entry_id: snapshot.entry_id,
        ...(type !== "removed" && entryPath
          ? { canonical_url: toCanonicalUrl(input.origin, entryPath) }
          : {}),
      };
      events.push(event);
    }
  }
  const methodologyEvent: MethodologyChangelogEvent = {
    type: "methodology_change",
    date: input.methodologyEvent.date,
    title: input.methodologyEvent.title,
    summary: input.methodologyEvent.summary,
    source_identity: input.methodologyEvent.methodology_id,
    methodology_id: input.methodologyEvent.methodology_id,
    canonical_url: input.methodologyUrl,
  };
  events.push(methodologyEvent);
  if (events.length === 0) {
    input.diagnostics.push(
      createReleaseDiagnostic(
        "material_changelog_event_required",
        "release",
        ["changelog_events"],
        "The public Changelog must contain at least one genuine material event.",
      ),
    );
    return undefined;
  }
  return events.sort(compareChangelogEvents);
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
