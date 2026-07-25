// Renders Entry Page null-value fallbacks and conditional significance markup.
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { expect, test } from "vitest";
import { constructReleaseModel } from "../../src/domain";
import EntryPage from "../../src/features/entry-page/EntryPage.astro";
import { createLoadedCanonicalRecords, createValidReleaseMetadata } from "../domain/fixtures";

test("renders unknown scheduling fallbacks and omits null Potential Significance", async () => {
  const result = constructReleaseModel({
    records: createLoadedCanonicalRecords(),
    release_metadata: createValidReleaseMetadata(),
    site_origin: "https://vydex.example",
    mode: "production",
  });
  if (!result.success || result.mode !== "production") {
    throw new Error("Entry Page component tests require a valid production fixture.");
  }
  const entry = result.release.current_entries[0]!;
  expect(entry.entry.potential_significance_if_confirmed).toBeNull();
  const container = await AstroContainer.create();
  const html = await container.renderToString(EntryPage, { props: { entry } });

  expect(html).toContain("Confirmed Significance");
  expect(html).not.toContain("Potential Significance If Confirmed");
  expect(html).toContain("Unknown");
  expect(html).toContain("None scheduled");
});
