// Validates loaded records, singleton inputs, Stage 1 references, and complete Entry histories.
import type {
  AboutRecord,
  Entry,
  EntryPublicationSnapshot,
  Methodology,
  MethodologyPublicationEvent,
  ReleaseMetadata,
  TopicTrail,
} from "../canonical-records";
import {
  validateAboutRecord,
  validateCanonicalRecordSet,
  validateEntryPublicationSnapshotRecord,
  validateEntryRecord,
  validateMethodologyPublicationEventRecord,
  validateMethodologyRecord,
  validateReleaseMetadataRecord,
  validateTopicTrailRecord,
  type ValidationDiagnostic,
  type ValidationResult,
} from "../cross-record-validation";
import { deriveEntryRevisionActivity, type DerivedEntryRevisionActivity } from "../material-activity";
import { validateSiteOrigin } from "../route-generation";
import { createReleaseDiagnostic } from "./release-diagnostics";
import type { CanonicalRecordSource, ConstructReleaseModelInput } from "./types";

export type ValidatedLocated<T> = { data: T; source: CanonicalRecordSource };

export type ValidatedInputs = {
  entries: ValidatedLocated<Entry>[];
  topicTrails: ValidatedLocated<TopicTrail>[];
  methodologies: ValidatedLocated<Methodology>[];
  about: ValidatedLocated<AboutRecord>[];
  methodologyEvents: ValidatedLocated<MethodologyPublicationEvent>[];
  snapshots: ValidatedLocated<EntryPublicationSnapshot>[];
};

export type ValidatedHistory = {
  snapshots: EntryPublicationSnapshot[];
  activity: DerivedEntryRevisionActivity;
};

export type ReleaseInputValidationState = {
  parsed: ValidatedInputs;
  releaseMetadata?: ReleaseMetadata;
  originResult: ReturnType<typeof validateSiteOrigin>;
  methodology?: Methodology;
  methodologyEvent?: MethodologyPublicationEvent;
  about?: AboutRecord;
  histories: Map<string, ValidatedHistory>;
  coreRecordsValid: boolean;
};

function parseSources<T>(
  sources: readonly CanonicalRecordSource[],
  validator: (input: { value: unknown; filename?: string }) => ValidationResult<T>,
  diagnostics: ValidationDiagnostic[],
): ValidatedLocated<T>[] {
  return sources.flatMap((source) => {
    const result = validator({ value: source.value, filename: source.filename });
    if (!result.success) {
      diagnostics.push(...result.diagnostics);
      return [];
    }
    return [{ data: result.data, source }];
  });
}

function parseInputs(input: ConstructReleaseModelInput, diagnostics: ValidationDiagnostic[]): ValidatedInputs {
  return {
    entries: parseSources(input.records.entries, validateEntryRecord, diagnostics),
    topicTrails: parseSources(input.records.topic_trails, validateTopicTrailRecord, diagnostics),
    methodologies: parseSources(input.records.methodologies, validateMethodologyRecord, diagnostics),
    about: parseSources(input.records.about, validateAboutRecord, diagnostics),
    methodologyEvents: parseSources(
      input.records.methodology_publication_events,
      validateMethodologyPublicationEventRecord,
      diagnostics,
    ),
    snapshots: parseSources(
      input.records.entry_publication_snapshots,
      validateEntryPublicationSnapshotRecord,
      diagnostics,
    ),
  };
}

