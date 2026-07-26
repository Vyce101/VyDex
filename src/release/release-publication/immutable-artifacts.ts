// Verifies and materializes archived immutable public artifacts in release output.
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ImmutablePublicContract, ReleaseHistory } from "../../domain";
import { IMMUTABLE_PUBLIC_DIRECTORY, loadArchivedReleaseState } from "./release-state";

function sha256(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

async function copyWithoutCollision(source: string, destination: string): Promise<void> {
  const sourceBytes = await readFile(source);
  try {
    const destinationBytes = await readFile(destination);
    if (!sourceBytes.equals(destinationBytes)) {
      throw new Error(`Immutable public artifact collision at ${destination}.`);
    }
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

export async function materializeRetainedImmutableArtifacts(input: {
  repository_root: string;
  output_root: string;
  history: ReleaseHistory;
  exclude_release_id?: string;
}): Promise<string[]> {
  const routes = new Set<string>();
  for (const record of input.history.releases) {
    if (record.release_id === input.exclude_release_id) continue;
    const archive = await loadArchivedReleaseState(input.repository_root, record.release_id);
    for (const route of archive.immutable_contract.routes) {
      const source = resolve(archive.archive_root, IMMUTABLE_PUBLIC_DIRECTORY, route.archive_path);
      const destination = resolve(input.output_root, route.public_path.replace(/^\/+/, ""));
      await copyWithoutCollision(source, destination);
      const materialized = await readFile(destination);
      if (materialized.byteLength !== route.bytes || sha256(materialized) !== route.sha256) {
        throw new Error(`Materialized immutable route ${route.public_path} changed bytes.`);
      }
      routes.add(route.public_path);
    }
  }
  return [...routes].sort((left, right) => left.localeCompare(right, "en"));
}

export async function verifyActiveImmutableArtifacts(input: {
  output_root: string;
  repository_root: string;
  release_id: string;
}): Promise<void> {
  const archive = await loadArchivedReleaseState(input.repository_root, input.release_id);
  for (const route of archive.immutable_contract.routes) {
    const output = await readFile(resolve(input.output_root, route.public_path.replace(/^\/+/, "")));
    if (output.byteLength !== route.bytes || sha256(output) !== route.sha256) {
      throw new Error(`Reproduced active immutable route ${route.public_path} differs from its archive.`);
    }
  }
}

export async function createImmutablePublicContract(input: {
  output_root: string;
  release_id: string;
  dataset_public_path: string;
  dataset_filename: string;
  schema_public_path: string;
}): Promise<ImmutablePublicContract> {
  const definitions = [
    {
      public_path: input.dataset_public_path,
      content_type: "application/json; charset=utf-8",
      content_disposition: `attachment; filename=\"${input.dataset_filename}\"`,
    },
    {
      public_path: input.schema_public_path,
      content_type: "application/schema+json; charset=utf-8",
    },
  ];
  const routes = await Promise.all(definitions.map(async (definition) => {
    const archivePath = definition.public_path.replace(/^\/+/, "");
    const contents = await readFile(resolve(input.output_root, archivePath));
    return {
      public_path: definition.public_path,
      archive_path: archivePath,
      bytes: contents.byteLength,
      sha256: sha256(contents),
      content_type: definition.content_type,
      cache_control: "public, max-age=31536000, immutable",
      ...(definition.content_disposition ? { content_disposition: definition.content_disposition } : {}),
    };
  }));
  return {
    contract_version: "1.0.0",
    release_id: input.release_id as ImmutablePublicContract["release_id"],
    routes: routes.sort((left, right) => left.public_path.localeCompare(right.public_path, "en")),
  };
}
