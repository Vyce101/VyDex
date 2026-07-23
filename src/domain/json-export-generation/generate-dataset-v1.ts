// Projects a validated production release into deterministic Dataset 1.0.0 bytes.
import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  DOMAINS,
  EVIDENCE_STRENGTH_SCORES,
  EVIDENCE_TYPES,
  SOURCE_ROLES,
  SOURCE_ROLE_LABELS,
  releaseMetadataSchema,
  type Domain,
  type EntrySourceCitation,
  type EvidenceType,
} from "../canonical-records";
import type { ValidationDiagnostic, ValidationResult } from "../cross-record-validation";
import type { ReleaseModel, ResolvedPublicEntry } from "../release-construction";
import {
  DATASET_ARTIFACT_FILENAME,
  DATASET_LATEST_PUBLIC_PATH,
  DATASET_SCHEMA_PUBLIC_PATH,
  toCanonicalUrl,
  validateSiteOrigin,
  type PublicPath,
} from "../route-generation";
import type {
  ExportEntryV1,
  ExportSourceV1,
  ExportTopicTrailReferenceV1,
  GeneratedDatasetArtifactV1,
  LatestDatasetRedirect,
  VyDexDatasetV1,
} from "./dataset-contract-v1";
import { generateVyDexDatasetSchemaV1 } from "./dataset-schema-v1";
import { serializeJsonDocument } from "./deterministic-serialization";

function datasetDiagnostic(
  code: string,
  path: PropertyKey[],
  rule: string,
  invalidValue?: unknown,
): ValidationDiagnostic {
  return {
    severity: "error",
    code,
    record_type: "dataset_export",
    path,
    ...(invalidValue !== undefined ? { invalid_value: invalidValue } : {}),
    rule,
  };
}

function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareSourceTitles(left: EntrySourceCitation, right: EntrySourceCitation): number {
  const roleOrder = SOURCE_ROLES.indexOf(left.source_role) - SOURCE_ROLES.indexOf(right.source_role);
  return roleOrder !== 0 ? roleOrder : left.title.localeCompare(right.title, "en");
}

function sortControlledValues<Value extends string>(
  values: readonly Value[],
  order: readonly Value[],
): Value[] {
  return [...values].sort((left, right) => order.indexOf(left) - order.indexOf(right));
}

function projectTopicTrail(reference: ResolvedPublicEntry["primary_topic_trail"]): ExportTopicTrailReferenceV1 {
  return {
    id: reference.id,
    name: reference.name,
    slug: reference.slug,
    canonical_url: reference.canonical_url,
  };
}

function projectSource(source: EntrySourceCitation): ExportSourceV1 {
  return {
    citation_id: source.citation_id,
    title: source.title,
    publisher_or_domain: source.publisher_or_domain,
    url: source.url,
    evidence_types: sortControlledValues(source.evidence_types, EVIDENCE_TYPES),
    source_role: source.source_role,
    source_role_label: SOURCE_ROLE_LABELS[source.source_role],
    used_for: source.used_for,
  };
}

function deriveEvidenceTypes(sources: readonly ExportSourceV1[]): EvidenceType[] {
  const representedTypes = new Set(sources.flatMap(({ evidence_types: evidenceTypes }) => evidenceTypes));
  return EVIDENCE_TYPES.filter((evidenceType) => representedTypes.has(evidenceType));
}

function projectEntry(resolved: ResolvedPublicEntry): ExportEntryV1 {
  const { entry, snapshot, activity } = resolved;
  const sources = [...entry.sources].sort(compareSourceTitles).map(projectSource);
  const secondaryTopicTrails = [...resolved.secondary_topic_trails]
    .sort((left, right) => lexicalCompare(left.slug, right.slug))
    .map(projectTopicTrail);

  return {
    id: entry.id,
    slug: entry.slug,
    canonical_url: resolved.canonical_url,
    revision_id: snapshot.revision_id,
    revision_number: snapshot.revision_number,
    revision_published_at: snapshot.published_at,
    latest_update_summary: snapshot.update_summary,
    title: entry.title,
    claim: entry.claim,
    claim_status: entry.claim_status,
    evidence_strength: entry.evidence_strength,
    evidence_strength_score: EVIDENCE_STRENGTH_SCORES[entry.evidence_strength],
    review_status: entry.review_status,
    review_reason: entry.review_reason,
    entry_state: "main_entry",
    domains: sortControlledValues(entry.domains, DOMAINS) as Domain[],
    primary_topic_trail: projectTopicTrail(resolved.primary_topic_trail),
    secondary_topic_trails: secondaryTopicTrails,
    methodology: {
      id: resolved.methodology.id,
      version: resolved.methodology.public_version,
      canonical_url: resolved.methodology.canonical_url,
    },
    dates: {
      date_happened: entry.date_happened,
      date_disclosed: entry.date_disclosed,
      date_added: activity.date_added,
      date_updated: activity.date_updated,
      date_last_checked: entry.date_last_checked,
      next_check_date: entry.next_check_date,
    },
    frontier_delta: {
      previous_frontier: entry.frontier_delta.previous_frontier,
      new_claim_result: entry.frontier_delta.new_claim_result,
      delta: entry.frontier_delta.delta,
    },
    details: {
      what_happened: entry.details.what_happened,
      what_evidence_shows: entry.details.what_evidence_shows,
      context_changes_interpretation: entry.details.context_changes_interpretation,
      reader_takeaway: entry.details.reader_takeaway,
    },
    confirmed_significance: entry.confirmed_significance,
    potential_significance_if_confirmed: entry.potential_significance_if_confirmed,
    caveats: [...entry.caveats],
    evidence_types: deriveEvidenceTypes(sources),
    sources,
  };
}

