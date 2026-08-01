import evalResults from "@/data/eval-results.json";

interface TierRegressionCase {
  pmid: string;
  expectedTier: string;
  actualTier: string | null;
  pass: boolean;
  note: string;
}

interface QueryResult {
  id: string;
  query: string;
  category: string;
  studyCount: number;
  excludedCount: number;
  naiveTruncated: boolean;
  gradedTruncated: boolean;
  leakedTitles: string[];
  judge?: { faithful: boolean; issues: string[] };
  pass: boolean;
  failReasons: string[];
}

function Badge({ pass }: { pass: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        pass
          ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
          : "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
      }`}
    >
      {pass ? "PASS" : "FAIL"}
    </span>
  );
}

export default function Evaluation() {
  const data = evalResults as {
    generatedAt: string;
    judgeEnabled: boolean;
    tierRegression: { pass: boolean; cases: TierRegressionCase[] };
    queries: QueryResult[];
  };

  const hasRun = data.generatedAt !== "1970-01-01T00:00:00.000Z" && data.queries.length > 0;

  if (!hasRun) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          No eval run recorded yet. Run the golden-set suite locally with:
        </p>
        <pre className="mt-2 text-xs bg-neutral-100 dark:bg-neutral-900 rounded-md p-3 overflow-x-auto">
          npx tsx --env-file=.env.local scripts/eval/run.ts
        </pre>
      </div>
    );
  }

  const passCount = data.queries.filter((q) => q.pass).length;
  const categories = Array.from(new Set(data.queries.map((q) => q.category)));

  return (
    <div className="max-w-3xl">
      <section className="mb-8">
        <h3 className="text-base font-semibold mb-2">System track record</h3>
        <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-3">
          Results from the last golden-set run against a fixed set of queries chosen to stress
          different evidence conditions (clean evidence, sparse evidence, contradictory
          literature, high-stakes dosing, and adversarial retracted-heavy queries), plus a
          regression check against known-correct evidence-tier classifications.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-neutral-500 dark:text-neutral-400">Golden queries: </span>
            <span className="font-medium">
              {passCount}/{data.queries.length} passed
            </span>
          </div>
          <div>
            <span className="text-neutral-500 dark:text-neutral-400">Tier regression: </span>
            <Badge pass={data.tierRegression.pass} />
          </div>
          <div>
            <span className="text-neutral-500 dark:text-neutral-400">Last run: </span>
            <span className="font-medium">{new Date(data.generatedAt).toLocaleString()}</span>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-base font-semibold mb-2">Tier classification regression</h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
          Fixed, manually-verified PMIDs (including a known-retracted paper) that must classify
          to the same tier on every run. Free to run, no Claude cost.
        </p>
        <div className="flex flex-col gap-2">
          {data.tierRegression.cases.map((c) => (
            <div
              key={c.pmid}
              className="flex items-center justify-between rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  PMID {c.pmid}
                </span>{" "}
                <span className="text-neutral-700 dark:text-neutral-300">{c.note}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  expected {c.expectedTier}, got {c.actualTier ?? "—"}
                </span>
                <Badge pass={c.pass} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-base font-semibold mb-2">Golden query results</h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
          Each query checks: no truncated summaries, no excluded/retracted content leaking into
          the graded summary, and{data.judgeEnabled ? " a faithfulness judge pass on the graded summary's claims." : " (faithfulness judge was disabled for this run)."}
        </p>
        <div className="flex flex-col gap-3">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1.5">
                {cat}
              </p>
              <div className="flex flex-col gap-2">
                {data.queries
                  .filter((q) => q.category === cat)
                  .map((q) => (
                    <div
                      key={q.id}
                      className="rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{q.query}</span>
                        <Badge pass={q.pass} />
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {q.studyCount} studies, {q.excludedCount} excluded
                      </p>
                      {q.failReasons.length > 0 && (
                        <ul className="mt-1 list-disc list-inside text-xs text-red-700 dark:text-red-400 space-y-0.5">
                          {q.failReasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
