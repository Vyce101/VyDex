// Defines the authored Topic Trail record contract.
import { z } from "zod";
import { plainTextSchema } from "./markdown";
import { slugSchema, uuidV7Schema } from "./primitives";
import { addDuplicateValueIssues } from "./unique-values";

export const topicTrailSchema = z
  .strictObject({
    id: uuidV7Schema,
    slug: slugSchema,
    aliases: z.array(slugSchema),
    name: plainTextSchema,
    description: plainTextSchema,
  })
  .superRefine((topicTrail, context) => {
    addDuplicateValueIssues(context, topicTrail.aliases, ["aliases"], "Topic Trail alias");
    topicTrail.aliases.forEach((alias, index) => {
      if (alias !== topicTrail.slug) return;
      context.addIssue({
        code: "custom",
        path: ["aliases", index],
        message: "A Topic Trail alias must not equal its current slug.",
        params: { diagnosticCode: "slug_alias_collision" },
      });
    });
  });
export type TopicTrail = z.infer<typeof topicTrailSchema>;
