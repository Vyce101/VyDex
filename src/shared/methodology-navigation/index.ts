// Defines stable Methodology section fragments and immutable help-link construction.
export const METHODOLOGY_SECTION_IDS = Object.freeze({
  inclusionStandard: "inclusion-standard",
  claimAppraisal: "claim-appraisal",
  claimStatus: "claim-status",
  evidenceStrength: "evidence-strength",
  reviewStatus: "review-status",
  entryState: "entry-state",
  frontierDelta: "frontier-delta",
  significance: "significance",
  caveats: "caveats",
  sourcesAndEvidenceTypes: "sources-and-evidence-types",
  evidenceTypes: "evidence-types",
  usedFor: "used-for",
  sourceRoles: "source-roles",
  datesAndEvidenceMonitoring: "dates-and-evidence-monitoring",
  topicTrails: "topic-trails",
  domains: "domains",
  entryTitles: "entry-titles",
  versioning: "versioning",
} as const);

export type MethodologySectionId = (typeof METHODOLOGY_SECTION_IDS)[keyof typeof METHODOLOGY_SECTION_IDS];

export const METHODOLOGY_JUMP_LINKS = Object.freeze([
  { label: "Inclusion Standard", id: METHODOLOGY_SECTION_IDS.inclusionStandard },
  { label: "Claim Appraisal", id: METHODOLOGY_SECTION_IDS.claimAppraisal },
  { label: "Claim Status", id: METHODOLOGY_SECTION_IDS.claimStatus },
  { label: "Evidence Strength", id: METHODOLOGY_SECTION_IDS.evidenceStrength },
  { label: "Review Status", id: METHODOLOGY_SECTION_IDS.reviewStatus },
  { label: "Entry State", id: METHODOLOGY_SECTION_IDS.entryState },
  { label: "Frontier Delta", id: METHODOLOGY_SECTION_IDS.frontierDelta },
  { label: "Significance", id: METHODOLOGY_SECTION_IDS.significance },
  { label: "Caveats", id: METHODOLOGY_SECTION_IDS.caveats },
  {
    label: "Sources and Evidence Types",
    id: METHODOLOGY_SECTION_IDS.sourcesAndEvidenceTypes,
  },
  {
    label: "Dates and Evidence Monitoring",
    id: METHODOLOGY_SECTION_IDS.datesAndEvidenceMonitoring,
  },
  { label: "Topic Trails", id: METHODOLOGY_SECTION_IDS.topicTrails },
  { label: "Domains", id: METHODOLOGY_SECTION_IDS.domains },
  { label: "Entry Titles", id: METHODOLOGY_SECTION_IDS.entryTitles },
  { label: "Versioning", id: METHODOLOGY_SECTION_IDS.versioning },
] as const);

export function createMethodologySectionUrl(
  versionUrl: string,
  sectionId: MethodologySectionId,
): string {
  const url = new URL(versionUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Methodology section links require an HTTP(S) version URL.");
  }
  url.hash = sectionId;
  return url.toString();
}