function validateReleaseInput(release: ReleaseModel): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  if (!release || release.mode !== "production") {
    return [
      datasetDiagnostic(
        "validated_production_release_required",
        ["release", "mode"],
        "Dataset generation requires a complete validated production release model.",
        release && typeof release === "object" ? Reflect.get(release, "mode") : release,
      ),
    ];
  }

  const metadataResult = releaseMetadataSchema.safeParse(release.release_metadata);
  if (!metadataResult.success) {
    diagnostics.push(
      datasetDiagnostic(
        "valid_release_metadata_required",
        ["release", "release_metadata"],
        "Dataset generation requires validated persisted release metadata.",
        release.release_metadata,
      ),
    );
    return diagnostics;
  }

  const originResult = validateSiteOrigin(release.site_origin, "production");
  if (!originResult.success) diagnostics.push(...originResult.diagnostics);

  const expectedArtifactPath = `/datasets/releases/${metadataResult.data.release_id}/${DATASET_ARTIFACT_FILENAME}`;
  if (release.routes.dataset_artifact !== expectedArtifactPath) {
    diagnostics.push(
      datasetDiagnostic(
        "dataset_artifact_path_mismatch",
        ["release", "routes", "dataset_artifact"],
        "The immutable dataset artifact path must match the validated release ID.",
        release.routes.dataset_artifact,
      ),
    );
  }
  if (release.routes.dataset_schema !== DATASET_SCHEMA_PUBLIC_PATH) {
    diagnostics.push(
      datasetDiagnostic(
        "dataset_schema_path_mismatch",
        ["release", "routes", "dataset_schema"],
        "The release route registry must use the immutable Dataset 1.0.0 Schema path.",
        release.routes.dataset_schema,
      ),
    );
  }
  if (release.routes.dataset_latest !== DATASET_LATEST_PUBLIC_PATH) {
    diagnostics.push(
      datasetDiagnostic(
        "latest_dataset_path_mismatch",
        ["release", "routes", "dataset_latest"],
        "The release route registry must use the Dataset 1.0.0 stable-latest path.",
        release.routes.dataset_latest,
      ),
    );
  }
  if (!Array.isArray(release.current_entries) || release.current_entries.length === 0) {
    diagnostics.push(
      datasetDiagnostic(
        "public_entry_required",
        ["release", "current_entries"],
        "A dataset release must contain at least one current public Entry.",
        release.current_entries,
      ),
    );
    return diagnostics;
  }

  const entryIds = new Set<string>();
  const entrySlugs = new Set<string>();
  for (const [index, resolved] of release.current_entries.entries()) {
    if (resolved.entry.entry_state !== "main_entry") {
      diagnostics.push(
        datasetDiagnostic(
          "non_public_entry_in_dataset",
          ["release", "current_entries", index, "entry", "entry_state"],
          "Only current public main Entries may be exported.",
          resolved.entry.entry_state,
        ),
      );
    }
    if (entryIds.has(resolved.entry.id) || entrySlugs.has(resolved.entry.slug)) {
      diagnostics.push(
        datasetDiagnostic(
          "duplicate_public_entry",
          ["release", "current_entries", index],
          "Every current public Entry must appear exactly once in the release model.",
          resolved.entry.id,
        ),
      );
    }
    entryIds.add(resolved.entry.id);
    entrySlugs.add(resolved.entry.slug);
    const entryPath = release.routes.entries[resolved.entry.id];
    if (entryPath === undefined) {
      diagnostics.push(
        datasetDiagnostic(
          "unresolved_entry_route",
          ["release", "current_entries", index, "canonical_url"],
          "Every exported Entry must resolve through the release route registry.",
          resolved.entry.id,
        ),
      );
    } else if (resolved.canonical_url !== toCanonicalUrl(release.site_origin, entryPath)) {
      diagnostics.push(
        datasetDiagnostic(
          "entry_canonical_url_mismatch",
          ["release", "current_entries", index, "canonical_url"],
          "Every exported Entry canonical URL must match the release route registry.",
          resolved.canonical_url,
        ),
      );
    }
    if (resolved.methodology.public_version !== "1.0.0") {
      diagnostics.push(
        datasetDiagnostic(
          "unsupported_methodology_version",
          ["release", "current_entries", index, "methodology", "public_version"],
          "Dataset 1.0.0 exports Stage 1 Methodology version 1.0.0 only.",
          resolved.methodology.public_version,
        ),
      );
    }
    if (
      resolved.methodology.canonical_url !==
      toCanonicalUrl(release.site_origin, release.routes.methodology_version)
    ) {
      diagnostics.push(
        datasetDiagnostic(
          "methodology_canonical_url_mismatch",
          ["release", "current_entries", index, "methodology", "canonical_url"],
          "The exported Methodology URL must match the versioned Methodology route.",
          resolved.methodology.canonical_url,
        ),
      );
    }
    const topicTrailReferences = [resolved.primary_topic_trail, ...resolved.secondary_topic_trails];
    for (const [trailIndex, reference] of topicTrailReferences.entries()) {
      const trailPath = release.routes.topic_trails[reference.id];
      if (!trailPath || reference.canonical_url !== toCanonicalUrl(release.site_origin, trailPath)) {
        diagnostics.push(
          datasetDiagnostic(
            "topic_trail_canonical_url_mismatch",
            ["release", "current_entries", index, "topic_trails", trailIndex, "canonical_url"],
            "Every exported Topic Trail URL must match the release route registry.",
            reference.canonical_url,
          ),
        );
      }
    }
  }
  return diagnostics;
}

