// Verifies required production-origin parsing without a hostname fallback.
import { describe, expect, test } from "vitest";
import { parseRequiredPublicSiteOrigin } from "../../src/adapters/public-site-origin";

describe("public site origin adapter", () => {
  test("accepts and normalizes an assigned Pages hostname", () => {
    expect(parseRequiredPublicSiteOrigin(" https://vydex-4f2.pages.dev/ ")).toBe(
      "https://vydex-4f2.pages.dev",
    );
  });

  test.each([
    undefined,
    "",
    "http://vydex.pages.dev",
    "https://vydex.pages.dev/path",
    "https://user:vydex@vydex.pages.dev",
  ])("rejects a missing or non-origin production value", (value) => {
    expect(() => parseRequiredPublicSiteOrigin(value)).toThrow("PUBLIC_SITE_ORIGIN is required");
  });
});
