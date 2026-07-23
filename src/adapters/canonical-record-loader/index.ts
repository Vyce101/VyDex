// Loads canonical JSON records and immutable Entry snapshots from an injected repository root.
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import type { ValidationDiagnostic } from "../../domain/cross-record-validation";
import type {
  CanonicalRecordSource,
  LoadedCanonicalRecords,
} from "../../domain/release-construction";

export type { LoadedCanonicalRecords } from "../../domain/release-construction";

export type LoadedCanonicalRecordType =
  | "entry"
  | "topic_trail"
  | "methodology"
  | "about"
  | "methodology_publication_event"
  | "entry_publication_snapshot";

export type LoadedRecordInput = CanonicalRecordSource & {
  record_type: LoadedCanonicalRecordType;
  filename: string;
  raw_text: string;
};

export type LoadCanonicalRecordsInput = {
  filesystem_root: string;
};

type CollectionDefinition = {
  key: Exclude<keyof LoadedCanonicalRecords, "diagnostics">;
  recordType: LoadedCanonicalRecordType;
  relativeDirectory: string;
  recursive: boolean;
};

const COLLECTIONS: readonly CollectionDefinition[] = [
  {
    key: "entries",
    recordType: "entry",
    relativeDirectory: "data/canonical-records/entries",
    recursive: false,
  },
  {
    key: "topic_trails",
    recordType: "topic_trail",
    relativeDirectory: "data/canonical-records/topic-trails",
    recursive: false,
  },
  {
    key: "methodologies",
    recordType: "methodology",
    relativeDirectory: "data/canonical-records/methodologies",
    recursive: false,
  },
  {
    key: "about",
    recordType: "about",
    relativeDirectory: "data/canonical-records/about",
    recursive: false,
  },
  {
    key: "methodology_publication_events",
    recordType: "methodology_publication_event",
    relativeDirectory: "data/canonical-records/methodology-publication-events",
    recursive: false,
  },
  {
    key: "entry_publication_snapshots",
    recordType: "entry_publication_snapshot",
    relativeDirectory: "data/publication-snapshots/entries",
    recursive: true,
  },
];

function normalizeFilename(filesystemRoot: string, filename: string): string {
  return relative(filesystemRoot, filename).split(sep).join("/");
}

function createLoaderDiagnostic(
  code: string,
  recordType: LoadedCanonicalRecordType,
  filename: string,
  path: PropertyKey[],
  rule: string,
  invalidValue?: unknown,
): ValidationDiagnostic {
  return {
    severity: "error",
    code,
    record_type: recordType,
    filename,
    path,
    ...(invalidValue !== undefined ? { invalid_value: invalidValue } : {}),
    rule,
  };
}

async function discoverJsonFiles(directory: string, recursive: boolean): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return recursive ? discoverJsonFiles(path, true) : [];
      return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
    }),
  );
  return files.flat().sort((left, right) => left.localeCompare(right, "en"));
}

function validateAboutFilename(filename: string, diagnostics: ValidationDiagnostic[]): void {
  if (filename.endsWith("/data/canonical-records/about/about.json") || filename === "data/canonical-records/about/about.json") {
    return;
  }
  diagnostics.push(
    createLoaderDiagnostic(
      "unexpected_about_filename",
      "about",
      filename,
      [],
      "about/about.json is the only accepted About record filename.",
      filename,
    ),
  );
}

function validateSnapshotLocation(
  filename: string,
  value: unknown,
  diagnostics: ValidationDiagnostic[],
): void {
  const prefix = "data/publication-snapshots/entries/";
  const relativeSnapshotPath = filename.startsWith(prefix) ? filename.slice(prefix.length) : filename;
  const segments = relativeSnapshotPath.split("/");
  if (segments.length !== 2) {
    diagnostics.push(
      createLoaderDiagnostic(
        "invalid_snapshot_path",
        "entry_publication_snapshot",
        filename,
        [],
        "A snapshot must be stored directly under its Entry ID directory.",
        relativeSnapshotPath,
      ),
    );
    return;
  }

  if (typeof value !== "object" || value === null) return;
  const entryId = Reflect.get(value, "entry_id");
  const revisionNumber = Reflect.get(value, "revision_number");
  const revisionId = Reflect.get(value, "revision_id");
  const [directoryEntryId, basename] = segments;
  if (typeof entryId === "string" && directoryEntryId !== entryId) {
    diagnostics.push(
      createLoaderDiagnostic(
        "snapshot_directory_entry_id_mismatch",
        "entry_publication_snapshot",
        filename,
        ["entry_id"],
        "Snapshot directory name must equal the stored entry_id.",
        directoryEntryId,
      ),
    );
  }

  if (typeof revisionNumber === "number" && typeof revisionId === "string") {
    const expectedBasename = `${revisionNumber}-${revisionId}.json`;
    if (basename !== expectedBasename) {
      diagnostics.push(
        createLoaderDiagnostic(
          "snapshot_filename_metadata_mismatch",
          "entry_publication_snapshot",
          filename,
          [],
          "Snapshot filename must equal {revision-number}-{revision-id}.json.",
          basename,
        ),
      );
    }
  }
}

async function loadFile(
  filesystemRoot: string,
  absoluteFilename: string,
  recordType: LoadedCanonicalRecordType,
  diagnostics: ValidationDiagnostic[],
): Promise<LoadedRecordInput> {
  const filename = normalizeFilename(filesystemRoot, absoluteFilename);
  let rawText = "";
  try {
    rawText = await readFile(absoluteFilename, "utf8");
  } catch (error) {
    diagnostics.push(
      createLoaderDiagnostic(
        "record_read_failed",
        recordType,
        filename,
        [],
        "The canonical record file could not be read.",
        (error as Error).message,
      ),
    );
    return { record_type: recordType, filename, raw_text: rawText, value: undefined };
  }

  let value: unknown;
  try {
    value = JSON.parse(rawText);
  } catch (error) {
    diagnostics.push(
      createLoaderDiagnostic(
        "invalid_json",
        recordType,
        filename,
        [],
        "The authoring file must contain valid JSON.",
        (error as Error).message,
      ),
    );
  }

  if (recordType === "about") validateAboutFilename(filename, diagnostics);
  if (recordType === "entry_publication_snapshot" && value !== undefined) {
    validateSnapshotLocation(filename, value, diagnostics);
  }
  return { record_type: recordType, filename, raw_text: rawText, value };
}

export async function loadCanonicalRecords(
  input: LoadCanonicalRecordsInput,
): Promise<LoadedCanonicalRecords> {
  const filesystemRoot = resolve(input.filesystem_root);
  const diagnostics: ValidationDiagnostic[] = [];
  const loaded: LoadedCanonicalRecords = {
    entries: [],
    topic_trails: [],
    methodologies: [],
    about: [],
    methodology_publication_events: [],
    entry_publication_snapshots: [],
    diagnostics,
  };

  for (const collection of COLLECTIONS) {
    const directory = resolve(filesystemRoot, collection.relativeDirectory);
    let filenames: string[] = [];
    try {
      filenames = await discoverJsonFiles(directory, collection.recursive);
    } catch (error) {
      diagnostics.push(
        createLoaderDiagnostic(
          "collection_read_failed",
          collection.recordType,
          collection.relativeDirectory,
          [],
          "The canonical record collection could not be enumerated.",
          (error as Error).message,
        ),
      );
      continue;
    }
    loaded[collection.key] = await Promise.all(
      filenames.map((filename) => loadFile(filesystemRoot, filename, collection.recordType, diagnostics)),
    );
  }

  return loaded;
}
