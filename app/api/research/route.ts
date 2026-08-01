import { NextRequest, NextResponse } from "next/server";
import { researchStudies } from "@/lib/pubmed";
import { naiveSummary, gradedSummary } from "@/lib/claude";
import type { ResearchResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  let query: string;
  try {
    const body = await req.json();
    query = typeof body?.query === "string" ? body.query.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!query) {
    return NextResponse.json({ error: "A query is required." }, { status: 400 });
  }

  let studies;
  try {
    studies = await researchStudies(query);
  } catch (err) {
    console.error("PubMed lookup failed:", err);
    return NextResponse.json(
      { error: "Failed to retrieve studies from PubMed. Please try again." },
      { status: 502 }
    );
  }

  if (studies.length === 0) {
    const response: ResearchResponse = {
      query,
      studies: [],
      naiveSummary: { text: "No sources were found for this query.", truncated: false },
      gradedSummary: { text: "No sources were found for this query.", truncated: false },
    };
    return NextResponse.json(response);
  }

  let naive, graded;
  try {
    [naive, graded] = await Promise.all([
      naiveSummary(query, studies),
      gradedSummary(query, studies),
    ]);
  } catch (err) {
    console.error("Claude summarization failed:", err);
    return NextResponse.json(
      { error: "Failed to generate summaries. Please try again." },
      { status: 502 }
    );
  }

  const response: ResearchResponse = {
    query,
    studies,
    naiveSummary: naive,
    gradedSummary: graded,
  };
  return NextResponse.json(response);
}
