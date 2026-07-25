// Loads repository records and constructs application releases from explicit descriptor sources.
import { releaseMetadataSchema, type ReleaseMetadata } from "../../domain/canonical-records";
import {
  constructReleaseModel,
  type ConstructReleaseModelResult,
  type ReleaseModel,
} from "../../domain/release-construction";
import { loadCanonicalRecords } from "../canonical-record-loader";
import { loadPersistedReleaseDescriptor } from "../persisted-release-descriptor";

export type LoadApplicationReleaseInput = {
  filesystem_root: string;
  release_metadata?: ReleaseMetadata;
  mode: "production" | "preview";
  site_origin?: string;
};

export async function loadApplicationRelease(
  input: LoadApplicationReleaseInput,
): Promise<ConstructReleaseModelResult> {
  const records = await loadCanonicalRecords({ filesystem_root: input.filesystem_root });
  const siteOrigin =
    input.site_origin ??
    (input.mode === "preview" ? "http://localhost:4321" : import.meta.env.PUBLIC_SITE_ORIGIN);
  return constructReleaseModel({
    records,
    release_metadata: input.release_metadata,
    site_origin: siteOrigin,
    mode: input.mode,
  });
}

export type LoadConfiguredApplicationReleaseInput = {
  filesystem_root: string;
  site_origin?: string;
};

const FIXED_NON_PRODUCTION_RELEASE_METADATA: ReleaseMetadata = releaseMetadataSchema.parse({
  release_id: "01900000-0000-7000-8000-000000000099",
  generated_at: "2026-07-24T20:30:00Z",
});

function requireCompleteProductionRelease(result: ConstructReleaseModelResult): ReleaseModel {
  if (result.mode === "production" && result.success) return result.release;

  const diagnosticCodes = result.mode === "production"
    ? result.diagnostics.map(({ code }) => code).join(", ")
    : "unexpected_preview_release";
  throw new Error(`Application production release construction failed: ${diagnosticCodes}.`);
}

export async function loadPersistedProductionApplicationRelease(
  input: LoadConfiguredApplicationReleaseInput,
): Promise<ReleaseModel> {
  const releaseMetadata = await loadPersistedReleaseDescriptor({
    filesystem_root: input.filesystem_root,
  });
  const result = await loadApplicationRelease({
    ...input,
    release_metadata: releaseMetadata,
    mode: "production",
  });
  return requireCompleteProductionRelease(result);
}

export async function loadFixedMetadataDevelopmentApplicationRelease(
  input: LoadConfiguredApplicationReleaseInput,
): Promise<ReleaseModel> {
  const result = await loadApplicationRelease({
    ...input,
    release_metadata: FIXED_NON_PRODUCTION_RELEASE_METADATA,
    mode: "production",
  });
  return requireCompleteProductionRelease(result);
}
