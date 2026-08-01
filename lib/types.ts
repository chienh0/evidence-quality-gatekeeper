export type EvidenceTierId = "X" | 1 | 2 | 3 | 4 | 5;

export interface EvidenceTier {
  id: EvidenceTierId;
  label: string;
  color: string;
  excluded: boolean;
  rationale: string;
}

export interface Study {
  pmid: string;
  title: string;
  abstract: string;
  journal: string;
  pubYear: number | null;
  pubTypes: string[];
  tier: EvidenceTier;
}

export interface SummaryResult {
  text: string;
}

export interface ResearchResponse {
  query: string;
  studies: Study[];
  naiveSummary: SummaryResult;
  gradedSummary: SummaryResult;
}
