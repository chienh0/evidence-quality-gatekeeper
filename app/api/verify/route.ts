import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { judgeFaithfulness } from "@/lib/judge";
import type { Study } from "@/lib/types";

// On-demand per-query faithfulness check: given the studies and graded
// summary the client already has from /api/research, re-checks whether the
// summary's claims are traceable to the included sources. Deliberately not
// run automatically on every /api/research call -- it's an extra Claude
// call, so it's a clinician-triggered action rather than a default cost.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { query, studies, summaryText } = (body ?? {}) as {
    query?: unknown;
    studies?: unknown;
    summaryText?: unknown;
  };

  if (typeof query !== "string" || !Array.isArray(studies) || typeof summaryText !== "string") {
    return NextResponse.json(
      { error: "query (string), studies (array), and summaryText (string) are required." },
      { status: 400 }
    );
  }

  const included = (studies as Study[]).filter((s) => !s.tier.excluded);
  if (included.length === 0) {
    return NextResponse.json({ faithful: true, issues: [] });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const verdict = await judgeFaithfulness(client, query, included, summaryText);
    return NextResponse.json(verdict);
  } catch (err) {
    console.error("Faithfulness verification failed:", err);
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 502 });
  }
}
