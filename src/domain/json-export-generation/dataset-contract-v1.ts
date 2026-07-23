// Defines the exact public Dataset 1.0.0 types and generated artifact descriptors.
import type {
  CalendarDate,
  Domain,
  Entry,
  EntrySourceCitation,
  EvidenceType,
  HttpUrl,
  MethodologyVersion,
  ReleaseMetadata,
  Rfc3339UtcTimestamp,
  SourceRole,
  TopicTrail,
  UUIDv7,
} from "../canonical-records";
import type { AbsoluteCanonicalUrl, PublicPath } from "../route-generation";
import { DATASET_LATEST_PUBLIC_PATH, DATASET_SCHEMA_PUBLIC_PATH } from "../route-generation";

export type CitationId = EntrySourceCitation["citation_id"];

export type ExportDatesV1 = {
  date_happened: CalendarDate | null;
  date_disclosed: CalendarDate | null;
  date_added: CalendarDate;
  date_updated: CalendarDate;
  date_last_checked: CalendarDate;
  next_check_date: CalendarDate | null;
};

export type ExportRevisionMetadataV1 = {
  revision_id: UUIDv7;
  revision_number: number;
  revision_published_at: Rfc3339UtcTimestamp;
  latest_update_summary: string;
};

export type ExportTopicTrailReferenceV1 = {
  id: TopicTrail["id"];
  name: TopicTrail["name"];
  slug: TopicTrail["slug"];
  canonical_url: AbsoluteCanonicalUrl;
};

export type ExportMethodologyReferenceV1 = {
  id: UUIDv7;
  version: MethodologyVersion;
  canonical_url: AbsoluteCanonicalUrl;
};

export type ExportSourceV1 = {
  citation_id: CitationId;
  title: string;
  publisher_or_domain: string;
  url: HttpUrl;
  evidence_types: EvidenceType[];
  source_role: SourceRole;
  source_role_label: string;
  used_for: string;
};

export type ExportEntryV1 = ExportRevisionMetadataV1 & {
  id: UUIDv7;
  slug: Entry["slug"];
  canonical_url: AbsoluteCanonicalUrl;
  title: string;
  claim: string;
  claim_status: Entry["claim_status"];
  evidence_strength: Entry["evidence_strength"];
  evidence_strength_score: number;
  review_status: Entry["review_status"];
  review_reason: string | null;
  entry_state: "main_entry";
  domains: Domain[];
  primary_topic_trail: ExportTopicTrailReferenceV1;
  secondary_topic_trails: ExportTopicTrailReferenceV1[];
  methodology: ExportMethodologyReferenceV1;
  dates: ExportDatesV1;
  frontier_delta: Entry["frontier_delta"];
  details: Entry["details"];
  confirmed_significance: string;
  potential_significance_if_confirmed: string | null;
  caveats: string[];
  evidence_types: EvidenceType[];
  sources: ExportSourceV1[];
};

export type VyDexDatasetV1 = {
  $schema: AbsoluteCanonicalUrl;
  dataset_name: "VyDex";
  dataset_schema_version: "1.0.0";
  release_id: ReleaseMetadata["release_id"];
  generated_at: ReleaseMetadata["generated_at"];
  scope: "latest_entry_versions";
  entry_count: number;
  methodology_versions: MethodologyVersion[];
  entries: ExportEntryV1[];
};

export type LatestDatasetRedirect = {
  source: typeof DATASET_LATEST_PUBLIC_PATH;
  destination: PublicPath;
  status: 302;
  kind: "latest_dataset";
};

export type GeneratedDatasetArtifactV1 = {
  dataset: VyDexDatasetV1;
  serialized_json: string;
  public_path: PublicPath;
  schema_public_path: typeof DATASET_SCHEMA_PUBLIC_PATH;
  latest_dataset_redirect: LatestDatasetRedirect;
};

export type JsonSchemaDocument = Record<string, unknown>;

export type GeneratedDatasetSchemaArtifactV1 = {
  schema: JsonSchemaDocument;
  serialized_json: string;
  public_path: typeof DATASET_SCHEMA_PUBLIC_PATH;
};
