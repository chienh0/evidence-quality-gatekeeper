import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SummaryResult } from "@/lib/types";

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

function Panel({
  title,
  subtitle,
  summary,
  tone,
}: {
  title: string;
  subtitle: string;
  summary: SummaryResult;
  tone: "naive" | "graded";
}) {
  const toneClasses =
    tone === "naive"
      ? "border-neutral-300 dark:border-neutral-700"
      : "border-green-300 dark:border-green-800 bg-green-50/40 dark:bg-green-950/10";

  return (
    <div className={`rounded-lg border p-4 flex-1 min-w-0 ${toneClasses}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">{subtitle}</p>
      <div className="text-neutral-800 dark:text-neutral-200">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {summary.text}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default function SummaryComparison({
  naive,
  graded,
}: {
  naive: SummaryResult;
  graded: SummaryResult;
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
        />
        <Panel
          title="Quality-graded summary"
          subtitle="Weighted toward systematic reviews/RCTs; retracted sources structurally excluded, not just instructed away."
          summary={graded}
          tone="graded"
        />
      </div>
    </section>
  );
}
