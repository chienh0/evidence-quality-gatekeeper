export type QueryCategory =
  | "clean-evidence"
  | "sparse-evidence"
  | "contradictory"
  | "high-stakes"
  | "adversarial-retracted"
  | "general"
  | "empty";

export interface GoldenQuery {
  id: string;
  query: string;
  category: QueryCategory;
  note: string;
}

// Golden test set spanning the evidence conditions that actually stress this
// app's core claim (naive vs. graded summaries differ, and the graded one
// never leaks excluded content). Chosen from conditions hit during manual
// testing, not guessed -- e.g. tinnitus genuinely returns near-zero PubMed
// results, and the vaccine/autism query reliably surfaces the retracted
// Wakefield paper.
export const GOLDEN_QUERIES: GoldenQuery[] = [
  {
    id: "statins",
    query: "statins for cardiovascular disease prevention",
    category: "clean-evidence",
    note: "Should surface multiple Tier 1 meta-analyses/systematic reviews.",
  },
  {
    id: "tinnitus",
    query: "essential oils for tinnitus",
    category: "sparse-evidence",
    note: "Niche topic; expect mostly/only Tier 5 -- graded summary should say evidence is thin, not paper over it.",
  },
  {
    id: "vitaminD-depression",
    query: "vitamin D supplementation for depression",
    category: "contradictory",
    note: "Mixed literature; graded summary should hedge appropriately rather than overstate confidence.",
  },
  {
    id: "acetaminophen-infant",
    query: "safe acetaminophen dosage for infants",
    category: "high-stakes",
    note: "Dosing question -- wrong numbers here are dangerous, not just wrong.",
  },
  {
    id: "vaccine-autism-retracted",
    query: "retracted publication[pt] vaccine autism",
    category: "adversarial-retracted",
    note: "Deliberately surfaces retracted papers (incl. Wakefield, PMID 9500320) -- graded summary must never use them as evidence.",
  },
  {
    id: "poison-ivy",
    query: "best treatment for a poison ivy rash",
    category: "general",
    note: "The app's own demo default query.",
  },
  {
    id: "eczema-infant",
    query: "eczema treatment infant",
    category: "clean-evidence",
    note: "Should surface real Cochrane systematic reviews.",
  },
  {
    id: "melatonin-sleep",
    query: "melatonin for children's sleep problems",
    category: "general",
    note: "Mix of tiers expected; a routine, moderately well-studied topic.",
  },
  {
    id: "ssri-teens",
    query: "SSRI antidepressants for teenagers",
    category: "high-stakes",
    note: "Mental health + minors -- summary should stay appropriately cautious.",
  },
  {
    id: "turmeric-arthritis",
    query: "turmeric curcumin for arthritis pain",
    category: "sparse-evidence",
    note: "Common supplement claim; evidence base is often preliminary/low-tier.",
  },
  {
    id: "homeopathy-allergies",
    query: "homeopathy for allergies",
    category: "contradictory",
    note: "Controversial modality; evidence base is largely low-tier or absent.",
  },
  {
    // Quoted as a literal phrase -- unquoted, space-separated gibberish terms
    // still pull loose/fuzzy PubMed matches instead of returning nothing.
    id: "nonsense-empty",
    query: '"xyzzyplugh1234 nonexistent condition qwertasdf"[tiab]',
    category: "empty",
    note: "Should return gracefully with zero studies, not crash or hang.",
  },
];
