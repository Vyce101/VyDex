// Verifies aggregate identities, relationships, production rules, and diagnostic structure.
import { describe, expect, test } from "vitest";
import {
  validateCanonicalRecordSet,
  validateEntryRecord,
  type ValidationDiagnostic,
} from "../../src/domain/cross-record-validation";
import { IDS, createValidEntry, createValidRecordSetInput } from "./fixtures";

function findDiagnostic(diagnostics: ValidationDiagnostic[], code: string): ValidationDiagnostic {
  const diagnostic = diagnostics.find((candidate) => candidate.code === code);
  expect(diagnostic, `Expected diagnostic code ${code}`).toBeDefined();
  return diagnostic!;
}

describe("record-local diagnostics", () => {
  test("returns filename, record ID, precise path, invalid value, and violated rule", () => {
    const entry = createValidEntry();
    entry.claim_status = "likely";
    const result = validateEntryRecord({ filename: "invalid-entry.json", value: entry });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.diagnostics[0]).toMatchObject({
      severity: "error",
      code: "invalid_controlled_value",
      record_type: "entry",
      record_id: IDS.entry,
      filename: "invalid-entry.json",
      path: ["claim_status"],
      invalid_value: "likely",
    });
    expect(result.diagnostics[0]?.rule).toBeTruthy();
  });

  test("treats a missing source used_for field as a blocking error", () => {
    const entry = createValidEntry();
    delete (entry.sources[0] as Partial<(typeof entry.sources)[number]>).used_for;
    const result = validateEntryRecord({ filename: "missing-used-for.json", value: entry });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "required_field",
        filename: "missing-used-for.json",
        path: ["sources", 0, "used_for"],
      }),
    );
  });

  test("reports unknown strict-object fields at the offending property path", () => {
    const entry = { ...createValidEntry(), evidence_strength_score: 3 };
    const result = validateEntryRecord({ filename: "extra-field.json", value: entry });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "unknown_field",
        path: ["evidence_strength_score"],
        invalid_value: 3,
      }),
    );
  });

  test("reports duplicate source citation IDs at the repeated citation field", () => {
    const entry = createValidEntry();
    entry.sources.push({ ...entry.sources[0]! });
    const result = validateEntryRecord({ filename: "duplicate-citation.json", value: entry });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "duplicate_value",
        path: ["sources", 1, "citation_id"],
        invalid_value: "evaluation-paper",
      }),
    );
  });
});

describe("aggregate canonical validation", () => {
  test("returns the complete typed record set for valid fixtures", () => {
    const result = validateCanonicalRecordSet(createValidRecordSetInput(), "stage_1_production");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.entries[0]?.title).toBe("Verified frontier result");
    expect(result.data.entry_publication_snapshots[0]?.revision_number).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  test("rejects globally duplicated durable UUIDs", () => {
    const input = createValidRecordSetInput();
    (input.release_metadata[0]!.value as { release_id: string }).release_id = IDS.entry;
    const result = validateCanonicalRecordSet(input, "authoring");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(findDiagnostic(result.diagnostics, "duplicate_durable_id")).toMatchObject({
      record_type: "release_metadata",
      record_id: IDS.entry,
      filename: "release.json",
      path: ["release_id"],
      invalid_value: IDS.entry,
      related_record_id: IDS.entry,
    });
  });

  test("rejects collisions across current Entry slugs and aliases", () => {
    const input = createValidRecordSetInput();
    const secondEntry = createValidEntry();
    secondEntry.id = IDS.alternateEntry;
    secondEntry.slug = "another-result";
    secondEntry.aliases = ["verified-frontier-result"];
    input.entries.push({ filename: "second-entry.json", value: secondEntry });
    const result = validateCanonicalRecordSet(input, "authoring");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(findDiagnostic(result.diagnostics, "slug_namespace_collision")).toMatchObject({
      record_id: IDS.alternateEntry,
      filename: "second-entry.json",
      path: ["aliases", 0],
      invalid_value: "verified-frontier-result",
      related_record_id: IDS.entry,
    });
  });

  test("rejects unresolved primary, secondary, and Methodology relationships", () => {
    const input = createValidRecordSetInput();
    const entry = input.entries[0]!.value as ReturnType<typeof createValidEntry>;
    entry.primary_topic_trail_id = "01900000-0000-7000-8000-000000000010";
    entry.secondary_topic_trail_ids = ["01900000-0000-7000-8000-000000000011"];
    entry.methodology_id = "01900000-0000-7000-8000-000000000012";
    input.entry_publication_snapshots = [];
    const result = validateCanonicalRecordSet(input, "authoring");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.diagnostics.filter(({ code }) => code === "unresolved_topic_trail")).toHaveLength(2);
    expect(findDiagnostic(result.diagnostics, "unresolved_methodology").path).toEqual(["methodology_id"]);
  });

  test("rejects snapshot identity and stored Methodology version mismatches", () => {
    const identityInput = createValidRecordSetInput();
    const identitySnapshot = identityInput.entry_publication_snapshots[0]!.value as {
      entry_id: string;
    };
    identitySnapshot.entry_id = IDS.alternateEntry;
    const identityResult = validateCanonicalRecordSet(identityInput, "authoring");
    expect(identityResult.success).toBe(false);
    if (!identityResult.success) {
      expect(findDiagnostic(identityResult.diagnostics, "snapshot_entry_id_mismatch").path).toEqual(["entry_id"]);
    }

    const versionInput = createValidRecordSetInput();
    const versionSnapshot = versionInput.entry_publication_snapshots[0]!.value as {
      methodology_public_version: string;
    };
    versionSnapshot.methodology_public_version = "1.1.0";
    const versionResult = validateCanonicalRecordSet(versionInput, "authoring");
    expect(versionResult.success).toBe(false);
    if (!versionResult.success) {
      expect(findDiagnostic(versionResult.diagnostics, "snapshot_methodology_version_mismatch")).toMatchObject({
        path: ["methodology_public_version"],
        invalid_value: "1.1.0",
        related_record_id: IDS.methodology,
      });
    }
  });

  test("accepts removed Entries for authoring and rejects only current production Entries", () => {
    const authoringInput = createValidRecordSetInput();
    (authoringInput.entries[0]!.value as ReturnType<typeof createValidEntry>).entry_state = "removed";
    (authoringInput.entry_publication_snapshots[0]!.value as { entry: { entry_state: string } }).entry.entry_state =
      "removed";

    expect(validateCanonicalRecordSet(authoringInput, "authoring").success).toBe(true);
    const productionResult = validateCanonicalRecordSet(authoringInput, "stage_1_production");
    expect(productionResult.success).toBe(false);
    if (productionResult.success) return;
    const diagnostics = productionResult.diagnostics.filter(({ code }) => code === "removed_entry_not_public");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.record_type).toBe("entry");
  });
});
