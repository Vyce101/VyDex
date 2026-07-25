// Defines hosted Stage 1 verification inputs, evidence, and diagnostics.
import type { PreparedApplicationExport } from "../../adapters/application-export";
import type { ReleaseModel } from "../../domain";
import type { StageOneReleaseManifest } from "../stage-one-release";

export type HostedVerificationCheck = {
  name: string;
  passed: boolean;
  detail?: string;
};

export type HostedVerificationReport = {
  report_version: "1.0.0";
  phase: string;
  request_origin: string;
  canonical_origin: string;
  deployment_id: string;
  release_id: string;
  manifest_sha256: string;
  dataset_sha256: string;
  artifact_inventory_sha256: string;
  commit_sha: string;
  workflow_run_id: string;
  workflow_run_attempt: string;
  started_at: string;
  completed_at: string;
  success: boolean;
  checks: HostedVerificationCheck[];
};

export type HostedVerificationInput = {
  phase: string;
  request_origin: string;
  canonical_origin: string;
  deployment_id: string;
  release: ReleaseModel;
  prepared_export: PreparedApplicationExport;
  schema_serialized_json: string;
  manifest: StageOneReleaseManifest;
  manifest_serialized_json: string;
  commit_sha?: string;
  workflow_run_id?: string;
  workflow_run_attempt?: string;
  fetch?: typeof fetch;
  now?: () => Date;
};
