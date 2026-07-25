// Projects resolved material events into display-safe Changelog date groups.
import {
  calendarDateSchema,
  plainTextSchema,
  publicChangelogTypeSchema,
  rfc3339UtcTimestampSchema,
  uuidV7Schema,
  type PublicChangelogEvent,
} from "../../domain";

const CHANGE_TYPE_DEFINITIONS = [
  { type: "added", label: "Added", description: "New entry added to the ledger." },
  {
    type: "updated",
    label: "Updated",
    description: "Important source, status, evidence, caveat, context, or interpretation changed.",
  },
  {
    type: "removed",
    label: "Removed",
    description:
      "Entry removed because it no longer meets criteria or no longer supports the frontier interpretation.",
  },
  {
    type: "methodology_change",
    label: "Methodology Change",
    description: "Rules, labels, categories, or judgment standards changed.",
  },
] as const;

const CHANGE_TYPE_LABELS = Object.fromEntries(
  CHANGE_TYPE_DEFINITIONS.map(({ type, label }) => [type, label]),
) as Record<PublicChangelogEvent["type"], string>;

export type ChangelogRecordLink = {
  href: string;
  label: "View Entry →" | "View Methodology →";
  accessible_name: string;
};

export type ChangelogRecordViewModel = {
  type: PublicChangelogEvent["type"];
  type_label: string;
  title: string;
  summary: string;
  link?: ChangelogRecordLink;
};

export type ChangelogPageViewModel = {
  title: "Changelog";
  intro: "Material changes to the VyDex evidence ledger.";
  explanation:
    "This page records new entries, meaningful updates, removals, and methodology changes.";
  change_types: typeof CHANGE_TYPE_DEFINITIONS;
  date_groups: Array<{
    date: string;
    records: ChangelogRecordViewModel[];
  }>;
};

function requireCanonicalUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("The production Changelog requires a valid affected-record URL when one is present.");
  }

  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username !== "" ||
      url.password !== ""
    ) {
      throw new Error();
    }
  } catch {
    throw new Error("The production Changelog requires a valid affected-record URL when one is present.");
  }

  return value;
}

function projectRecord(event: PublicChangelogEvent): {
  date: string;
  record: ChangelogRecordViewModel;
} {
  const type = publicChangelogTypeSchema.safeParse(event?.type);
  if (!type.success) throw new Error("The production Changelog requires a valid event type.");

  const publishedAt = rfc3339UtcTimestampSchema.safeParse(event?.published_at);
  if (!publishedAt.success) {
    throw new Error("The production Changelog requires an exact publication timestamp.");
  }

  const derivedDate = calendarDateSchema.parse(publishedAt.data.slice(0, 10));
  if (event.date !== derivedDate) {
    throw new Error("The production Changelog requires calendar dates derived from publication timestamps.");
  }

  const title = plainTextSchema.safeParse(event?.title);
  if (!title.success) throw new Error("The production Changelog requires an event title.");

  const summary = plainTextSchema.safeParse(event?.summary);
  if (!summary.success) throw new Error("The production Changelog requires an event summary.");

  const sourceIdentity = uuidV7Schema.safeParse(event?.source_identity);
  if (!sourceIdentity.success) {
    throw new Error("The production Changelog requires an immutable event identity.");
  }

  const canonicalUrl = event.canonical_url;
  const link = canonicalUrl !== undefined
    ? event.type === "methodology_change"
      ? {
          href: requireCanonicalUrl(canonicalUrl),
          label: "View Methodology →" as const,
          accessible_name: `View Methodology: ${title.data}`,
        }
      : {
          href: requireCanonicalUrl(canonicalUrl),
          label: "View Entry →" as const,
          accessible_name: `View Entry: ${title.data}`,
        }
    : undefined;

  return {
    date: derivedDate,
    record: {
      type: event.type,
      type_label: CHANGE_TYPE_LABELS[event.type],
      title: title.data,
      summary: summary.data,
      ...(link ? { link } : {}),
    },
  };
}

export function createChangelogPageViewModel(
  events: readonly PublicChangelogEvent[],
): ChangelogPageViewModel {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error("The production Changelog requires at least one material event.");
  }

  const dateGroups: ChangelogPageViewModel["date_groups"] = [];
  for (const event of events) {
    const projected = projectRecord(event);
    const currentGroup = dateGroups.at(-1);
    if (currentGroup?.date === projected.date) {
      currentGroup.records.push(projected.record);
      continue;
    }

    dateGroups.push({ date: projected.date, records: [projected.record] });
  }

  return {
    title: "Changelog",
    intro: "Material changes to the VyDex evidence ledger.",
    explanation:
      "This page records new entries, meaningful updates, removals, and methodology changes.",
    change_types: CHANGE_TYPE_DEFINITIONS,
    date_groups: dateGroups,
  };
}
