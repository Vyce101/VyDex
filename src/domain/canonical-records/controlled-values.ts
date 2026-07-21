// Defines stable machine values, derived scores, and authoritative public labels.
import { z } from "zod";

export const CLAIM_STATUSES = [
  "confirmed",
  "supported",
  "provisional",
  "reported_but_unverified",
  "disputed",
  "failed_retracted",
] as const;
export const claimStatusSchema = z.enum(CLAIM_STATUSES);
export type ClaimStatus = z.infer<typeof claimStatusSchema>;

export const EVIDENCE_STRENGTHS = ["thin", "moderate", "strong", "very_strong"] as const;
export const evidenceStrengthSchema = z.enum(EVIDENCE_STRENGTHS);
export type EvidenceStrength = z.infer<typeof evidenceStrengthSchema>;

export const EVIDENCE_STRENGTH_SCORES = {
  thin: 1,
  moderate: 2,
  strong: 3,
  very_strong: 4,
} as const satisfies Record<EvidenceStrength, number>;

export const REVIEW_STATUSES = ["stable", "follow_up_needed"] as const;
export const reviewStatusSchema = z.enum(REVIEW_STATUSES);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const ENTRY_STATES = ["main_entry", "removed"] as const;
export const entryStateSchema = z.enum(ENTRY_STATES);
export type EntryState = z.infer<typeof entryStateSchema>;

export const DOMAINS = [
  "ai_capabilities",
  "ai_evaluation",
  "robotics",
  "biology",
  "mathematics",
  "physical_sciences",
  "cybersecurity",
  "hardware",
  "economics",
  "governance",
  "national_security",
  "space",
] as const;
export const domainSchema = z.enum(DOMAINS);
export type Domain = z.infer<typeof domainSchema>;

export const DOMAIN_LABELS = {
  ai_capabilities: "AI Capabilities",
  ai_evaluation: "AI Evaluation",
  robotics: "Robotics",
  biology: "Biology",
  mathematics: "Mathematics",
  physical_sciences: "Physical Sciences",
  cybersecurity: "Cybersecurity",
  hardware: "Hardware",
  economics: "Economics",
  governance: "Governance",
  national_security: "National Security",
  space: "Space",
} as const satisfies Record<Domain, string>;

export const EVIDENCE_TYPES = [
  "preprint",
  "peer_reviewed_paper",
  "independent_replication",
  "official_claim",
  "developer_vendor_claim",
  "benchmark_result",
  "technical_artifact",
  "government_report",
  "court_filing",
  "audit",
  "media_report",
  "leaked_internal_claim",
] as const;
export const evidenceTypeSchema = z.enum(EVIDENCE_TYPES);
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;

export const EVIDENCE_TYPE_LABELS = {
  preprint: "Preprint",
  peer_reviewed_paper: "Peer-Reviewed Paper",
  independent_replication: "Independent Replication",
  official_claim: "Official Claim",
  developer_vendor_claim: "Developer / Vendor Claim",
  benchmark_result: "Benchmark Result",
  technical_artifact: "Technical Artifact",
  government_report: "Government Report",
  court_filing: "Court Filing",
  audit: "Audit",
  media_report: "Media Report",
  leaked_internal_claim: "Leaked / Internal Claim",
} as const satisfies Record<EvidenceType, string>;

export const PUBLIC_CHANGELOG_TYPES = ["added", "updated", "removed", "methodology_change"] as const;
export const publicChangelogTypeSchema = z.enum(PUBLIC_CHANGELOG_TYPES);
export type PublicChangelogType = z.infer<typeof publicChangelogTypeSchema>;

export const MATERIALITIES = ["material", "non_material"] as const;
export const materialitySchema = z.enum(MATERIALITIES);
export type Materiality = z.infer<typeof materialitySchema>;

export const SOURCE_ROLES = [
  "primary_evidence",
  "independent_replication",
  "official_record",
  "strong_artifact",
  "context_source",
  "media_report",
] as const;
export const sourceRoleSchema = z.enum(SOURCE_ROLES);
export type SourceRole = z.infer<typeof sourceRoleSchema>;

export const SOURCE_ROLE_LABELS = {
  primary_evidence: "Primary Evidence",
  independent_replication: "Independent Replication",
  official_record: "Official Record",
  strong_artifact: "Strong Artifact",
  context_source: "Context Source",
  media_report: "Media Report",
} as const satisfies Record<SourceRole, string>;

export const REVISION_CATEGORIES = [
  "initial_publication",
  "material_update",
  "non_material_correction",
  "review_check",
  "removal",
  "methodology_publication",
] as const;
export const revisionCategorySchema = z.enum(REVISION_CATEGORIES);
export type RevisionCategory = z.infer<typeof revisionCategorySchema>;

export const ENTRY_REVISION_CATEGORIES = [
  "initial_publication",
  "material_update",
  "non_material_correction",
  "review_check",
  "removal",
] as const;
export const entryRevisionCategorySchema = z.enum(ENTRY_REVISION_CATEGORIES);
export type EntryRevisionCategory = z.infer<typeof entryRevisionCategorySchema>;

export const METHODOLOGY_VERSION_TYPES = ["major", "minor", "patch"] as const;
export const methodologyVersionTypeSchema = z.enum(METHODOLOGY_VERSION_TYPES);
export type MethodologyVersionType = z.infer<typeof methodologyVersionTypeSchema>;
