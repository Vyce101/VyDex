// Loads and validates active release state against its immutable archive.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  immutablePublicContractSchema,
  releaseHistorySchema,
  releaseMetadataSchema,
  type ImmutablePublicContract,
  type ReleaseHistory,
  type ReleaseMetadata,
} from "../../domain";
import {
  parseReleaseManifest,
  RELEASE_ARCHIVE_ROOT,
  RELEASE_DESCRIPTOR_PATH,
  RELEASE_HISTORY_PATH,
  RELEASE_MANIFEST_PATH,
  type ReleaseManifest,
} from "./manifest";

export const ARCHIVED_DESCRIPTOR_FILENAME = "release.json";
export const ARCHIVED_MANIFEST_FILENAME = "release-manifest.json";
export const IMMUTABLE_PUBLIC_DIRECTORY = "immutable-public";
export const IMMUTABLE_PUBLIC_CONTRACT_FILENAME = "immutable-public-contract.json";

export type LoadedReleaseState = {
  descriptor: ReleaseMetadata;
  descriptor_raw: string;
  manifest: ReleaseManifest;
  manifest_raw: string;
  history: ReleaseHistory;
  history_raw: string;
  active_archive_root: string;
  immutable_contract: ImmutablePublicContract;
};

async function requiredText(filename: string, label: string): Promise<string> {
  try {
    return await readFile(filename, "utf8");
  } catch (cause) {
    throw new Error(`${label} is missing or unreadable at ${filename}.`, { cause });
  }
}