function validateSingletons(
  input: ConstructReleaseModelInput,
  parsed: ValidatedInputs,
  diagnostics: ValidationDiagnostic[],
): { about?: AboutRecord; methodologyEvent?: MethodologyPublicationEvent; methodology?: Methodology } {
  const hasLoaderDiagnostic = (recordType: string) =>
    input.records.diagnostics.some(
      (diagnostic) => diagnostic.severity === "error" && diagnostic.record_type === recordType,
    );
  if (input.records.about.length === 0) {
    diagnostics.push(
      createReleaseDiagnostic("about_required", "about", [], "Stage 1 requires one complete About record."),
    );
  } else if (input.records.about.length > 1) {
    diagnostics.push(
      createReleaseDiagnostic(
        "duplicate_about_record",
        "about",
        [],
        "Stage 1 accepts exactly one About record.",
        input.records.about.length,
      ),
    );
  }

  if (input.records.methodology_publication_events.length === 0) {
    diagnostics.push(
      createReleaseDiagnostic(
        "methodology_publication_event_required",
        "methodology_publication_event",
        [],
        "Stage 1 requires one Methodology publication event.",
      ),
    );
  } else if (input.records.methodology_publication_events.length > 1) {
    diagnostics.push(
      createReleaseDiagnostic(
        "duplicate_methodology_publication_event",
        "methodology_publication_event",
        [],
        "Stage 1 accepts exactly one Methodology publication event.",
        input.records.methodology_publication_events.length,
      ),
    );
  }

  const stageOneMethodologies = parsed.methodologies.filter(
    ({ data }) => data.public_version === "1.0.0",
  );
  if (stageOneMethodologies.length === 0) {
    diagnostics.push(
      createReleaseDiagnostic(
        "stage_1_methodology_required",
        "methodology",
        ["public_version"],
        "Stage 1 requires complete Methodology version 1.0.0.",
        "1.0.0",
      ),
    );
  } else if (stageOneMethodologies.length > 1) {
    diagnostics.push(
      createReleaseDiagnostic(
        "duplicate_methodology_version",
        "methodology",
        ["public_version"],
        "Methodology public versions must be unique.",
        "1.0.0",
      ),
    );
  }

  const methodology =
    stageOneMethodologies.length === 1 && !hasLoaderDiagnostic("methodology")
      ? stageOneMethodologies[0]!.data
      : undefined;
  const methodologyEvent = parsed.methodologyEvents.length === 1 ? parsed.methodologyEvents[0]!.data : undefined;
  if (methodology && methodologyEvent) {
    if (methodologyEvent.methodology_id !== methodology.id) {
      diagnostics.push(
        createReleaseDiagnostic(
          "methodology_event_relationship_mismatch",
          "methodology_publication_event",
          ["methodology_id"],
          "The Methodology publication event must resolve to Methodology 1.0.0.",
          methodologyEvent.methodology_id,
          methodologyEvent.methodology_id,
          methodology.id,
        ),
      );
    }
    if (methodologyEvent.date !== methodology.effective_date) {
      diagnostics.push(
        createReleaseDiagnostic(
          "methodology_event_date_mismatch",
          "methodology_publication_event",
          ["date"],
          "The Methodology publication event date must equal the referenced effective_date.",
          methodologyEvent.date,
          methodologyEvent.methodology_id,
          methodology.id,
        ),
      );
    }
  }

  return {
    ...(input.records.about.length === 1 && parsed.about.length === 1 && !hasLoaderDiagnostic("about")
      ? { about: parsed.about[0]!.data }
      : {}),
    ...(input.records.methodology_publication_events.length === 1 &&
    methodologyEvent &&
    !hasLoaderDiagnostic("methodology_publication_event")
      ? { methodologyEvent }
      : {}),
    ...(methodology ? { methodology } : {}),
  };
}

function validateReleaseMetadata(
  value: unknown,
  diagnostics: ValidationDiagnostic[],
): ReleaseMetadata | undefined {
  if (value === undefined) {
    diagnostics.push(
      createReleaseDiagnostic(
        "release_metadata_required",
        "release_metadata",
        [],
        "Valid release metadata is required for a promotable Stage 1 release.",
      ),
    );
    return undefined;
  }
  const result = validateReleaseMetadataRecord({ value });
  if (!result.success) {
    diagnostics.push(...result.diagnostics);
    return undefined;
  }
  return result.data;
}

function addAggregateDiagnostics(parsed: ValidatedInputs, diagnostics: ValidationDiagnostic[]): boolean {
  const result = validateCanonicalRecordSet(
    {
      entries: parsed.entries.map(({ data, source }) => ({ value: data, filename: source.filename })),
      topic_trails: parsed.topicTrails.map(({ data, source }) => ({ value: data, filename: source.filename })),
      methodologies: parsed.methodologies.map(({ data, source }) => ({ value: data, filename: source.filename })),
      entry_publication_snapshots: parsed.snapshots.map(({ data, source }) => ({
        value: data,
        filename: source.filename,
      })),
      release_metadata: [],
    },
    "stage_1_production",
  );
  if (result.success) return true;
  diagnostics.push(...result.diagnostics);
  return false;
}

function validateStageOneMethodologyReferences(
  parsed: ValidatedInputs,
  methodology: Methodology | undefined,
  diagnostics: ValidationDiagnostic[],
): boolean {
  if (!methodology) return false;
  let valid = true;
  const validateReference = (
    recordType: "entry" | "entry_publication_snapshot",
    recordId: string,
    methodologyId: string,
    publicVersion?: string,
    filename?: string,
  ) => {
    if (methodologyId === methodology.id && (publicVersion === undefined || publicVersion === "1.0.0")) return;
    valid = false;
    diagnostics.push({
      ...createReleaseDiagnostic(
        "stage_1_methodology_reference_required",
        recordType,
        ["methodology_id"],
        "Every Stage 1 Entry and snapshot must reference Methodology 1.0.0.",
        methodologyId,
        recordId,
        methodology.id,
      ),
      ...(filename ? { filename } : {}),
    });
  };
  parsed.entries.forEach(({ data, source }) =>
    validateReference("entry", data.id, data.methodology_id, undefined, source.filename),
  );
  parsed.snapshots.forEach(({ data, source }) =>
    validateReference(
      "entry_publication_snapshot",
      data.revision_id,
      data.methodology_id,
      data.methodology_public_version,
      source.filename,
    ),
  );
  return valid;
}

