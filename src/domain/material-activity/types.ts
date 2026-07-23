// Defines readonly snapshot and derived material-activity result contracts.
import type {
  CalendarDate,
  EntryPublicationSnapshot,
  EntryRevisionCategory,
  Rfc3339UtcTimestamp,
  UUIDv7,
} from "../canonical-records";

type DeepReadonly<T> = T extends string | number | boolean | bigint | symbol | null | undefined
  ? T
  : T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type ReadonlyEntryPublicationSnapshot = DeepReadonly<EntryPublicationSnapshot>;

export type LatestMeaningfulActivity = {
  revision_id: UUIDv7;
  revision_number: number;
  published_at: Rfc3339UtcTimestamp;
  revision_category: EntryRevisionCategory;
  update_summary: string;
};

export type DerivedEntryRevisionActivity = {
  date_added: CalendarDate;
  date_updated: CalendarDate;
  current_revision_id: UUIDv7;
  current_revision_number: number;
  current_update_summary: string;
  latest_meaningful_activity: LatestMeaningfulActivity;
};
