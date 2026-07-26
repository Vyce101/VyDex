// Defines versioned immutable release-history and archived-route contracts.
import { z } from "zod";
import { rfc3339UtcTimestampSchema, uuidV7Schema } from "../canonical-records";

const repositoryPathSchema = z.string().min(1).refine(
  (value) => !value.startsWith("/") && !value.includes("\\") && !value.split("/").includes(".."),
  { error: "Must be a normalized repository-relative path." },
);
const publicPathSchema = z.string().startsWith("/");
export const gitCommitSchema = z.string().regex(
  /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/,
  "Must be a full lowercase Git commit object ID.",
);

export const releaseHistoryRecordSchema = z.strictObject({
  release_id: uuidV7Schema,
  generated_at: rfc3339UtcTimestampSchema,
  source_commit: gitCommitSchema,
  descriptor_path: repositoryPathSchema,
  manifest_path: repositoryPathSchema,
  dataset_public_path: publicPathSchema.endsWith(".json"),
  previous_release_id: uuidV7Schema.nullable(),
});
export type ReleaseHistoryRecord = z.infer<typeof releaseHistoryRecordSchema>;

export const releaseHistorySchema = z
  .strictObject({
    history_version: z.literal("1.0.0"),
    releases: z.array(releaseHistoryRecordSchema).min(1),
  })
  .superRefine((history, context) => {
    const ids = new Set<string>();
    history.releases.forEach((release, index) => {
      if (ids.has(release.release_id)) {
        context.addIssue({ code: "custom", path: ["releases", index, "release_id"], message: "Release IDs must be unique." });
      }
      ids.add(release.release_id);
      if (index === 0 && release.previous_release_id !== null) {
        context.addIssue({ code: "custom", path: ["releases", index, "previous_release_id"], message: "The first release must not have a predecessor." });
      }
      if (index > 0) {
        const previous = history.releases[index - 1]!;
        if (release.previous_release_id !== previous.release_id) {
          context.addIssue({ code: "custom", path: ["releases", index, "previous_release_id"], message: "Each release must point to the immediately preceding release." });
        }
        if (Date.parse(release.generated_at) <= Date.parse(previous.generated_at)) {
          context.addIssue({ code: "custom", path: ["releases", index, "generated_at"], message: "Release timestamps must increase strictly." });
        }
      }
    });
  });
export type ReleaseHistory = z.infer<typeof releaseHistorySchema>;

export const immutablePublicRouteSchema = z.strictObject({
  public_path: publicPathSchema,
  archive_path: repositoryPathSchema,
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  content_type: z.string().min(1),
  cache_control: z.string().min(1),
  content_disposition: z.string().min(1).optional(),
});

export const immutablePublicContractSchema = z.strictObject({
  contract_version: z.literal("1.0.0"),
  release_id: uuidV7Schema,
  routes: z.array(immutablePublicRouteSchema).min(1),
});
export type ImmutablePublicContract = z.infer<typeof immutablePublicContractSchema>;

export function serializeReleaseHistory(history: ReleaseHistory): string {
  return `${JSON.stringify(releaseHistorySchema.parse(history), null, 2)}\n`;
}

export function serializeImmutablePublicContract(contract: ImmutablePublicContract): string {
  return `${JSON.stringify(immutablePublicContractSchema.parse(contract), null, 2)}\n`;
}
