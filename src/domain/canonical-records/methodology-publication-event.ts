// Defines the singleton Stage 1 Methodology publication event contract.
import { z } from "zod";
import { publicChangelogTypeSchema } from "./controlled-values";
import { plainTextSchema } from "./markdown";
import { rfc3339UtcTimestampSchema, uuidV7Schema } from "./primitives";

export const methodologyPublicationEventSchema = z.strictObject({
  type: publicChangelogTypeSchema.extract(["methodology_change"]),
  methodology_id: uuidV7Schema,
  published_at: rfc3339UtcTimestampSchema,
  title: plainTextSchema,
  summary: plainTextSchema,
});
export type MethodologyPublicationEvent = z.infer<typeof methodologyPublicationEventSchema>;
