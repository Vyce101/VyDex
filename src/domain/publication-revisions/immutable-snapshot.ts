// Detaches and recursively freezes validated Entry publication snapshots.
import type { EntryPublicationSnapshot } from "../canonical-records";
import type { ReadonlyEntryPublicationSnapshot } from "../material-activity";

function deepFreeze<T>(value: T): T {
  if ((typeof value !== "object" && typeof value !== "function") || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const nestedValue of Object.values(value)) deepFreeze(nestedValue);
  return Object.freeze(value);
}

export function freezeEntryPublicationSnapshot(
  snapshot: EntryPublicationSnapshot,
): ReadonlyEntryPublicationSnapshot {
  return deepFreeze(snapshot) as ReadonlyEntryPublicationSnapshot;
}
