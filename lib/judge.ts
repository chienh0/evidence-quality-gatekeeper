import Anthropic from "@anthropic-ai/sdk";
import type { Study } from "./types";

export interface FaithfulnessVerdict {
  faithful: boolean;
  issues: string[];
}

// Used both by the offline eval suite (scripts/eval/run.ts) and the
// production /api/verify route -- deliberately a separate, cheaper model in
// a separate context from the summarizer, so it isn't grading its own
// homework in the same breath.
const JUDGE_MODEL = "claude-haiku-4-5";

const JUDGE_SYSTEM = `You are a fact-checking assistant reviewing a medical evidence summary for hallucinated or unsupported claims.

You will be given a list of source studies (title + abstract, each already labeled with an evidence tier by the calling application), and a summary that claims to synthesize them. The tier labels (e.g. "Tier 1", "Tier 2") are metadata the application assigned before the summary was written -- the summary referencing or weighting by those tiers is expected, correct behavior, not an unsupported claim. Do not flag tier language itself as a problem.

Only flag a claim if it asserts something the sources don't actually say: a fabricated statistic, a named finding no source reports, a numeric result that contradicts what a cited source states, or a source's conclusion reversed or overstated beyond what it supports. General synthesis language, transitions, appropriate hedging ("evidence is limited", "may help"), and reasonable summarization of a source's finding (even without every numeric detail like a confidence interval) are not issues.`;

const VERDICT_SCHEMA = {
  type: "object" as const,
  properties: {
    faithful: { type: "boolean" as const },
    issues: { type: "array" as const, items: { type: "string" as const } },
  },
  required: ["faithful", "issues"],
  additionalProperties: false,
};

function formatSource(s: Study): string {
  const tierLabel = s.tier.excluded ? "Excluded" : `Tier ${s.tier.id}`;
  return `[${tierLabel}] ${s.title} (${s.pubYear ?? "n.d."})\n${s.abstract}`;
}

export async function judgeFaithfulness(
  client: Anthropic,
  query: string,
  includedStudies: Study[],
  summaryText: string
): Promise<FaithfulnessVerdict> {
  const sourcesBlock = includedStudies.map((s, i) => `${i + 1}. ${formatSource(s)}`).join("\n\n");

  const message = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 1024,
    system: JUDGE_SYSTEM,
    output_config: {
      format: { type: "json_schema", schema: VERDICT_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: `Health question: ${query}\n\nSource studies (each pre-labeled with its evidence tier by the application):\n\n${sourcesBlock}\n\nSummary to check:\n\n${summaryText}`,
      },
    ],
  });

  const textBlock = message.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  if (!textBlock) {
    return { faithful: true, issues: ["Judge produced no text output -- skipped."] };
  }
  try {
    return JSON.parse(textBlock.text) as FaithfulnessVerdict;
  } catch {
    return { faithful: true, issues: ["Judge output was not valid JSON -- skipped."] };
  }
}
