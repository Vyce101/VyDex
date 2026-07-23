// Verifies singleton About content and Methodology publication event contracts.
import { describe, expect, test } from "vitest";
import {
  aboutRecordSchema,
  methodologyPublicationEventSchema,
} from "../../src/domain/canonical-records";
import {
  createValidAboutRecord,
  createValidMethodologyPublicationEvent,
} from "./fixtures";

describe("AboutRecord", () => {
  test("accepts every required structured section and exact tuple size", () => {
    const result = aboutRecordSchema.safeParse(createValidAboutRecord());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.what_vydex_is).toHaveLength(2);
    expect(result.data.why_vydex_exists).toHaveLength(3);
    expect(result.data.scope_limits.coverage_baseline).toHaveLength(3);
  });

  test("rejects missing sections, unsafe prose, and unknown fields", () => {
    const missingSection = createValidAboutRecord();
    delete (missingSection as Partial<typeof missingSection>).who_runs_vydex;
    const unsafeProse = createValidAboutRecord();
    unsafeProse.header_lead = "# Authored heading";
    const unknownField = { ...createValidAboutRecord(), contact_email: "private@example.com" };

    expect(aboutRecordSchema.safeParse(missingSection).success).toBe(false);
    expect(aboutRecordSchema.safeParse(unsafeProse).success).toBe(false);
    expect(aboutRecordSchema.safeParse(unknownField).success).toBe(false);
  });

  test("requires HTTPS maintainer profiles and complete related-link descriptions", () => {
    const insecureProfile = createValidAboutRecord();
    insecureProfile.maintainer.github_url = "http://github.com/example-maintainer";
    const missingDescription = createValidAboutRecord();
    missingDescription.related_links.export_json.description = " ";

    expect(aboutRecordSchema.safeParse(insecureProfile).success).toBe(false);
    expect(aboutRecordSchema.safeParse(missingDescription).success).toBe(false);
  });
});

describe("MethodologyPublicationEvent", () => {
  test("accepts the Stage 1 Methodology publication event shape", () => {
    expect(methodologyPublicationEventSchema.safeParse(createValidMethodologyPublicationEvent()).success).toBe(
      true,
    );
  });

  test("rejects non-Methodology event types and malformed dates", () => {
    expect(
      methodologyPublicationEventSchema.safeParse({
        ...createValidMethodologyPublicationEvent(),
        type: "updated",
      }).success,
    ).toBe(false);
    expect(
      methodologyPublicationEventSchema.safeParse({
        ...createValidMethodologyPublicationEvent(),
        date: "2026-02-30",
      }).success,
    ).toBe(false);
  });
});
