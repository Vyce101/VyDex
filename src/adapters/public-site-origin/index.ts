// Validates the externally configured canonical production origin.
import { validateSiteOrigin, type SiteOrigin } from "../../domain";

export function parseRequiredPublicSiteOrigin(value: unknown): SiteOrigin {
  const result = validateSiteOrigin(value, "production");
  if (result.success) return result.data;

  const codes = result.diagnostics.map(({ code }) => code).join(", ");
  throw new Error(
    `PUBLIC_SITE_ORIGIN is required and must be a root-only absolute HTTPS origin (${codes}).`,
  );
}
