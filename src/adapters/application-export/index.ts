// Prepares one validated deterministic dataset artifact and its Export Page model.
import {
  DATASET_SCHEMA_PUBLIC_PATH,
  deriveDatasetArtifactLocation,
  generateVyDexDatasetV1,
  type GeneratedDatasetArtifactV1,
  type MethodologyVersion,
  type PublicPath,
  type ReleaseModel,
  type ValidationDiagnostic,
  type ValidationResult,
} from "../../domain";

export type ExportPagePresentationModel = {
  format: "JSON";
  scope: "Latest Entry Versions";
  entry_count: number;
  last_generated: string;
  methodology_versions: MethodologyVersion[];
  download_filename: string;
  download_path: PublicPath;
  schema_path: typeof DATASET_SCHEMA_PUBLIC_PATH;
};

export type PreparedApplicationExport = {
  artifact: GeneratedDatasetArtifactV1;
  presentation: ExportPagePresentationModel;
};

function exportDiagnostic(
  code: string,
  path: PropertyKey[],
  rule: string,
  invalidValue?: unknown,
): ValidationDiagnostic {
  return {
    severity: "error",
    code,
    record_type: "dataset_export",
    path,
    ...(invalidValue !== undefined ? { invalid_value: invalidValue } : {}),
    rule,
  };
}

function representedMethodologyVersions(
  artifact: GeneratedDatasetArtifactV1,
): MethodologyVersion[] {
  return [...new Set(artifact.dataset.entries.map(({ methodology }) => methodology.version))]
    .sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
}

function validatePreparedArtifact(
  release: ReleaseModel,
  artifact: GeneratedDatasetArtifactV1,
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  const dataset = artifact.dataset;
  const expectedLocation = deriveDatasetArtifactLocation(release.release_metadata);

  if (dataset.entry_count !== dataset.entries.length) {
    diagnostics.push(
      exportDiagnostic(
        "export_entry_count_mismatch",
        ["dataset", "entry_count"],
        "The Export Page Entry count must equal the generated dataset Entry count.",
        dataset.entry_count,
      ),
    );
  }
  if (dataset.scope !== "latest_entry_versions") {
    diagnostics.push(
      exportDiagnostic(
        "export_scope_mismatch",
        ["dataset", "scope"],
        "The Stage 1 export scope must be latest_entry_versions.",
        dataset.scope,
      ),
    );
  }
  if (dataset.generated_at !== release.release_metadata.generated_at) {
    diagnostics.push(
      exportDiagnostic(
        "export_generated_at_mismatch",
        ["dataset", "generated_at"],
        "The generated dataset timestamp must match the selected release descriptor.",
        dataset.generated_at,
      ),
    );
  }

  const representedVersions = representedMethodologyVersions(artifact);
  if (
    dataset.methodology_versions.length === 0 ||
    JSON.stringify(dataset.methodology_versions) !== JSON.stringify(representedVersions)
  ) {
    diagnostics.push(
      exportDiagnostic(
        "export_methodology_versions_mismatch",
        ["dataset", "methodology_versions"],
        "Methodology version metadata must list every version represented by generated Entries.",
        dataset.methodology_versions,
      ),
    );
  }
  if (artifact.public_path !== expectedLocation.public_path) {
    diagnostics.push(
      exportDiagnostic(
        "export_artifact_path_mismatch",
        ["artifact", "public_path"],
        "The immutable export path must match the selected release descriptor.",
        artifact.public_path,
      ),
    );
  }
  if (!artifact.public_path.endsWith(`/${expectedLocation.filename}`)) {
    diagnostics.push(
      exportDiagnostic(
        "export_artifact_filename_mismatch",
        ["artifact", "public_path"],
        "The immutable export filename must contain the descriptor's UTC generation date.",
        artifact.public_path,
      ),
    );
  }
  if (artifact.schema_public_path !== DATASET_SCHEMA_PUBLIC_PATH) {
    diagnostics.push(
      exportDiagnostic(
        "export_schema_path_mismatch",
        ["artifact", "schema_public_path"],
        "The export must reference the immutable Dataset Schema 1.0.0 path.",
        artifact.schema_public_path,
      ),
    );
  }

  return diagnostics;
}

export function prepareApplicationExport(
  release: ReleaseModel,
): ValidationResult<PreparedApplicationExport> {
  const firstResult = generateVyDexDatasetV1({ release });
  if (!firstResult.success) return firstResult;

  const secondResult = generateVyDexDatasetV1({ release });
  if (!secondResult.success) return secondResult;
  if (
    secondResult.data.public_path !== firstResult.data.public_path ||
    secondResult.data.serialized_json !== firstResult.data.serialized_json
  ) {
    return {
      success: false,
      diagnostics: [
        exportDiagnostic(
          "non_deterministic_dataset_export",
          ["artifact", "serialized_json"],
          "The same validated release must produce an identical path and identical dataset bytes.",
        ),
      ],
    };
  }

  const artifact = firstResult.data;
  const diagnostics = validatePreparedArtifact(release, artifact);
  if (diagnostics.length > 0) return { success: false, diagnostics };

  const location = deriveDatasetArtifactLocation(release.release_metadata);
  return {
    success: true,
    data: {
      artifact,
      presentation: {
        format: "JSON",
        scope: "Latest Entry Versions",
        entry_count: artifact.dataset.entry_count,
        last_generated: artifact.dataset.generated_at.slice(0, 10),
        methodology_versions: [...artifact.dataset.methodology_versions],
        download_filename: location.filename,
        download_path: artifact.public_path,
        schema_path: artifact.schema_public_path,
      },
    },
    diagnostics: [],
  };
}