function schemaValidationDiagnostics(errors: ErrorObject[] | null | undefined): ValidationDiagnostic[] {
  return (errors ?? []).map((error) =>
    datasetDiagnostic(
      "dataset_schema_validation_failed",
      error.instancePath.split("/").filter(Boolean),
      `Generated dataset failed JSON Schema validation: ${error.message ?? error.keyword}.`,
      error.data,
    ),
  );
}

export function generateVyDexDatasetV1(input: {
  release: ReleaseModel;
}): ValidationResult<GeneratedDatasetArtifactV1> {
  const releaseDiagnostics = validateReleaseInput(input.release);
  if (releaseDiagnostics.length > 0) return { success: false, diagnostics: releaseDiagnostics };

  const release = input.release;
  const schemaResult = generateVyDexDatasetSchemaV1({ site_origin: release.site_origin });
  if (!schemaResult.success) return schemaResult;
  const schemaUrl = schemaResult.data.schema.$id;
  if (typeof schemaUrl !== "string") {
    return {
      success: false,
      diagnostics: [
        datasetDiagnostic(
          "dataset_schema_id_required",
          ["schema", "$id"],
          "Dataset Schema generation must produce an absolute canonical $id.",
          schemaUrl,
        ),
      ],
    };
  }

  const expectedSchemaUrl = toCanonicalUrl(release.site_origin, release.routes.dataset_schema);
  if (schemaUrl !== expectedSchemaUrl) {
    return {
      success: false,
      diagnostics: [
        datasetDiagnostic(
          "dataset_schema_url_mismatch",
          ["$schema"],
          "The dataset $schema must equal the Schema canonical $id from the release route registry.",
          schemaUrl,
        ),
      ],
    };
  }

  const entries = [...release.current_entries]
    .sort((left, right) => lexicalCompare(left.entry.slug, right.entry.slug))
    .map(projectEntry);
  const methodologyVersions = [...new Set(entries.map(({ methodology }) => methodology.version))].sort(
    (left, right) => left.localeCompare(right, "en", { numeric: true }),
  );
  const dataset: VyDexDatasetV1 = {
    $schema: expectedSchemaUrl,
    dataset_name: "VyDex",
    dataset_schema_version: "1.0.0",
    release_id: release.release_metadata.release_id,
    generated_at: release.release_metadata.generated_at,
    scope: "latest_entry_versions",
    entry_count: entries.length,
    methodology_versions: methodologyVersions,
    entries,
  };
  const serializedJson = serializeJsonDocument(dataset);
  const parsedDataset: unknown = JSON.parse(serializedJson);

  try {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(schemaResult.data.schema);
    if (!validate(parsedDataset)) {
      return { success: false, diagnostics: schemaValidationDiagnostics(validate.errors) };
    }
  } catch (error) {
    return {
      success: false,
      diagnostics: [
        datasetDiagnostic(
          "dataset_schema_compilation_failed",
          ["schema"],
          "The immutable Dataset 1.0.0 Schema must compile in strict draft-2020-12 mode.",
          error instanceof Error ? error.message : error,
        ),
      ],
    };
  }

  const publicPath = release.routes.dataset_artifact!;
  const latestDatasetRedirect: LatestDatasetRedirect = {
    source: DATASET_LATEST_PUBLIC_PATH,
    destination: publicPath,
    status: 302,
    kind: "latest_dataset",
  };
  if (latestDatasetRedirect.destination !== publicPath) {
    return {
      success: false,
      diagnostics: [
        datasetDiagnostic(
          "latest_dataset_redirect_mismatch",
          ["latest_dataset_redirect", "destination"],
          "The stable-latest descriptor must target this release's immutable dataset artifact.",
          latestDatasetRedirect.destination,
        ),
      ],
    };
  }

  return {
    success: true,
    data: {
      dataset,
      serialized_json: serializedJson,
      public_path: publicPath as PublicPath,
      schema_public_path: DATASET_SCHEMA_PUBLIC_PATH,
      latest_dataset_redirect: latestDatasetRedirect,
    },
    diagnostics: [],
  };
}
