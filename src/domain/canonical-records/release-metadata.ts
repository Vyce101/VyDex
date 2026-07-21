// Defines the minimal persisted release descriptor contract.
import { z } from "zod";
import { rfc3339UtcTimestampSchema, uuidV7Schema } from "./primitives";

export const releaseMetadataSchema = z.strictObject({
  release_id: uuidV7Schema,
  generated_at: rfc3339UtcTimestampSchema,
});
export type ReleaseMetadata = z.infer<typeof releaseMetadataSchema>;
