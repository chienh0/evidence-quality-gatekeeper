import { XMLParser } from "fast-xml-parser";
import type { Study } from "./types";
import { scoreStudy } from "./scoring";

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function ncbiParams(extra: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams(extra);
  const tool = process.env.NCBI_TOOL;
  const email = process.env.NCBI_EMAIL;
  const apiKey = process.env.NCBI_API_KEY;
  if (tool) params.set("tool", tool);
  if (email) params.set("email", email);
  if (apiKey) params.set("api_key", apiKey);
  return params;
}

async function esearch(term: string, retmax: number): Promise<string[]> {
  const params = ncbiParams({
    db: "pubmed",
    term,
    retmode: "json",
    retmax: String(retmax),
    sort: "relevance",
  });
  const res = await fetch(`${EUTILS_BASE}/esearch.fcgi?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`PubMed ESearch failed: ${res.status} ${res.statusText}`);
  }
  const data: unknown = await res.json();
  const idlist = getPath(data, ["esearchresult", "idlist"]);
  return Array.isArray(idlist) ? idlist.filter((id): id is string => typeof id === "string") : [];
}

/**
 * Runs two searches: a default relevance search, and a search targeted at
 * PubMed's own high-tier filters (systematic reviews / meta-analyses / RCTs).
 * A plain relevance sort can return a page with zero high-tier sources even
 * when strong evidence exists elsewhere in PubMed, so retrieval, not just
 * scoring, actively surfaces it. High-tier hits are merged first so a later
 * cap on result count keeps them over lower-priority default hits.
 */
export async function searchPubMed(query: string, maxResults = 20): Promise<string[]> {
  const highTierTerm = `${query} AND (systematic[sb] OR Meta-Analysis[pt] OR "Randomized Controlled Trial"[pt])`;

  const [highTierIds, defaultIds] = await Promise.all([
    esearch(highTierTerm, 10),
    esearch(query, 15),
  ]);

  const merged = Array.from(new Set([...highTierIds, ...defaultIds]));
  return merged.slice(0, maxResults);
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Reads a single property off a parsed-XML node without assuming its shape. */
function get(node: unknown, key: string): unknown {
  if (node && typeof node === "object") {
    return (node as Record<string, unknown>)[key];
  }
  return undefined;
}

function getPath(node: unknown, path: string[]): unknown {
  return path.reduce((acc, key) => get(acc, key), node);
}

/** Flattens a parsed XML node to plain text, tolerating mixed content
 * (e.g. `<i>` tags inside a title/abstract) by concatenating leaf values. */
function nodeText(node: unknown): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node === "object") {
    const text = get(node, "#text");
    if (text !== undefined) return String(text);
    return Object.values(node as Record<string, unknown>)
      .filter((v) => typeof v === "string" || typeof v === "number")
      .join(" ");
  }
  return "";
}

function extractAbstract(article: unknown): string {
  const abstractNode = getPath(article, ["Abstract", "AbstractText"]);
  if (!abstractNode) return "";
  const parts = asArray(abstractNode).map((part) => {
    const text = nodeText(part);
    const labelValue = get(part, "@_Label");
    const label = typeof labelValue === "string" ? labelValue : undefined;
    return label ? `${label}: ${text}` : text;
  });
  return parts.join(" ").trim();
}

function extractPubYear(article: unknown): number | null {
  const pubDate = getPath(article, ["Journal", "JournalIssue", "PubDate"]);
  const raw = get(pubDate, "Year") ?? get(pubDate, "MedlineDate");
  if (!raw) return null;
  const match = String(raw).match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
}

function extractPubTypes(article: unknown): string[] {
  const list = getPath(article, ["PublicationTypeList", "PublicationType"]);
  return asArray(list)
    .map((t) => nodeText(t))
    .filter(Boolean);
}

/** Fetches full records (title, abstract, journal, pub year, publication
 * types) for a list of PMIDs in a single batched EFetch call. */
export async function fetchStudies(pmids: string[]): Promise<Study[]> {
  if (pmids.length === 0) return [];

  const params = ncbiParams({
    db: "pubmed",
    id: pmids.join(","),
    rettype: "abstract",
    retmode: "xml",
  });

  const res = await fetch(`${EUTILS_BASE}/efetch.fcgi?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`PubMed EFetch failed: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed: unknown = parser.parse(xml);

  const articles = asArray(getPath(parsed, ["PubmedArticleSet", "PubmedArticle"]));

  return articles.map((entry): Study => {
    const citation = get(entry, "MedlineCitation");
    const article = get(citation, "Article");
    const pubTypes = extractPubTypes(article);

    return {
      pmid: nodeText(get(citation, "PMID")) || "",
      title: nodeText(get(article, "ArticleTitle")) || "(untitled)",
      abstract: extractAbstract(article) || "(no abstract available)",
      journal:
        nodeText(getPath(article, ["Journal", "Title"])) ||
        nodeText(getPath(article, ["Journal", "ISOAbbreviation"])) ||
        "Unknown journal",
      pubYear: extractPubYear(article),
      pubTypes,
      tier: scoreStudy(pubTypes),
    };
  });
}

export async function researchStudies(query: string, maxStudies = 20): Promise<Study[]> {
  const pmids = await searchPubMed(query, maxStudies);
  return fetchStudies(pmids);
}
