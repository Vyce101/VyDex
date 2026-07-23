// Defines deterministic Entry publication request and success contracts.
import { z } from "zod";
import {
  entryRevisionCategorySchema,
  materialitySchema,
  plainTextSchema,
  rfc3339UtcTimestampSchema,
  uuidV7Schema,
  type Entry,
  type EntryRevisionCategory,
  type Materiality,
  type Methodology,
  type Rfc3339UtcTimestamp,
  type UUIDv7,
} from "../canonical-records";
import type {
  DerivedEntryRevisionActivity,
  ReadonlyEntryPublicationSnapshot,
} from "../material-activity";
import { entryMaterialChangePathSchema, type EntryMaterialChangePath } from "./material-change-path";

export const publicationMetadataSchema = z.strictObject({
  revision_id: uuidV7Schema,
  published_at: rfc3339UtcTimestampSchema,
  revision_category: entryRevisionCategorySchema,
  materiality: materialitySchema,
  update_summary: plainTextSchema,
  material_change_paths: z.array(entryMaterialChangePathSchema).superRefine((paths, context) => {
    const seen = new Set<EntryMaterialChangePath>();
    paths.forEach((path, index) => {
      if (!seen.has(path)) {
        seen.add(path);
        return;
      }
      context.addIssue({
        code: "custom",
        path: [index],
        message: "Material-change paths must be unique.",
        params: { diagnosticCode: "duplicate_material_change_path" },
      });
    });
  }),
});
export type PublicationMetadata = z.infer<typeof publicationMetadataSchema>;

export type PublishEntryRevisionInput = {
  proposed_entry: Entry;
  existing_snapshots: readonly ReadonlyEntryPublicationSnapshot[];
  methodologies: readonly Methodology[];
  revision_id: UUIDv7;
  published_at: Rfc3339UtcTimestamp;
  revision_category: EntryRevisionCategory;
  materiality: Materiality;
  update_summary: string;
  material_change_paths: readonly EntryMaterialChangePath[];
};

export type PublishedEntryRevision = {
  snapshot: ReadonlyEntryPublicationSnapshot;
  activity: DerivedEntryRevisionActivity;
};
