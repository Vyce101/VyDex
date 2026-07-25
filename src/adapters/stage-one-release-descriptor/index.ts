// Creates the initial Stage 1 descriptor exclusively while preserving existing release metadata.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  releaseMetadataSchema,
  type ReleaseMetadata,
} from "../../domain/canonical-records";
import { PERSISTED_RELEASE_DESCRIPTOR_PATH } from "../persisted-release-descriptor";

export type StageOneDescriptorReadResult =
  | { status: "missing" }
  | { status: "existing"; descriptor: ReleaseMetadata };

function descriptorFilename(filesystemRoot: string): string {
  return resolve(filesystemRoot, PERSISTED_RELEASE_DESCRIPTOR_PATH);
}

function parseDescriptor(rawText: string): ReleaseMetadata {
  let value: unknown;
  try {
    value = JSON.parse(rawText);
  } catch (cause) {
    throw new Error(
      `Production release descriptor contains malformed JSON at ${PERSISTED_RELEASE_DESCRIPTOR_PATH}.`,
      { cause },
    );
  }

  const parsed = releaseMetadataSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Production release descriptor is schema-invalid at ${PERSISTED_RELEASE_DESCRIPTOR_PATH}.`,
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

export async function readStageOneReleaseDescriptor(
  filesystemRoot: string,
): Promise<StageOneDescriptorReadResult> {
  const filename = descriptorFilename(filesystemRoot);
  let rawText: string;
  try {
    rawText = await readFile(filename, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: "missing" };
    throw new Error(
      `Production release descriptor is unreadable at ${PERSISTED_RELEASE_DESCRIPTOR_PATH}.`,
      { cause: error },
    );
  }
  return { status: "existing", descriptor: parseDescriptor(rawText) };
}

export async function createStageOneReleaseDescriptor(
  filesystemRoot: string,
  candidate: unknown,
): Promise<{ status: "created" | "existing"; descriptor: ReleaseMetadata }> {
  const descriptor = releaseMetadataSchema.parse(candidate);
  const filename = descriptorFilename(filesystemRoot);
  await mkdir(dirname(filename), { recursive: true });

  try {
    await writeFile(filename, `${JSON.stringify(descriptor, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    return { status: "created", descriptor };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw new Error(
        `Production release descriptor could not be created at ${PERSISTED_RELEASE_DESCRIPTOR_PATH}.`,
        { cause: error },
      );
    }
  }

  const existing = await readStageOneReleaseDescriptor(filesystemRoot);
  if (existing.status === "missing") {
    throw new Error("Production release descriptor disappeared during exclusive creation.");
  }
  return { status: "existing", descriptor: existing.descriptor };
}
