// Golden-set eval runner. Not part of the app -- run manually or in CI with:
//   npx tsx --env-file=.env.local scripts/eval/run.ts [--no-judge]
//
// Exits non-zero if anything fails, so it can gate a deploy.

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { researchStudies, fetchStudies } from "../../lib/pubmed";
import { naiveSummary, gradedSummary } from "../../lib/claude";
import { judgeFaithfulness } from "../../lib/judge";
import type { Study } from "../../lib/types";
import { GOLDEN_QUERIES, type GoldenQuery } from "./queries";
import { TIER_REGRESSION_CASES } from "./tierRegression";

interface QueryEvalResult {
  id: string;
  query: string;
  category: string;
  timestamp: string;
  studyCount: number;
  excludedCount: number;
  naiveTruncated: boolean;
  gradedTruncated: boolean;
  leakedTitles: string[];
  judge?: { faithful: boolean; issues: string[] };
  pass: boolean;
  failReasons: string[];
}

interface TierRegressionCaseResult {
  pmid: string;
  expectedTier: string;
  actualTier: string | null;
  pass: boolean;
  note: string;
}

async function runTierRegression(): Promise<{
  pass: boolean;
  lines: string[];
  cases: TierRegressionCaseResult[];
}> {
  const pmids = TIER_REGRESSION_CASES.map((c) => c.pmid);
  const studies = await fetchStudies(pmids);
  const byPmid = new Map(studies.map((s) => [s.pmid, s]));
  const lines: string[] = [];
  const cases: TierRegressionCaseResult[] = [];
  let pass = true;

  for (const c of TIER_REGRESSION_CASES) {
    const study = byPmid.get(c.pmid);
    if (!study) {
      pass = false;
      lines.push(`FAIL  PMID ${c.pmid}: not returned by EFetch (${c.note})`);
      cases.push({
        pmid: c.pmid,
        expectedTier: String(c.expectedTier),
        actualTier: null,
        pass: false,
        note: c.note,
      });
      continue;
    }
    const casePass = study.tier.id === c.expectedTier;
    pass = pass && casePass;
    lines.push(
      casePass
        ? `PASS  PMID ${c.pmid}: tier ${study.tier.id} as expected`
        : `FAIL  PMID ${c.pmid}: expected tier ${c.expectedTier}, got ${study.tier.id} (${c.note})`
    );
    cases.push({
      pmid: c.pmid,
      expectedTier: String(c.expectedTier),
      actualTier: String(study.tier.id),
      pass: casePass,
      note: c.note,
    });
  }
  return { pass, lines, cases };
}

async function evalQuery(
  client: Anthropic,
  gq: GoldenQuery,
  runJudge: boolean
): Promise<QueryEvalResult> {
  const timestamp = new Date().toISOString();
  const failReasons: string[] = [];

  let studies: Study[];
  try {
    studies = await researchStudies(gq.query);
  } catch (err) {
    return {
      id: gq.id,
      query: gq.query,
      category: gq.category,
      timestamp,
      studyCount: 0,
      excludedCount: 0,
      naiveTruncated: false,
      gradedTruncated: false,
      leakedTitles: [],
      pass: false,
      failReasons: [`PubMed retrieval threw: ${(err as Error).message}`],
    };
  }

  if (gq.category === "empty") {
    const pass = studies.length === 0;
    return {
      id: gq.id,
      query: gq.query,
      category: gq.category,
      timestamp,
      studyCount: studies.length,
      excludedCount: 0,
      naiveTruncated: false,
      gradedTruncated: false,
      leakedTitles: [],
      pass,
      failReasons: pass ? [] : [`Expected 0 studies for a nonsense query, got ${studies.length}`],
    };
  }

  const excluded = studies.filter((s) => s.tier.excluded);
  const [naive, graded] = await Promise.all([
    naiveSummary(gq.query, studies),
    gradedSummary(gq.query, studies),
  ]);

  if (naive.truncated) failReasons.push("Naive summary was truncated (hit max_tokens)");
  if (graded.truncated) failReasons.push("Graded summary was truncated (hit max_tokens)");

  const leakedTitles = excluded
    .filter(
      (s) =>
        graded.text.includes(s.pmid) ||
        graded.text.toLowerCase().includes(s.title.slice(0, 40).toLowerCase())
    )
    .map((s) => s.title);
  if (leakedTitles.length > 0) {
    failReasons.push(`Excluded study content leaked into graded summary: ${leakedTitles.join("; ")}`);
  }

  let judge: { faithful: boolean; issues: string[] } | undefined;
  const included = studies.filter((s) => !s.tier.excluded);
  if (runJudge && included.length > 0) {
    judge = await judgeFaithfulness(client, gq.query, included, graded.text);
    if (!judge.faithful) {
      failReasons.push(`Faithfulness judge flagged issues: ${judge.issues.join("; ")}`);
    }
  }

  return {
    id: gq.id,
    query: gq.query,
    category: gq.category,
    timestamp,
    studyCount: studies.length,
    excludedCount: excluded.length,
    naiveTruncated: naive.truncated,
    gradedTruncated: graded.truncated,
    leakedTitles,
    judge,
    pass: failReasons.length === 0,
    failReasons,
  };
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "ANTHROPIC_API_KEY is not set. Run with:\n  npx tsx --env-file=.env.local scripts/eval/run.ts"
    );
    process.exit(1);
  }
  const client = new Anthropic({ apiKey });
  const runJudge = !process.argv.includes("--no-judge");

  console.log("=== Tier classification regression (no Claude cost) ===");
  const tierResult = await runTierRegression();
  tierResult.lines.forEach((l) => console.log(l));
  console.log();

  console.log(`=== Golden query eval (${GOLDEN_QUERIES.length} queries, judge ${runJudge ? "on" : "off"}) ===`);
  const results: QueryEvalResult[] = [];
  for (const [i, gq] of GOLDEN_QUERIES.entries()) {
    // Paced to stay under PubMed's ~3 req/sec unauthenticated rate limit --
    // lib/pubmed.ts retries transient 429s too, but running 12 queries back
    // to back with no delay reliably trips the limit regardless.
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1200));
    process.stdout.write(`  ${gq.id.padEnd(24)} `);
    const result = await evalQuery(client, gq, runJudge);
    results.push(result);
    console.log(result.pass ? "PASS" : `FAIL: ${result.failReasons.join(" | ")}`);
  }

  const passCount = results.filter((r) => r.pass).length;
  const allPass = tierResult.pass && passCount === results.length;

  console.log();
  console.log(
    `=== Summary: ${passCount}/${results.length} queries passed, tier regression ${
      tierResult.pass ? "PASS" : "FAIL"
    } ===`
  );

  const logDir = path.join(__dirname, "results");
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `${timestampForFilename()}.jsonl`);
  fs.writeFileSync(logPath, results.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`Results logged to ${path.relative(process.cwd(), logPath)}`);

  // Fixed-path snapshot, committed to git (unlike the timestamped JSONL logs
  // above) so the deployed app's Evaluation tab can display the latest run
  // without needing to execute the eval suite itself.
  const snapshotPath = path.join(__dirname, "..", "..", "data", "eval-results.json");
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(
    snapshotPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        judgeEnabled: runJudge,
        tierRegression: { pass: tierResult.pass, cases: tierResult.cases },
        queries: results,
      },
      null,
      2
    ) + "\n"
  );
  console.log(`Snapshot written to ${path.relative(process.cwd(), snapshotPath)}`);

  process.exit(allPass ? 0 : 1);
}

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

main();
