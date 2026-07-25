// Loads and validates the durable descriptor for an existing production release.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  releaseMetadataSchema,
  type ReleaseMetadata,
} from "../../domain/canonical-records";

export const PERSISTED_RELEASE_DESCRIPTOR_PATH = "generated/release-data/release.json";

export type PersistedReleaseDescriptor = ReleaseMetadata;

export type ReadPersistedReleaseDescriptorText = (filename: string) => Promise<string>;

export type LoadPersistedReleaseDescriptorInput = {
  filesystem_root: string;
  read_text_file?: ReadPersistedReleaseDescriptorText;
};

export async function loadPersistedReleaseDescriptor(
  input: LoadPersistedReleaseDescriptorInput,
): Promise<PersistedReleaseDescriptor> {
  const filename = resolve(input.filesystem_root, PERSISTED_RELEASE_DESCRIPTOR_PATH);
  const readTextFile = input.read_text_file ?? ((path: string) => readFile(path, "utf8"));

  let rawText: string;
  try {
    rawText = await readTextFile(filename);
  } catch (cause) {
    throw new Error(
      `Production release descriptor is missing or unreadable at ${PERSISTED_RELEASE_DESCRIPTOR_PATH}.`,
      { cause },
    );
  }

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