function attachHistoryFilename(
  diagnostic: ValidationDiagnostic,
  snapshots: readonly ValidatedLocated<EntryPublicationSnapshot>[],
): ValidationDiagnostic {
  if (diagnostic.filename) return diagnostic;
  const source = snapshots.find(({ data }) => data.revision_id === diagnostic.record_id)?.source;
  return source ? { ...diagnostic, filename: source.filename } : diagnostic;
}

function validateHistories(
  parsed: ValidatedInputs,
  diagnostics: ValidationDiagnostic[],
): Map<string, ValidatedHistory> {
  const entriesById = new Map(parsed.entries.map(({ data }) => [data.id, data]));
  const snapshotGroups = Map.groupBy(parsed.snapshots, ({ data }) => data.entry_id);
  const histories = new Map<string, ValidatedHistory>();

  for (const entry of entriesById.values()) {
    const snapshots = snapshotGroups.get(entry.id) ?? [];
    if (snapshots.length === 0) {
      diagnostics.push(
        createReleaseDiagnostic(
          "entry_publication_history_required",
          "entry",
          ["id"],
          "Every canonical Entry requires at least one valid publication snapshot.",
          entry.id,
          entry.id,
        ),
      );
      continue;
    }
    const result = deriveEntryRevisionActivity(snapshots.map(({ data }) => data));
    if (!result.success) {
      diagnostics.push(...result.diagnostics.map((diagnostic) => attachHistoryFilename(diagnostic, snapshots)));
      continue;
    }
    const ordered = [...snapshots.map(({ data }) => data)].sort(
      (left, right) => left.revision_number - right.revision_number,
    );
    const selected = ordered.at(-1)!;
    if (selected.entry.entry_state === "removed") {
      diagnostics.push(
        createReleaseDiagnostic(
          "selected_removed_entry_not_public",
          "entry_publication_snapshot",
          ["entry", "entry_state"],
          "Stage 1 must not select a removed Entry snapshot for public release.",
          selected.entry.entry_state,
          selected.revision_id,
        ),
      );
      continue;
    }
    histories.set(entry.id, { snapshots: ordered, activity: result.data });
  }

  for (const [entryId, snapshots] of snapshotGroups) {
    if (entriesById.has(entryId)) continue;
    diagnostics.push(
      createReleaseDiagnostic(
        "orphan_entry_snapshot_history",
        "entry_publication_snapshot",
        ["entry_id"],
        "Every snapshot history must have one matching canonical Entry.",
        entryId,
        snapshots[0]!.data.revision_id,
        entryId,
      ),
    );
  }

  if (histories.size === 0) {
    diagnostics.push(
      createReleaseDiagnostic(
        "public_entry_required",
        "release",
        ["current_entries"],
        "Stage 1 requires at least one valid public Entry.",
      ),
    );
  }
  return histories;
}

export function validateReleaseInputs(
  input: ConstructReleaseModelInput,
  diagnostics: ValidationDiagnostic[],
): ReleaseInputValidationState {
  const parsed = parseInputs(input, diagnostics);
  const coreLoaderRecordsValid = !input.records.diagnostics.some(
    (diagnostic) =>
      diagnostic.severity === "error" &&
      ["entry", "topic_trail", "methodology", "entry_publication_snapshot"].includes(
        diagnostic.record_type,
      ),
  );
  const coreLocalRecordsValid =
    coreLoaderRecordsValid &&
    parsed.entries.length === input.records.entries.length &&
    parsed.topicTrails.length === input.records.topic_trails.length &&
    parsed.methodologies.length === input.records.methodologies.length &&
    parsed.snapshots.length === input.records.entry_publication_snapshots.length;
  const singletonState = validateSingletons(input, parsed, diagnostics);
  const releaseMetadata = validateReleaseMetadata(input.release_metadata, diagnostics);
  const originResult = validateSiteOrigin(input.site_origin, input.mode);
  if (!originResult.success) diagnostics.push(...originResult.diagnostics);
  const aggregateValid = addAggregateDiagnostics(parsed, diagnostics);
  const stageOneReferencesValid = validateStageOneMethodologyReferences(
    parsed,
    singletonState.methodology,
    diagnostics,
  );
  const histories = validateHistories(parsed, diagnostics);
  const coreRecordsValid =
    coreLocalRecordsValid &&
    aggregateValid &&
    stageOneReferencesValid &&
    histories.size === parsed.entries.length &&
    parsed.entries.length > 0;
  return {
    parsed,
    ...(releaseMetadata ? { releaseMetadata } : {}),
    originResult,
    ...singletonState,
    histories,
    coreRecordsValid,
  };
}
