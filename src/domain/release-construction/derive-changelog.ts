// Derives and deterministically orders public material Changelog events.
import type { MethodologyPublicationEvent } from "../canonical-records";
import type { ValidationDiagnostic } from "../cross-record-validation";
import { toCanonicalUrl, type PublicRouteRegistry, type SiteOrigin } from "../route-generation";
import { createReleaseDiagnostic } from "./release-diagnostics";
import type { ValidatedHistory } from "./release-input-validation";
import type {
  EntryChangelogEvent,
  MethodologyChangelogEvent,
  PublicChangelogEvent,
} from "./types";

const CHANGELOG_TYPE_ORDER = {
  methodology_change: 0,
  added: 1,
  updated: 2,
  removed: 3,
} as const;

export function comparePublicChangelogEvents(
  left: PublicChangelogEvent,
  right: PublicChangelogEvent,
): number {
  const timestampOrder = right.published_at.localeCompare(left.published_at);
  if (timestampOrder !== 0) return timestampOrder;

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
        published_at: snapshot.published_at,
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
    date: input.methodologyEvent.published_at.slice(0, 10) as MethodologyChangelogEvent["date"],
    published_at: input.methodologyEvent.published_at,
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

  return events.sort(comparePublicChangelogEvents);
}
