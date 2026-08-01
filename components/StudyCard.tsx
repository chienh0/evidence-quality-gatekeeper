import type { Study } from "@/lib/types";
import { tierColorClasses, tierBorderClasses } from "./tierStyles";

export default function StudyCard({ study }: { study: Study }) {
  const badgeClasses = tierColorClasses[study.tier.color] ?? tierColorClasses.gray;
  const borderClasses = tierBorderClasses[study.tier.color] ?? tierBorderClasses.gray;

  return (
    <div
      className={`rounded-lg border p-4 ${borderClasses} ${
        study.tier.excluded ? "bg-red-50/50 dark:bg-red-950/20" : "bg-white dark:bg-neutral-900"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeClasses}`}
        >
          {study.tier.excluded ? study.tier.label : `Tier ${study.tier.id}: ${study.tier.label}`}
        </span>
        {study.pubYear && (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{study.pubYear}</span>
        )}
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{study.journal}</span>
      </div>

      <h3
        className={`text-sm font-semibold mb-1 ${
          study.tier.excluded ? "line-through decoration-red-400 text-neutral-500" : ""
        }`}
      >
        {study.title}
      </h3>

      <p className="text-xs text-neutral-600 dark:text-neutral-400 italic mb-2">
        {study.tier.rationale}
      </p>

      <p className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-4">
        {study.abstract}
      </p>

      <a
        href={`https://pubmed.ncbi.nlm.nih.gov/${study.pmid}/`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        View on PubMed (PMID {study.pmid}) ↗
      </a>
    </div>
  );
}
