// Writes immutable generated dataset bytes beneath an explicitly injected output root.
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import type { ValidationDiagnostic } from "../../domain/cross-record-validation";
import type { GeneratedDatasetArtifactV1 } from "../../domain/json-export-generation";

export type DatasetArtifactWriteResult =
  | {
      success: true;
      data: {
        status: "written" | "unchanged";
        filename: string;
        public_path: GeneratedDatasetArtifactV1["public_path"];
      };
      diagnostics: readonly [];
    }
  | { success: false; diagnostics: ValidationDiagnostic[] };

function writeDiagnostic(
  code: "unsafe_artifact_path" | "immutable_artifact_collision" | "artifact_write_failed",
  rule: string,
  invalidValue?: unknown,
): ValidationDiagnostic {
  return {
    severity: "error",
    code,
    record_type: "dataset_artifact",
    path: ["public_path"],
    ...(invalidValue !== undefined ? { invalid_value: invalidValue } : {}),
    rule,
  };
}

function isWithinRoot(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

export async function writeDatasetArtifact(input: {
  output_root: string;
  artifact: GeneratedDatasetArtifactV1;
}): Promise<DatasetArtifactWriteResult> {
  if (typeof input.output_root !== "string" || input.output_root.trim().length === 0) {
    return {
      success: false,
      diagnostics: [
        writeDiagnostic(
          "unsafe_artifact_path",
          "Dataset artifact writing requires an explicit non-empty output root.",
          input.output_root,
        ),
      ],
    };
  }

  try {
    const requestedRoot = resolve(input.output_root);
    await mkdir(requestedRoot, { recursive: true });
    const resolvedRoot = await realpath(requestedRoot);
    const relativePublicPath = input.artifact.public_path.replace(/^\/+/, "");
    const requestedFilename = resolve(resolvedRoot, relativePublicPath);
    if (!isWithinRoot(resolvedRoot, requestedFilename)) {
      return {
        success: false,
        diagnostics: [
          writeDiagnostic(
            "unsafe_artifact_path",
            "The immutable dataset path must remain inside the injected output root.",
            input.artifact.public_path,
          ),
        ],
      };
    }

    const requestedParent = dirname(requestedFilename);
    await mkdir(requestedParent, { recursive: true });
    const resolvedParent = await realpath(requestedParent);
    if (!isWithinRoot(resolvedRoot, resolvedParent)) {
      return {
        success: false,
        diagnostics: [
          writeDiagnostic(
            "unsafe_artifact_path",
            "The resolved dataset directory must remain inside the injected output root.",
            resolvedParent,
          ),
        ],
      };
    }

    const filename = resolve(resolvedParent, basename(requestedFilename));
    const expectedBytes = Buffer.from(input.artifact.serialized_json, "utf8");
    try {
      await writeFile(filename, expectedBytes, { flag: "wx" });
      return {
        success: true,
        data: { status: "written", filename, public_path: input.artifact.public_path },
        diagnostics: [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }

    const existingStatus = await lstat(filename);
    if (!existingStatus.isFile() || existingStatus.isSymbolicLink()) {
      return {
        success: false,
        diagnostics: [
          writeDiagnostic(
            "unsafe_artifact_path",
            "An existing immutable artifact target must be a regular file, not a link or directory.",
            filename,
          ),
        ],
      };
    }
    const existingBytes = await readFile(filename);
    if (!existingBytes.equals(expectedBytes)) {
      return {
        success: false,
        diagnostics: [
          writeDiagnostic(
            "immutable_artifact_collision",
            "An immutable release path already exists with different bytes and must not be overwritten.",
            input.artifact.public_path,
          ),
        ],
      };
    }
    return {
      success: true,
      data: { status: "unchanged", filename, public_path: input.artifact.public_path },
      diagnostics: [],
    };
  } catch (error) {
    return {
      success: false,
      diagnostics: [
        writeDiagnostic(
          "artifact_write_failed",
          "The immutable dataset artifact could not be written to the injected output root.",
          error instanceof Error ? error.message : error,
        ),
      ],
    };
  }
}
