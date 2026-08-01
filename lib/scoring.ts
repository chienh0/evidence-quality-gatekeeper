import type { EvidenceTier, EvidenceTierId } from "./types";

export interface TierDef {
  id: EvidenceTierId;
  label: string;
  color: string;
  excluded: boolean;
  rationale: string;
  match: string[];
}

// Exported so the Methodology tab can render the real rubric instead of a
// hand-maintained copy that could drift out of sync with the scoring logic.
export const EVIDENCE_TIER_DEFINITIONS: TierDef[] = [
  {
    id: "X",
    label: "Excluded (Retracted)",
    color: "red",
    excluded: true,
    rationale: "Retracted or under an expression of concern. Never used as evidence.",
    match: ["Retracted Publication", "Retraction of Publication", "Expression of Concern"],
  },
  {
    id: 1,
    label: "Systematic Review / Meta-Analysis",
    color: "green",
    excluded: false,
    rationale: "Synthesizes many studies, generally the strongest evidence available.",
    match: ["Systematic Review", "Meta-Analysis"],
  },
  {
    id: 2,
    label: "Randomized Controlled Trial",
    color: "blue",
    excluded: false,
    rationale: "A randomized experiment, strong evidence though one trial can still be small or unreplicated.",
    match: [
      "Randomized Controlled Trial",
      "Controlled Clinical Trial",
      "Pragmatic Clinical Trial",
      "Adaptive Clinical Trial",
    ],
  },
  {
    id: 3,
    label: "Other Clinical / Observational Study",
    color: "yellow",
    excluded: false,
    rationale: "Observational, not randomized. Useful, but more prone to confounding.",
    match: [
      "Clinical Trial",
      "Clinical Trial, Phase I",
      "Clinical Trial, Phase II",
      "Clinical Trial, Phase III",
      "Clinical Trial, Phase IV",
      "Multicenter Study",
      "Comparative Study",
      "Observational Study",
      "Clinical Study",
    ],
  },
  {
    id: 4,
    label: "Case Report / Case Series",
    color: "orange",
    excluded: false,
    rationale: "One or a few patient cases, anecdotal and not generalizable.",
    match: ["Case Reports"],
  },
  {
    id: 5,
    label: "Review / Opinion / Unclassified",
    color: "gray",
    excluded: false,
    rationale: "Narrative review, opinion, or guideline, not a structured original study.",
    match: ["Review", "Editorial", "Comment", "Letter", "Practice Guideline"],
  },
];

// Administrative/metadata tags that PubMed attaches alongside the real
// study-design tag; ignored so they never mask the actual classification.
const IGNORE_TAGS = new Set([
  "Journal Article",
  "Research Support, N.I.H., Extramural",
  "Research Support, N.I.H., Intramural",
  "Research Support, Non-U.S. Gov't",
  "Research Support, U.S. Gov't, Non-P.H.S.",
  "Research Support, U.S. Gov't, P.H.S.",
  "English Abstract",
]);

function toTier(def: TierDef, rationaleOverride?: string): EvidenceTier {
  return {
    id: def.id,
    label: def.label,
    color: def.color,
    excluded: def.excluded,
    rationale: rationaleOverride ?? def.rationale,
  };
}

/**
 * Maps a study's raw PubMed PublicationType tags to an evidence tier.
 * Exclusion (retraction) is checked first and short-circuits everything else.
 * A study's tier is the highest (strongest) tier matched among its tags.
 */
export function scoreStudy(pubTypes: string[]): EvidenceTier {
  const relevant = pubTypes.filter((t) => !IGNORE_TAGS.has(t));

  const excludedDef = EVIDENCE_TIER_DEFINITIONS[0];
  if (relevant.some((t) => excludedDef.match.includes(t))) {
    return toTier(excludedDef);
  }

  for (const def of EVIDENCE_TIER_DEFINITIONS.slice(1)) {
    if (relevant.some((t) => def.match.includes(t))) {
      return toTier(def);
    }
  }

  const fallback = EVIDENCE_TIER_DEFINITIONS[EVIDENCE_TIER_DEFINITIONS.length - 1];
  return toTier(fallback, "No recognized study-type tag, treated as unclassified.");
}
