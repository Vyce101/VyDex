// Projects resolved and private-preview Topic Trail data into the route-index page model.
import {
  STAGE_ONE_FIXED_PUBLIC_PATHS,
  calendarDateSchema,
  plainTextSchema,
  rfc3339UtcTimestampSchema,
  type AbsoluteCanonicalUrl,
  type ResolvedPublicEntry,
  type ResolvedTopicTrail,
} from "../../domain";

const MISSING_REQUIRED_FIELD = "Missing Required Field" as const;
const UNKNOWN_LAST_ACTIVITY = "Unknown" as const;
const DEFAULT_ORDER = "Latest Updates" as const;
const TOPIC_TRAILS_METHODOLOGY_HREF =
  `${STAGE_ONE_FIXED_PUBLIC_PATHS.methodology_current}#topic-trails` as const;

export type TopicTrailPrivatePreviewSource = {
  topic_trail?: {
    name?: unknown;
    description?: unknown;
    canonical_url?: unknown;
  };
  entries?: readonly ResolvedPublicEntry[];
  entry_count?: unknown;
  last_activity?: {
    published_at?: unknown;
  };
};

export type TopicTrailPagePresentationInput =
  | { mode: "production"; trail: ResolvedTopicTrail }
  | { mode: "private_preview"; trail?: TopicTrailPrivatePreviewSource };

export type TopicTrailPageViewModel = {
  kind: "topic_trail";
  is_private_preview: boolean;
  name: string;
  description: string;
  metadata: {
    entry_count: number;
    last_activity: { iso: string; label: string } | null;
    default_order: typeof DEFAULT_ORDER;
  };
  methodology_href: typeof TOPIC_TRAILS_METHODOLOGY_HREF;
  entry_preview_topic_trail?: {
    name: string;
    canonical_url: AbsoluteCanonicalUrl;
  };
  entries: readonly ResolvedPublicEntry[];
};

function parseRequiredText(value: unknown, field: string): string {
  const result = plainTextSchema.safeParse(value);
  if (!result.success) throw new Error(`The production Topic Trail Page requires ${field}.`);
  return result.data;
}

function parsePreviewText(value: unknown): string {
  const result = plainTextSchema.safeParse(value);
  return result.success ? result.data : MISSING_REQUIRED_FIELD;
}

function parseCanonicalUrl(value: unknown): AbsoluteCanonicalUrl {
  if (typeof value !== "string") {
    throw new Error("The production Topic Trail Page requires a canonical route.");
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    throw new Error("The production Topic Trail Page requires a valid canonical route.");
  }
  return value as AbsoluteCanonicalUrl;
}

function parsePreviewCanonicalUrl(value: unknown): AbsoluteCanonicalUrl | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  } catch {
    return undefined;
  }
  return value as AbsoluteCanonicalUrl;
}

function parseLastActivity(value: unknown): { iso: string; label: string } {
  const timestamp = rfc3339UtcTimestampSchema.safeParse(value);
  if (!timestamp.success) {
    throw new Error("The production Topic Trail Page requires Last Activity.");
  }
  const iso = calendarDateSchema.parse(timestamp.data.slice(0, 10));
  return { iso, label: iso };
}

function parseProductionTrail(trail: ResolvedTopicTrail): TopicTrailPageViewModel {
  const name = parseRequiredText(trail?.topic_trail?.name, "a Trail Name");
  const description = parseRequiredText(
    trail?.topic_trail?.description,
    "a one-sentence description",
  );
  if (!Array.isArray(trail?.entries) || trail.entries.length === 0) {
    throw new Error("The production Topic Trail Page requires at least one public Entry.");
  }
  if (!Number.isInteger(trail.entry_count) || trail.entry_count !== trail.entries.length) {
    throw new Error("The production Topic Trail Page requires an accurate Entry count.");
  }

  const firstEntry = trail.entries[0]!;
  if (
    trail.last_activity?.entry_id !== firstEntry.entry.id ||
    trail.last_activity.published_at !==
      firstEntry.activity.latest_meaningful_activity.published_at
  ) {
    throw new Error("The production Topic Trail Page requires consistent Last Activity.");
  }

  return {
    kind: "topic_trail",
    is_private_preview: false,
    name,
    description,
    metadata: {
      entry_count: trail.entry_count,
      last_activity: parseLastActivity(trail.last_activity.published_at),
      default_order: DEFAULT_ORDER,
    },
    methodology_href: TOPIC_TRAILS_METHODOLOGY_HREF,
    entry_preview_topic_trail: {
      name,
      canonical_url: parseCanonicalUrl(trail.canonical_url),
    },
    entries: [...trail.entries],
  };
}

function parsePreviewEntryCount(value: unknown, entries: readonly ResolvedPublicEntry[]): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : entries.length;
}

function parsePreviewLastActivity(value: unknown): { iso: string; label: string } | null {
  const timestamp = rfc3339UtcTimestampSchema.safeParse(value);
  if (!timestamp.success) return null;
  const isoResult = calendarDateSchema.safeParse(timestamp.data.slice(0, 10));
  return isoResult.success ? { iso: isoResult.data, label: isoResult.data } : null;
}

function parsePrivatePreviewTrail(
  trail?: TopicTrailPrivatePreviewSource,
): TopicTrailPageViewModel {
  const entries = Array.isArray(trail?.entries) ? [...trail.entries] : [];
  const name = parsePreviewText(trail?.topic_trail?.name);
  const canonicalUrl = parsePreviewCanonicalUrl(trail?.topic_trail?.canonical_url);
  return {
    kind: "topic_trail",
    is_private_preview: true,
    name,
    description: parsePreviewText(trail?.topic_trail?.description),
    metadata: {
      entry_count: parsePreviewEntryCount(trail?.entry_count, entries),
      last_activity: parsePreviewLastActivity(trail?.last_activity?.published_at),
      default_order: DEFAULT_ORDER,
    },
    methodology_href: TOPIC_TRAILS_METHODOLOGY_HREF,
    ...(canonicalUrl
      ? { entry_preview_topic_trail: { name, canonical_url: canonicalUrl } }
      : {}),
    entries,
  };
}

export function createTopicTrailPagePresentationModel(
  input: TopicTrailPagePresentationInput,
): TopicTrailPageViewModel {
  return input.mode === "production"
    ? parseProductionTrail(input.trail)
    : parsePrivatePreviewTrail(input.trail);
}

export const TOPIC_TRAIL_PREVIEW_FALLBACKS = Object.freeze({
  missing_required_field: MISSING_REQUIRED_FIELD,
  unknown_last_activity: UNKNOWN_LAST_ACTIVITY,
});
