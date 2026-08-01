import { EVIDENCE_TIER_DEFINITIONS } from "@/lib/scoring";
import { tierColorClasses } from "./tierStyles";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      <div className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}

export default function Methodology() {
  return (
    <div className="max-w-3xl">
      <Section title="1. Retrieval">
        <p>
          Every query runs two PubMed searches: one by relevance, one restricted to systematic
          reviews, meta-analyses, and RCTs. Results are merged, high-tier hits first, so
          strong evidence isn&apos;t buried under case reports and opinion pieces.
        </p>
      </Section>

      <Section title="2. Scoring">
        <p>
          Each study is graded from PubMed&apos;s own{" "}
          <code className="text-xs">PublicationType</code>{" "}
          tags, not an LLM&apos;s guess.
          Retracted studies are excluded first; everything else gets the highest tier its tags
          match.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {EVIDENCE_TIER_DEFINITIONS.map((tier) => (
            <div
              key={String(tier.id)}
              className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    tierColorClasses[tier.color] ?? tierColorClasses.gray
                  }`}
                >
                  {tier.excluded ? tier.label : `Tier ${tier.id}: ${tier.label}`}
                </span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">{tier.rationale}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="3. Summarization">
        <ul className="list-disc list-inside space-y-1.5">
          <li>
            <strong>Naive summary:</strong>{" "}
            sees every study, unlabeled, including
            retracted ones. This is what a typical AI summarizer produces.
          </li>
          <li>
            <strong>Graded summary:</strong>{" "}
            sees only tier-labeled studies. Excluded
            studies&apos; text is never included, so retracted evidence can&apos;t leak in no
            matter what the model does. It&apos;s withheld, not just discouraged.
          </li>
        </ul>
      </Section>

      <Section title="Limitations">
        <ul className="list-disc list-inside space-y-1">
          <li>Tier reflects study design, not internal rigor (blinding, power, funding).</li>
          <li>Retraction detection can lag a real-world retraction.</li>
          <li>Replication status isn&apos;t assessed.</li>
          <li>PubMed&apos;s tagging is sometimes incomplete or inconsistent.</li>
        </ul>
      </Section>
    </div>
  );
}
