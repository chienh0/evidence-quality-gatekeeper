import type { EvidenceTierId } from "../../lib/types";

export interface TierRegressionCase {
  pmid: string;
  expectedTier: EvidenceTierId;
  note: string;
}

// Fixed, known-good PMIDs with manually-verified tiers (confirmed against
// the live PubMed API during development -- see conversation history). Fast
// and free to run (no Claude cost) since it only hits PubMed + local scoring
// logic, so this should run on every change to lib/scoring.ts.
export const TIER_REGRESSION_CASES: TierRegressionCase[] = [
  {
    pmid: "9500320",
    expectedTier: "X",
    note: "Wakefield 1998 Lancet paper -- retracted, must always be excluded.",
  },
  {
    pmid: "40511642",
    expectedTier: 1,
    note: "Cochrane systematic review / meta-analysis (probiotics in infants).",
  },
  {
    pmid: "7622647",
    expectedTier: 2,
    note: "Multicenter randomized controlled trial (quaternium-18 bentonite).",
  },
  {
    pmid: "7994440",
    expectedTier: 4,
    note: "Case report (poison ivy dermatitis).",
  },
  {
    pmid: "38925778",
    expectedTier: 5,
    note: "Narrative review with no stronger structured publication type.",
  },
];
