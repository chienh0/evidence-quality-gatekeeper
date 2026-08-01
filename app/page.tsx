"use client";

import { useState } from "react";
import type { ResearchResponse } from "@/lib/types";
import EvidenceDashboard from "@/components/EvidenceDashboard";
import SummaryComparison from "@/components/SummaryComparison";
import Methodology from "@/components/Methodology";
import Evaluation from "@/components/Evaluation";

const DEMO_QUERY = "best treatment for a poison ivy rash";

type Tab = "research" | "methodology" | "evaluation";

export default function Home() {
  const [tab, setTab] = useState<Tab>("research");
  const [query, setQuery] = useState(DEMO_QUERY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResponse | null>(null);

  async function runQuery(q: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Something went wrong.");
      }
      setResult(data as ResearchResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) runQuery(query.trim());
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "research", label: "Research" },
    { id: "methodology", label: "Methodology" },
    { id: "evaluation", label: "Evaluation" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-black dark:text-zinc-50">
      <main className="mx-auto max-w-4xl px-6 py-10 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold">Evidence-Quality Gatekeeper</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 max-w-2xl">
            Ask a health question. Real studies are pulled from PubMed and graded by evidence
            tier using PubMed&apos;s own study-type metadata, before any AI summary is
            allowed to use them.
          </p>
        </header>

        <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-black dark:border-white text-black dark:text-white"
                  : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "methodology" && <Methodology />}
        {tab === "evaluation" && <Evaluation />}

        {tab === "research" && (
          <div className="flex flex-col gap-8">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. best treatment for a poison ivy rash"
                className="flex-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-black dark:bg-white text-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Researching…" : "Research"}
              </button>
            </form>

            {error && (
              <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {result && (
              <div className="flex flex-col gap-8">
                <SummaryComparison
                  naive={result.naiveSummary}
                  graded={result.gradedSummary}
                  query={result.query}
                  studies={result.studies}
                />
                <EvidenceDashboard studies={result.studies} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
