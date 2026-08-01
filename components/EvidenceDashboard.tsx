import type { Study } from "@/lib/types";
import StudyCard from "./StudyCard";

// Sort order: best evidence first (Tier 1 -> 5), excluded/retracted studies
// last -- still fully visible, never hidden, just deprioritized.
function sortStudies(studies: Study[]): Study[] {
  return [...studies].sort((a, b) => {
    const rank = (s: Study) => (s.tier.excluded ? 99 : (s.tier.id as number));
    return rank(a) - rank(b);
  });
}

export default function EvidenceDashboard({ studies }: { studies: Study[] }) {
  const sorted = sortStudies(studies);
  const excludedCount = studies.filter((s) => s.tier.excluded).length;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-semibold">
          Retrieved evidence ({studies.length} source{studies.length === 1 ? "" : "s"})
        </h2>
        {excludedCount > 0 && (
          <span className="text-xs text-red-700 dark:text-red-400">
            {excludedCount} excluded (retracted), shown below for transparency but not used in the
            graded summary
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.map((study) => (
          <StudyCard key={study.pmid} study={study} />
        ))}
      </div>
    </section>
  );
}
