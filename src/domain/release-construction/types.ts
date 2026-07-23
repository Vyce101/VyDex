// Defines release-construction inputs and resolved production and preview models.
import type {
  AboutRecord,
  CalendarDate,
  Entry,
  EntryPublicationSnapshot,
  Methodology,
  MethodologyPublicationEvent,
  ReleaseMetadata,
  Rfc3339UtcTimestamp,
  TopicTrail,
  UUIDv7,
} from "../canonical-records";
import type { ValidationDiagnostic } from "../cross-record-validation";
import type { DerivedEntryRevisionActivity, LatestMeaningfulActivity } from "../material-activity";
import type {
  AbsoluteCanonicalUrl,
  PermanentRedirect,
  PublicRouteRegistry,
  SiteOrigin,
} from "../route-generation";

export type CanonicalRecordSource = {
  record_type:
    | "entry"
    | "topic_trail"
    | "methodology"
    | "about"
    | "methodology_publication_event"
    | "entry_publication_snapshot";
  filename: string;
  raw_text?: string;
  value: unknown;
};

export type LoadedCanonicalRecords = {
  entries: CanonicalRecordSource[];
  topic_trails: CanonicalRecordSource[];
  methodologies: CanonicalRecordSource[];
  about: CanonicalRecordSource[];
  methodology_publication_events: CanonicalRecordSource[];
  entry_publication_snapshots: CanonicalRecordSource[];
  diagnostics: ValidationDiagnostic[];
};

export type ResolvedTopicTrailReference = {
  id: UUIDv7;
  slug: TopicTrail["slug"];
  name: string;
  canonical_url: AbsoluteCanonicalUrl;
};

export type ResolvedMethodologyReference = {
  id: UUIDv7;
  public_version: Methodology["public_version"];
  title: string;
  canonical_url: AbsoluteCanonicalUrl;
};

export type ResolvedPublicEntry = {
  entry: Entry;
  snapshot: EntryPublicationSnapshot;
  activity: DerivedEntryRevisionActivity;
  canonical_url: AbsoluteCanonicalUrl;
  primary_topic_trail: ResolvedTopicTrailReference;
  secondary_topic_trails: ResolvedTopicTrailReference[];
  methodology: ResolvedMethodologyReference;
};

export type TopicTrailLastActivity = LatestMeaningfulActivity & {
  entry_id: UUIDv7;
  entry_title: string;
};

export type ResolvedTopicTrail = {
  topic_trail: TopicTrail;
  canonical_url: AbsoluteCanonicalUrl;
  entries: ResolvedPublicEntry[];
  entry_count: number;
  last_activity: TopicTrailLastActivity;
};

export type ResolvedMethodology = {
  methodology: Methodology;
  current_url: AbsoluteCanonicalUrl;
  version_url: AbsoluteCanonicalUrl;
};

export type ResolvedAboutRelatedLink = {
  title: string;
  description: string;
  url: AbsoluteCanonicalUrl;
};

export type ResolvedAboutRecord = Omit<AboutRecord, "related_links"> & {
  related_links: {
    methodology: ResolvedAboutRelatedLink;
    changelog: ResolvedAboutRelatedLink;
    export_json: ResolvedAboutRelatedLink;
  };
};

export type EntryChangelogEvent = {
  type: "added" | "updated" | "removed";
  date: CalendarDate;
  timestamp: Rfc3339UtcTimestamp;
  title: string;
  summary: string;
  source_identity: UUIDv7;
  entry_id: UUIDv7;
  canonical_url?: AbsoluteCanonicalUrl;
};

export type MethodologyChangelogEvent = {
  type: "methodology_change";
  date: CalendarDate;
  title: string;
  summary: string;
  source_identity: UUIDv7;
  methodology_id: UUIDv7;
  canonical_url: AbsoluteCanonicalUrl;
};

export type PublicChangelogEvent = EntryChangelogEvent | MethodologyChangelogEvent;

export type ReleaseModel = {
  mode: "production";
  release_metadata: ReleaseMetadata;
  site_origin: SiteOrigin;
  routes: PublicRouteRegistry;
  current_entries: ResolvedPublicEntry[];
  methodology: ResolvedMethodology;
  topic_trails: ResolvedTopicTrail[];
  about: ResolvedAboutRecord;
  changelog_events: PublicChangelogEvent[];
  redirects: PermanentRedirect[];
};

export type InvalidPreviewRecord = {
  record_type: CanonicalRecordSource["record_type"];
  record_id?: string;
  filename: string;
  raw_or_partial_value: unknown;
  diagnostics: ValidationDiagnostic[];
  unresolved_relationships: ValidationDiagnostic[];
};

export type PartialResolvedRelease = {
  release_metadata?: ReleaseMetadata;
  site_origin?: SiteOrigin;
  routes?: PublicRouteRegistry;
  current_entries?: ResolvedPublicEntry[];
  methodology?: ResolvedMethodology;
  topic_trails?: ResolvedTopicTrail[];
  about?: ResolvedAboutRecord;
  changelog_events?: PublicChangelogEvent[];
  redirects?: PermanentRedirect[];
};

export type PreviewReleaseModel = {
  mode: "preview";
  promotable: boolean;
  resolved: PartialResolvedRelease;
  invalid_records: InvalidPreviewRecord[];
  diagnostics: ValidationDiagnostic[];
};

export type ConstructReleaseModelInput = {
  records: LoadedCanonicalRecords;
  release_metadata?: unknown;
  site_origin?: unknown;
  mode: "production" | "preview";
};

export type ConstructReleaseModelResult =
  | { mode: "production"; success: true; release: ReleaseModel; diagnostics: readonly [] }
  | { mode: "production"; success: false; release: null; diagnostics: ValidationDiagnostic[] }
  | { mode: "preview"; success: true; preview: PreviewReleaseModel };

export type ValidatedReleaseRecords = {
  entries: Entry[];
  topic_trails: TopicTrail[];
  methodologies: Methodology[];
  about?: AboutRecord;
  methodology_publication_event?: MethodologyPublicationEvent;
  snapshots: EntryPublicationSnapshot[];
};
