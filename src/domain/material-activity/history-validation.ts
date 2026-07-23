// Validates intrinsic Entry revision sequence, chronology, and stored materiality rules.
import {
  entryPublicationSnapshotSchema,
  type Entry,
  type EntryPublicationSnapshot,
} from "../canonical-records";
import {
  createSchemaDiagnostics,
  type ValidationDiagnostic,
  type ValidationResult,
} from "../cross-record-validation";
import type { ReadonlyEntryPublicationSnapshot } from "./types";

const AUTOMATICALLY_MATERIAL_FIELDS = [
  "claim_status",
  "evidence_strength",
  "entry_state",
  "confirmed_significance",
  "potential_significance_if_confirmed",
] as const satisfies readonly (keyof Entry)[];

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => valuesEqual(value, right[index]))
    );
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => Object.hasOwn(rightRecord, key) && valuesEqual(leftRecord[key], rightRecord[key]))
  );
}

function compareUtcTimestamps(left: string, right: string): number {
  const timestampPattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z$/;
  const leftMatch = timestampPattern.exec(left)!;
  const rightMatch = timestampPattern.exec(right)!;
  const leftSeconds = Date.parse(`${leftMatch[1]}Z`);
  const rightSeconds = Date.parse(`${rightMatch[1]}Z`);
  if (leftSeconds !== rightSeconds) return Math.sign(leftSeconds - rightSeconds);

  const precision = Math.max(leftMatch[2]?.length ?? 0, rightMatch[2]?.length ?? 0);
  const leftFraction = (leftMatch[2] ?? "").padEnd(precision, "0");
  const rightFraction = (rightMatch[2] ?? "").padEnd(precision, "0");
  return leftFraction === rightFraction ? 0 : leftFraction < rightFraction ? -1 : 1;
}

function createHistoryDiagnostic(
  code: string,
  path: PropertyKey[],
  rule: string,
  invalidValue?: unknown,
  recordId?: string,
): ValidationDiagnostic {
  return {
    severity: "error",
    code,
    record_type: "entry_revision_history",
    ...(recordId ? { record_id: recordId } : {}),
    path,
    ...(invalidValue !== undefined ? { invalid_value: invalidValue } : {}),
    rule,
  };
}

function hasAutomaticallyMaterialChange(previous: Entry, current: Entry): boolean {
  return AUTOMATICALLY_MATERIAL_FIELDS.some((field) => !valuesEqual(previous[field], current[field]));
}

function validateFirstRevision(snapshot: EntryPublicationSnapshot, diagnostics: ValidationDiagnostic[]): void {
  if (snapshot.revision_category !== "initial_publication") {
    diagnostics.push(
      createHistoryDiagnostic(
        "invalid_initial_revision_category",
        ["revision_category"],
        "Revision 1 must use the initial_publication category.",
        snapshot.revision_category,
        snapshot.revision_id,
      ),
    );
  }
  if (snapshot.materiality !== "material") {
    diagnostics.push(
      createHistoryDiagnostic(
        "revision_materiality_mismatch",
        ["materiality"],
        "Revision 1 must be material.",
        snapshot.materiality,
        snapshot.revision_id,
      ),
    );
  }
}

function validateLaterRevision(
  previous: EntryPublicationSnapshot,
  snapshot: EntryPublicationSnapshot,
  diagnostics: ValidationDiagnostic[],
): void {
  if (snapshot.revision_category === "initial_publication") {
    diagnostics.push(
      createHistoryDiagnostic(
        "initial_publication_after_revision_one",
        ["revision_category"],
        "initial_publication is valid only for revision 1.",
        snapshot.revision_category,
        snapshot.revision_id,
      ),
    );
  }

  const expectedMateriality =
    snapshot.revision_category === "material_update" || snapshot.revision_category === "removal"
      ? "material"
      : snapshot.revision_category === "non_material_correction" || snapshot.revision_category === "review_check"
        ? "non_material"
        : undefined;
  if (expectedMateriality && snapshot.materiality !== expectedMateriality) {
    diagnostics.push(
      createHistoryDiagnostic(
        "revision_materiality_mismatch",
        ["materiality"],
        `${snapshot.revision_category} must be ${expectedMateriality}.`,
        snapshot.materiality,
        snapshot.revision_id,
      ),
    );
  }

  if (valuesEqual(previous.entry, snapshot.entry)) {
    diagnostics.push(
      createHistoryDiagnostic(
        "no_public_change",
        ["entry"],
        "Every revision after initial publication must change the complete public Entry state.",
        undefined,
        snapshot.revision_id,
      ),
    );
  }

  if (snapshot.materiality === "non_material" && hasAutomaticallyMaterialChange(previous.entry, snapshot.entry)) {
    diagnostics.push(
      createHistoryDiagnostic(
        "automatically_material_change_marked_non_material",
        ["materiality"],
        "A revision changing an automatically material Entry field must be material.",
        snapshot.materiality,
        snapshot.revision_id,
      ),
    );
  }

  if (
    snapshot.revision_category === "review_check" &&
    previous.entry.date_last_checked === snapshot.entry.date_last_checked
  ) {
    diagnostics.push(
      createHistoryDiagnostic(
        "review_check_requires_date_last_checked_change",
        ["entry", "date_last_checked"],
        "A review_check must update date_last_checked.",
        snapshot.entry.date_last_checked,
        snapshot.revision_id,
      ),
    );
  }
}

