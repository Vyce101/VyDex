// Serializes release aliases and the stable dataset pointer into Cloudflare redirect rules.
import type { PreparedApplicationExport } from "../../adapters/application-export";
import type { ReleaseModel } from "../../domain";

export type StageOneRedirect = {
  source: string;
  destination: string;
  status: 301 | 302;
};

export function collectStageOneRedirects(
  release: ReleaseModel,
  preparedExport: PreparedApplicationExport,
): StageOneRedirect[] {
  return [
    ...release.redirects.map(({ source, destination, status }) => ({ source, destination, status })),
    preparedExport.artifact.latest_dataset_redirect,
  ]
    .map(({ source, destination, status }) => ({ source, destination, status }))
    .sort((left, right) => left.source.localeCompare(right.source, "en"));
}

export function serializeStageOneRedirects(redirects: readonly StageOneRedirect[]): string {
  return `${redirects
    .map(({ source, destination, status }) => `${source} ${destination} ${status}`)
    .join("\n")}\n`;
}
