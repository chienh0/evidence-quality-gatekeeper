"use client";

import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Study, SummaryResult } from "@/lib/types";
import type { FaithfulnessVerdict } from "@/lib/judge";

// Claude sometimes opens a summary with "#" and other times "##" -- left to
// the typography plugin's default scale, that made the two panels' headings
// wildly different sizes. Every heading level is normalized to the same
// small, uppercase section-label style so the two panels always match
// regardless of which level the model happened to pick.
const markdownComponents: Components = {
  h1: ({ children }) => (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mt-4 mb-1.5 first:mt-0">
      {children}
    </h4>
  ),
  h2: ({ children }) => (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mt-4 mb-1.5 first:mt-0">
      {children}
    </h4>
  ),
  h3: ({ children }) => (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mt-4 mb-1.5 first:mt-0">
      {children}
    </h4>
  ),
  h4: ({ children }) => (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mt-4 mb-1.5 first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => <p className="text-sm leading-relaxed my-2">{children}</p>,
  ul: ({ children }) => <ul className="text-sm list-disc list-outside pl-5 my-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="text-sm list-decimal list-outside pl-5 my-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
      {children}
    </a>
  ),
};

function VerifyBlock({ query, studies, summaryText }: { query: string; studies: Study[]; summaryText: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [verdict, setVerdict] = useState<FaithfulnessVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runVerify() {
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, studies, summaryText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Verification failed.");
      setVerdict(data as FaithfulnessVerdict);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      setState("error");
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-900">
      {state === "idle" && (
        <button
          onClick={runVerify}
          className="text-xs font-medium text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800 rounded-md px-2.5 py-1 hover:bg-green-100 dark:hover:bg-green-950/40"
        >
          Verify this summary
        </button>
      )}
      {state === "loading" && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Checking claims against the included sources…
        </p>
      )}
      {state === "error" && (
        <div className="text-xs text-red-700 dark:text-red-400">
          {error}{" "}
          <button onClick={runVerify} className="underline">
            Retry
          </button>
        </div>
      )}
      {state === "done" && verdict && (
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            verdict.faithful && verdict.issues.length === 0
              ? "border-green-300 bg-green-50 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300"
              : "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300"
          }`}
        >
          {verdict.faithful && verdict.issues.length === 0 ? (
            <p>No unsupported claims found — this summary&apos;s claims trace back to the sources above.</p>
          ) : (
            <>
              <p className="font-medium mb-1">Potential issues found:</p>
              <ul className="list-disc list-inside space-y-1">
                {verdict.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  summary,
  tone,
  query,
  studies,
}: {
  title: string;
  subtitle: string;
  summary: SummaryResult;
  tone: "naive" | "graded";
  query: string;
  studies: Study[];
}) {
  const toneClasses =
    tone === "naive"
      ? "border-neutral-300 dark:border-neutral-700"
      : "border-green-300 dark:border-green-800 bg-green-50/40 dark:bg-green-950/10";

  return (
    <div className={`rounded-lg border p-4 flex-1 min-w-0 ${toneClasses}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">{subtitle}</p>
      {summary.truncated && (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          This summary was cut off before finishing. Treat it as incomplete rather than a full
          answer.
        </div>
      )}
      <div className="text-neutral-800 dark:text-neutral-200">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {summary.text}
        </ReactMarkdown>
      </div>
      {tone === "graded" && !summary.truncated && (
        <VerifyBlock query={query} studies={studies} summaryText={summary.text} />
      )}
    </div>
  );
}

export default function SummaryComparison({
  naive,
  graded,
  query,
  studies,
}: {
  naive: SummaryResult;
  graded: SummaryResult;
  query: string;
  studies: Study[];
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Naive vs. quality-graded summary</h2>
      <div className="flex flex-col md:flex-row gap-3">
        <Panel
          title="Naive summary"
          subtitle="Every source treated as equally credible, including retracted or low-tier ones."
          summary={naive}
          tone="naive"
          query={query}
          studies={studies}
        />
        <Panel
          title="Quality-graded summary"
          subtitle="Weighted toward systematic reviews/RCTs; retracted sources structurally excluded, not just instructed away."
          summary={graded}
          tone="graded"
          query={query}
          studies={studies}
        />
      </div>
    </section>
  );
}
