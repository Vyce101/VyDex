// Loads and validates the durable descriptor for an existing production release.
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
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
  const configuredCandidatePath = process.env.VYDEX_RELEASE_DESCRIPTOR_PATH?.trim();
  let filename = resolve(input.filesystem_root, PERSISTED_RELEASE_DESCRIPTOR_PATH);
  if (configuredCandidatePath) {
    if (process.env.VYDEX_ATOMIC_RELEASE_BUILD !== "1") {
      throw new Error("A candidate descriptor may be selected only during an atomic release build.");
    }
    const candidateFilename = resolve(configuredCandidatePath);
    const runtimeRoot = resolve(input.filesystem_root, "runtime");
    const relativeCandidate = relative(runtimeRoot, candidateFilename);
    if (relativeCandidate.startsWith("..") || isAbsolute(relativeCandidate)) {
      throw new Error("The candidate descriptor must remain inside ignored runtime storage.");
    }
    filename = candidateFilename;
  }
  const readTextFile = input.read_text_file ?? ((path: string) => readFile(path, "utf8"));

  let rawText: string;
  try {
    rawText = await readTextFile(filename);
  } catch (cause) {
    throw new Error(
      `Production release descriptor is missing or unreadable at ${filename}.`,
      { cause },
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(rawText);
  } catch (cause) {
    throw new Error(
      `Production release descriptor contains malformed JSON at ${filename}.`,
      { cause },
    );
  }

  const parsed = releaseMetadataSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Production release descriptor is schema-invalid at ${filename}.`,
      { cause: parsed.error },
    );
  }

  return parsed.data;
}
