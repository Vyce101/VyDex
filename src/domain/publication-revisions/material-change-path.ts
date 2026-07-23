// Defines stable maintainer-declared Entry material-change paths.
import { z } from "zod";
import { slugSchema } from "../canonical-records";

const ENTRY_MATERIAL_CHANGE_PATHS = [
  "slug",
  "aliases",
  "title",
  "claim",
  "claim_status",
  "evidence_strength",
  "review_status",
  "review_reason",
  "entry_state",
  "domains",
  "primary_topic_trail_id",
  "secondary_topic_trail_ids",
  "methodology_id",
  "date_happened",
  "date_disclosed",
  "date_last_checked",
  "next_check_date",
  "frontier_delta",
  "frontier_delta.previous_frontier",
  "frontier_delta.new_claim_result",
  "frontier_delta.delta",
  "details",
  "details.what_happened",
  "details.what_evidence_shows",
  "details.context_changes_interpretation",
  "details.reader_takeaway",
  "confirmed_significance",
  "potential_significance_if_confirmed",
  "caveats",
] as const;

type FixedEntryMaterialChangePath = (typeof ENTRY_MATERIAL_CHANGE_PATHS)[number];
export type EntryMaterialChangePath = FixedEntryMaterialChangePath | `sources[${string}]`;

const fixedPaths = new Set<string>(ENTRY_MATERIAL_CHANGE_PATHS);
const sourceSelectorPattern = /^sources\[([^\]]+)\]$/;

export function getSourceCitationIdFromMaterialPath(path: EntryMaterialChangePath): string | undefined {
  return sourceSelectorPattern.exec(path)?.[1];
}

export const entryMaterialChangePathSchema = z
  .string()
  .superRefine((value, context) => {
    if (fixedPaths.has(value)) return;

    const match = sourceSelectorPattern.exec(value);
    if (!match) {
      context.addIssue({
        code: "custom",
        message: "Must be a supported Entry field path or citation-addressed source path.",
        params: { diagnosticCode: "invalid_material_change_path" },
      });
      return;
    }

    const citationId = match[1]!;
    if (/^\d+$/.test(citationId) || !slugSchema.safeParse(citationId).success) {
      context.addIssue({
        code: "custom",
        message: "Source selectors must contain a non-numeric canonical citation ID.",
        params: { diagnosticCode: "invalid_material_change_path" },
      });
    }
  })
  .transform((value) => value as EntryMaterialChangePath);