function sha256(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

export function archiveRootFor(repositoryRoot: string, releaseId: string): string {
  return resolve(repositoryRoot, RELEASE_ARCHIVE_ROOT, releaseId);
}

export async function loadReleaseState(repositoryRoot: string): Promise<LoadedReleaseState> {
  const descriptorFilename = resolve(repositoryRoot, RELEASE_DESCRIPTOR_PATH);
  const manifestFilename = resolve(repositoryRoot, RELEASE_MANIFEST_PATH);
  const historyFilename = resolve(repositoryRoot, RELEASE_HISTORY_PATH);
  const descriptorRaw = await requiredText(descriptorFilename, "Active release descriptor");
  const manifestRaw = await requiredText(manifestFilename, "Active release manifest");
  const historyRaw = await requiredText(historyFilename, "Release history");
  const descriptor = releaseMetadataSchema.parse(JSON.parse(descriptorRaw));
  const manifest = parseReleaseManifest(manifestRaw);
  const history = releaseHistorySchema.parse(JSON.parse(historyRaw));
  const finalRelease = history.releases.at(-1)!;
  if (finalRelease.release_id !== descriptor.release_id || manifest.release_id !== descriptor.release_id) {
    throw new Error("The active descriptor, manifest, and final release-history record must identify the same release.");
  }
  if (manifest.generated_at !== descriptor.generated_at || finalRelease.generated_at !== descriptor.generated_at) {
    throw new Error("The active descriptor, manifest, and release history must use the same generation timestamp.");
  }
  if (manifest.source_commit !== finalRelease.source_commit || manifest.previous_release_id !== finalRelease.previous_release_id) {
    throw new Error("The active manifest provenance must match the final release-history record.");
  }

  const activeArchiveRoot = archiveRootFor(repositoryRoot, descriptor.release_id);
  const archivedDescriptorRaw = await requiredText(resolve(activeArchiveRoot, ARCHIVED_DESCRIPTOR_FILENAME), "Archived active descriptor");
  const archivedManifestRaw = await requiredText(resolve(activeArchiveRoot, ARCHIVED_MANIFEST_FILENAME), "Archived active manifest");
  if (archivedDescriptorRaw !== descriptorRaw || archivedManifestRaw !== manifestRaw) {
    throw new Error("The active descriptor and manifest must be byte-identical to their archived copies.");
  }
  const immutableContract = immutablePublicContractSchema.parse(JSON.parse(await requiredText(
    resolve(activeArchiveRoot, IMMUTABLE_PUBLIC_CONTRACT_FILENAME),
    "Archived immutable-public contract",
  )));
  if (immutableContract.release_id !== descriptor.release_id) {
    throw new Error("The active immutable-public contract identifies another release.");
  }
  await verifyImmutablePublicContract(activeArchiveRoot, immutableContract);
  return {
    descriptor,
    descriptor_raw: descriptorRaw,
    manifest,
    manifest_raw: manifestRaw,
    history,
    history_raw: historyRaw,
    active_archive_root: activeArchiveRoot,
    immutable_contract: immutableContract,
  };
}

export async function loadArchivedReleaseState(repositoryRoot: string, releaseId: string): Promise<{
  descriptor: ReleaseMetadata;
  manifest: ReleaseManifest;
  manifest_raw: string;
  immutable_contract: ImmutablePublicContract;
  archive_root: string;
}> {
  const archiveRoot = archiveRootFor(repositoryRoot, releaseId);
  const descriptor = releaseMetadataSchema.parse(JSON.parse(await requiredText(resolve(archiveRoot, ARCHIVED_DESCRIPTOR_FILENAME), "Archived descriptor")));
  const manifestRaw = await requiredText(resolve(archiveRoot, ARCHIVED_MANIFEST_FILENAME), "Archived manifest");
  const manifest = parseReleaseManifest(manifestRaw);
  const immutableContract = immutablePublicContractSchema.parse(JSON.parse(await requiredText(
    resolve(archiveRoot, IMMUTABLE_PUBLIC_CONTRACT_FILENAME),
    "Archived immutable-public contract",
  )));
  if (descriptor.release_id !== releaseId || manifest.release_id !== releaseId || immutableContract.release_id !== releaseId) {
    throw new Error(`Archive directory ${releaseId} contains inconsistent release identities.`);
  }
  await verifyImmutablePublicContract(archiveRoot, immutableContract);
  return { descriptor, manifest, manifest_raw: manifestRaw, immutable_contract: immutableContract, archive_root: archiveRoot };
}

export async function verifyAllReleaseArchives(repositoryRoot: string, history: ReleaseHistory): Promise<void> {
  const retainedRoutes = new Map<string, { bytes: number; sha256: string }>();
  for (const [index, release] of history.releases.entries()) {
    const archive = await loadArchivedReleaseState(repositoryRoot, release.release_id);
    const expectedArchivePrefix = `${RELEASE_ARCHIVE_ROOT}/${release.release_id}`;
    const expectedRetainedIds = history.releases.slice(0, index).map(({ release_id }) => release_id);
    const expectedRetainedRoutes = [...retainedRoutes.keys()].sort((left, right) => left.localeCompare(right, "en"));
    if (
      archive.descriptor.generated_at !== release.generated_at ||
      archive.manifest.source_commit !== release.source_commit ||
      archive.manifest.previous_release_id !== release.previous_release_id ||
      release.descriptor_path !== `${expectedArchivePrefix}/${ARCHIVED_DESCRIPTOR_FILENAME}` ||
      release.manifest_path !== `${expectedArchivePrefix}/${ARCHIVED_MANIFEST_FILENAME}` ||
      JSON.stringify(archive.manifest.retained_release_ids) !== JSON.stringify(expectedRetainedIds) ||
      JSON.stringify(archive.manifest.retained_immutable_routes) !== JSON.stringify(expectedRetainedRoutes) ||
      !archive.immutable_contract.routes.some(({ public_path }) => public_path === release.dataset_public_path) ||
      archive.manifest.generated_routes.length === 0
    ) {
      throw new Error(`Release history disagrees with archive ${release.release_id}.`);
    }
    const inventory = new Map(archive.manifest.files.map((file) => [file.path, file]));
    for (const route of archive.immutable_contract.routes) {
      const inventoryFile = inventory.get(route.public_path.replace(/^\/+/, ""));
      if (!inventoryFile || inventoryFile.bytes !== route.bytes || inventoryFile.sha256 !== route.sha256) {
        throw new Error(`Release ${release.release_id} manifest does not inventory immutable route ${route.public_path}.`);
      }
      const prior = retainedRoutes.get(route.public_path);
      if (prior && (prior.bytes !== route.bytes || prior.sha256 !== route.sha256)) {
        throw new Error(`Release ${release.release_id} changes immutable route ${route.public_path}.`);
      }
      retainedRoutes.set(route.public_path, { bytes: route.bytes, sha256: route.sha256 });
    }
    for (const [publicPath, expected] of retainedRoutes) {
      const inventoryFile = inventory.get(publicPath.replace(/^\/+/, ""));
      if (!inventoryFile || inventoryFile.bytes !== expected.bytes || inventoryFile.sha256 !== expected.sha256) {
        throw new Error(`Release ${release.release_id} omits retained immutable route ${publicPath} from its complete inventory.`);
      }
    }
  }
}

export async function verifyImmutablePublicContract(
  archiveRoot: string,
  contract: ImmutablePublicContract,
): Promise<void> {
  const seen = new Set<string>();
  for (const route of contract.routes) {
    if (seen.has(route.public_path)) throw new Error(`Immutable route ${route.public_path} is duplicated.`);
    seen.add(route.public_path);
    const contents = await readFile(resolve(archiveRoot, IMMUTABLE_PUBLIC_DIRECTORY, route.archive_path));
    if (contents.byteLength !== route.bytes || sha256(contents) !== route.sha256) {
      throw new Error(`Immutable route ${route.public_path} does not match its archived hash and byte length.`);
    }
  }
}

export function activeStateMatchesArchive(state: LoadedReleaseState): boolean {
  const finalRelease = state.history.releases.at(-1);
  return Boolean(finalRelease && isDeepStrictEqual({
    release_id: state.manifest.release_id,
    generated_at: state.manifest.generated_at,
    source_commit: state.manifest.source_commit,
    previous_release_id: state.manifest.previous_release_id,
  }, {
    release_id: finalRelease.release_id,
    generated_at: finalRelease.generated_at,
    source_commit: finalRelease.source_commit,
    previous_release_id: finalRelease.previous_release_id,
  }));
}
