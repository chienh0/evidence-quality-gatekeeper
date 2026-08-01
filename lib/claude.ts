import Anthropic from "@anthropic-ai/sdk";
import type { Study, SummaryResult } from "./types";

const MODEL = "claude-sonnet-5";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({ apiKey });
}

const NAIVE_SYSTEM = `You are a medical research assistant. You will be given a list of research sources (title + abstract) related to a health question. Write a concise, well-organized summary of what these sources say, synthesizing across all of them as equally credible evidence. Do not comment on study design, sample size, or evidence quality -- treat every source the same regardless of its type.`;

const GRADED_SYSTEM = `You are a medical research assistant practicing critical appraisal. You will be given a list of research sources related to a health question, each labeled with an evidence tier (Tier 1 = systematic review/meta-analysis, strongest, down to Tier 5 = review/opinion/unclassified, weakest). Some low-credibility sources (e.g. retracted publications) have already been excluded and are not shown to you at all -- only a count is provided.

Instructions:
- Weight your synthesis toward higher tiers. Tier 1-2 evidence should drive your main conclusions; Tier 4-5 evidence should be mentioned only as weak/anecdotal signal, clearly labeled as such.
- If the available evidence is thin, conflicting, or dominated by low tiers, say so explicitly and avoid overstating confidence.
- Cite each claim with the source's tier and title inline, e.g. "(Tier 2 RCT: <title>)".
- The prompt will always state exactly how many sources were excluded, even if zero. Only mention exclusions in your answer if that count is greater than zero; if it is zero, don't comment on exclusions at all.`;

function formatForNaive(query: string, studies: Study[]): string {
  const body = studies
    .map((s, i) => `${i + 1}. ${s.title} (${s.pubYear ?? "n.d."})\n${s.abstract}`)
    .join("\n\n");
  return `Health question: ${query}\n\nSources:\n\n${body}`;
}

function formatForGraded(query: string, includedStudies: Study[], excludedCount: number): string {
  const body = includedStudies
    .map(
      (s, i) =>
        `${i + 1}. [Tier ${s.tier.id} -- ${s.tier.label}] ${s.title} (${s.pubYear ?? "n.d."})\n${s.abstract}`
    )
    .join("\n\n");

  const exclusionNote =
    excludedCount > 0
      ? `\n\nNote: ${excludedCount} additional source(s) were excluded from consideration (reason: retracted publication) and are deliberately not included above.`
      : `\n\nNote: 0 sources were excluded from consideration.`;

  return `Health question: ${query}\n\nSources, each labeled with an evidence tier:\n\n${body}${exclusionNote}`;
}

function extractText(message: Anthropic.Message, label: string): string {
  if (message.stop_reason === "max_tokens") {
    console.warn(`${label} summary hit max_tokens and was truncated mid-response.`);
  }
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

export async function naiveSummary(query: string, studies: Study[]): Promise<SummaryResult> {
  if (studies.length === 0) {
    return { text: "No sources were found for this query." };
  }
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    // Claude Sonnet 5 runs adaptive thinking by default when `thinking` is
    // omitted, and thinking tokens count against max_tokens even though
    // they're invisible -- a low cap here truncates the visible summary
    // mid-sentence before it finishes, not just runs long summaries short.
    max_tokens: 2048,
    system: NAIVE_SYSTEM,
    messages: [{ role: "user", content: formatForNaive(query, studies) }],
  });
  return { text: extractText(message, "Naive") };
}

/**
 * Builds the graded summary. Excluded (e.g. retracted) studies' abstract text
 * is never placed in this prompt -- only a count and reason are passed -- so
 * leakage into the output is structurally impossible, not merely discouraged
 * by instruction.
 */
export async function gradedSummary(query: string, studies: Study[]): Promise<SummaryResult> {
  const included = studies.filter((s) => !s.tier.excluded);
  const excludedCount = studies.length - included.length;

  if (included.length === 0) {
    return {
      text:
        excludedCount > 0
          ? `No usable evidence was found: all ${excludedCount} retrieved source(s) were excluded (retracted publications).`
          : "No sources were found for this query.",
    };
  }

  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: GRADED_SYSTEM,
    messages: [{ role: "user", content: formatForGraded(query, included, excludedCount) }],
  });
  return { text: extractText(message, "Graded") };
}