export function validateEntryRevisionHistory(
  snapshots: readonly ReadonlyEntryPublicationSnapshot[],
): ValidationResult<EntryPublicationSnapshot[]> {
  if (snapshots.length === 0) {
    return {
      success: false,
      diagnostics: [
        createHistoryDiagnostic(
          "empty_revision_history",
          [],
          "Entry revision activity requires at least one published snapshot.",
        ),
      ],
    };
  }

  const diagnostics: ValidationDiagnostic[] = [];
  const parsedSnapshots = snapshots.flatMap((snapshot) => {
    const result = entryPublicationSnapshotSchema.safeParse(snapshot);
    if (!result.success) {
      diagnostics.push(
        ...createSchemaDiagnostics(
          result.error,
          { value: snapshot },
          "entry_publication_snapshot",
          "revision_id",
        ),
      );
      return [];
    }
    return [result.data];
  });
  if (diagnostics.length > 0) return { success: false, diagnostics };

  const revisionIds = new Map<string, number>();
  const revisionNumbers = new Map<number, string>();
  for (const snapshot of parsedSnapshots) {
    const duplicateIdRevision = revisionIds.get(snapshot.revision_id);
    if (duplicateIdRevision !== undefined) {
      diagnostics.push(
        createHistoryDiagnostic(
          "duplicate_revision_id",
          ["revision_id"],
          "Revision IDs must be unique within an Entry history.",
          snapshot.revision_id,
          snapshot.revision_id,
        ),
      );
    } else {
      revisionIds.set(snapshot.revision_id, snapshot.revision_number);
    }

    const duplicateNumberId = revisionNumbers.get(snapshot.revision_number);
    if (duplicateNumberId !== undefined) {
      diagnostics.push(
        createHistoryDiagnostic(
          "duplicate_revision_number",
          ["revision_number"],
          "Revision numbers must be unique within an Entry history.",
          snapshot.revision_number,
          snapshot.revision_id,
        ),
      );
    } else {
      revisionNumbers.set(snapshot.revision_number, snapshot.revision_id);
    }
  }
  if (diagnostics.length > 0) return { success: false, diagnostics };

  const ordered = [...parsedSnapshots].sort((left, right) => left.revision_number - right.revision_number);
  const entryId = ordered[0]!.entry_id;
  for (const [index, snapshot] of ordered.entries()) {
    const expectedNumber = index + 1;
    if (snapshot.entry_id !== entryId) {
      diagnostics.push(
        createHistoryDiagnostic(
          "history_entry_id_mismatch",
          ["entry_id"],
          "Every snapshot in one revision history must belong to the same Entry.",
          snapshot.entry_id,
          snapshot.revision_id,
        ),
      );
    }
    if (snapshot.revision_number !== expectedNumber) {
      diagnostics.push(
        createHistoryDiagnostic(
          index === 0 ? "revision_sequence_must_start_at_one" : "non_contiguous_revision_numbers",
          ["revision_number"],
          `Expected revision number ${expectedNumber}.`,
          snapshot.revision_number,
          snapshot.revision_id,
        ),
      );
    }

    if (index === 0) {
      validateFirstRevision(snapshot, diagnostics);
      continue;
    }

    const previous = ordered[index - 1]!;
    if (compareUtcTimestamps(previous.published_at, snapshot.published_at) >= 0) {
      diagnostics.push(
        createHistoryDiagnostic(
          "revision_timestamp_order_conflict",
          ["published_at"],
          "Publication timestamps must increase strictly with revision number.",
          snapshot.published_at,
          snapshot.revision_id,
        ),
      );
    }
    validateLaterRevision(previous, snapshot, diagnostics);
  }

  const current = ordered.at(-1)!;
  const historicalSlugs = new Set(ordered.slice(0, -1).map((snapshot) => snapshot.entry.slug));
  for (const historicalSlug of historicalSlugs) {
    if (historicalSlug === current.entry.slug || current.entry.aliases.includes(historicalSlug)) continue;
    diagnostics.push(
      createHistoryDiagnostic(
        "historical_slug_alias_missing",
        ["entry", "aliases"],
        "The current published Entry must retain every previous published slug as a direct alias.",
        historicalSlug,
        current.revision_id,
      ),
    );
  }

  return diagnostics.length > 0 ? { success: false, diagnostics } : { success: true, data: ordered, diagnostics: [] };
}
