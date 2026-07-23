// Compares complete Entries and validates semantic material-change declarations.
import type { Entry } from "../canonical-records";
import {
  getSourceCitationIdFromMaterialPath,
  type EntryMaterialChangePath,
} from "./material-change-path";

const AUTOMATICALLY_MATERIAL_FIELDS = [
  "claim_status",
  "evidence_strength",
  "entry_state",
  "confirmed_significance",
  "potential_significance_if_confirmed",
] as const satisfies readonly (keyof Entry)[];

export function entryValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => entryValuesEqual(value, right[index]))
    );
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) => Object.hasOwn(rightRecord, key) && entryValuesEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

export function hasAutomaticallyMaterialEntryChange(previous: Entry, proposed: Entry): boolean {
  return AUTOMATICALLY_MATERIAL_FIELDS.some(
    (field) => !entryValuesEqual(previous[field], proposed[field]),
  );
}

function getNestedEntryValue(entry: Entry, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (typeof current !== "object" || current === null) return undefined;
    return Reflect.get(current, segment);
  }, entry);
}

function getSourceByCitationId(entry: Entry, citationId: string): Entry["sources"][number] | undefined {
  return entry.sources.find((source) => source.citation_id === citationId);
}

export function hasDeclaredMaterialPathChanged(
  path: EntryMaterialChangePath,
  previous: Entry | null,
  proposed: Entry,
): boolean {
  const citationId = getSourceCitationIdFromMaterialPath(path);
  if (citationId !== undefined) {
    const previousSource = previous ? getSourceByCitationId(previous, citationId) : undefined;
    const proposedSource = getSourceByCitationId(proposed, citationId);
    if (!previous) return proposedSource !== undefined;
    return !entryValuesEqual(previousSource, proposedSource);
  }

  if (!previous) return true;
  return !entryValuesEqual(getNestedEntryValue(previous, path), getNestedEntryValue(proposed, path));
}
