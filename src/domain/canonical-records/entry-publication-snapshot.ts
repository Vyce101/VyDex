// Defines the durable Entry publication snapshot storage contract without creation behavior.
import { z } from "zod";
import { entryRevisionCategorySchema, materialitySchema } from "./controlled-values";
import { entrySchema } from "./entry";
import { plainTextSchema } from "./markdown";
import { methodologyVersionSchema, rfc3339UtcTimestampSchema, uuidV7Schema } from "./primitives";

export const entryPublicationSnapshotSchema = z
  .strictObject({
    revision_id: uuidV7Schema,
    entry_id: uuidV7Schema,
    revision_number: z.number().int().positive({ error: "Revision number must be a positive integer." }),
    published_at: rfc3339UtcTimestampSchema,
    methodology_id: uuidV7Schema,
    methodology_public_version: methodologyVersionSchema,
    revision_category: entryRevisionCategorySchema,
    materiality: materialitySchema,
    update_summary: plainTextSchema,
    entry: entrySchema,
  })
  .superRefine((snapshot, context) => {
    if (snapshot.entry_id !== snapshot.entry.id) {
      context.addIssue({
        code: "custom",
        path: ["entry_id"],
        message: "Snapshot entry_id must equal the embedded Entry ID.",
        params: { diagnosticCode: "snapshot_entry_id_mismatch" },
      });
    }
    if (snapshot.methodology_id !== snapshot.entry.methodology_id) {
      context.addIssue({
        code: "custom",
        path: ["methodology_id"],
        message: "Snapshot methodology_id must equal the embedded Entry methodology ID.",
        params: { diagnosticCode: "snapshot_methodology_id_mismatch" },
      });
    }
  });
export type EntryPublicationSnapshot = z.infer<typeof entryPublicationSnapshotSchema>;
