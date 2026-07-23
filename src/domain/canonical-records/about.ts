// Defines the singleton Stage 1 About content contract.
import { z } from "zod";
import { methodologyMarkdownSchema, plainTextSchema } from "./markdown";
import { httpsUrlSchema } from "./primitives";

export const aboutRelatedLinkContentSchema = z.strictObject({
  title: plainTextSchema,
  description: plainTextSchema,
});
export type AboutRelatedLinkContent = z.infer<typeof aboutRelatedLinkContentSchema>;

export const aboutMaintainerSchema = z.strictObject({
  name: plainTextSchema,
  public_alias: plainTextSchema,
  descriptor: plainTextSchema,
  linkedin_url: httpsUrlSchema,
  github_url: httpsUrlSchema,
});
export type AboutMaintainer = z.infer<typeof aboutMaintainerSchema>;

export const aboutRecordSchema = z.strictObject({
  header_lead: methodologyMarkdownSchema,
  positioning: plainTextSchema,
  maintainer_line: methodologyMarkdownSchema,
  maintainer: aboutMaintainerSchema,
  what_vydex_is: z.tuple([methodologyMarkdownSchema, methodologyMarkdownSchema]).readonly(),
  why_vydex_exists: z
    .tuple([methodologyMarkdownSchema, methodologyMarkdownSchema, methodologyMarkdownSchema])
    .readonly(),
  who_runs_vydex: z.tuple([methodologyMarkdownSchema, methodologyMarkdownSchema]).readonly(),
  scope_limits: z.strictObject({
    introduction: methodologyMarkdownSchema,
    curated_not_exhaustive: methodologyMarkdownSchema,
    english_language_bias: methodologyMarkdownSchema,
    verification_varies_by_domain: methodologyMarkdownSchema,
    ai_heavy_coverage: methodologyMarkdownSchema,
    evidence_can_change: methodologyMarkdownSchema,
    coverage_baseline: z
      .tuple([methodologyMarkdownSchema, methodologyMarkdownSchema, methodologyMarkdownSchema])
      .readonly(),
  }),
  how_vydex_stays_careful: z.strictObject({
    methodology: methodologyMarkdownSchema,
    sources: methodologyMarkdownSchema,
    updates: methodologyMarkdownSchema,
  }),
  related_links: z.strictObject({
    methodology: aboutRelatedLinkContentSchema,
    changelog: aboutRelatedLinkContentSchema,
    export_json: aboutRelatedLinkContentSchema,
  }),
});
export type AboutRecord = z.infer<typeof aboutRecordSchema>;
export type AboutProse = z.infer<typeof methodologyMarkdownSchema>;
