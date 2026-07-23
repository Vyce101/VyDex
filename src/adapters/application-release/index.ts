// Loads repository records and constructs one application release from explicit metadata and configuration.
import type { ReleaseMetadata } from "../../domain/canonical-records";
import {
  constructReleaseModel,
  type ConstructReleaseModelResult,
} from "../../domain/release-construction";
import { loadCanonicalRecords } from "../canonical-record-loader";

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
  const configuredOrigin = input.site_origin ?? import.meta.env.PUBLIC_SITE_ORIGIN;
  const siteOrigin = configuredOrigin ?? (input.mode === "preview" ? "http://localhost:4321" : undefined);
  return constructReleaseModel({
    records,
    release_metadata: input.release_metadata,
    site_origin: siteOrigin,
    mode: input.mode,
  });
}
