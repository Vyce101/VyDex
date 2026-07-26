// Creates a successor only when current committed source changes the active public artifact.
import type { SiteOrigin } from "../../domain";
import type { ReleaseLogger } from "../../shared/release-logger";
import {
  inspectReleaseSelection,
  type ReleaseSelectionInspection,
} from "./inspect-release-selection";
import {
  NEXT_RELEASE_CONFIRMATION,
  runNextRelease,
  type NextReleaseResult,
} from "./run-next-release";

export type ReleaseSelectionSyncResult =
  | { status: "current"; inspection: ReleaseSelectionInspection }
  | { status: "created"; inspection: ReleaseSelectionInspection; release: NextReleaseResult };

export async function syncReleaseSelection(input: {
  repository_root: string;
  site_origin: SiteOrigin;
  confirmation: string;
  environment?: NodeJS.ProcessEnv;
  logger: ReleaseLogger;
  dependencies?: {
    inspect_selection?: typeof inspectReleaseSelection;
    run_next_release?: typeof runNextRelease;
  };
}): Promise<ReleaseSelectionSyncResult> {
  const inspectSelection = input.dependencies?.inspect_selection ?? inspectReleaseSelection;
  const inspection = await inspectSelection({
    repository_root: input.repository_root,
    site_origin: input.site_origin,
    logger: input.logger,
  });
  if (inspection.status === "current") return { status: "current", inspection };
  if (input.confirmation !== NEXT_RELEASE_CONFIRMATION) {
    throw new Error(`release:sync requires --confirm ${NEXT_RELEASE_CONFIRMATION} when public output changed.`);
  }

  const createNextRelease = input.dependencies?.run_next_release ?? runNextRelease;
  const release = await createNextRelease({
    repository_root: input.repository_root,
    site_origin: input.site_origin,
    confirmation: input.confirmation,
    environment: input.environment,
    logger: input.logger,
  });
  return { status: "created", inspection, release };
}
