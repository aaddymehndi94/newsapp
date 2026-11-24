// AI & software panel: what developers are paying attention to, with a one-line note on each
// thing written for a general reader.
//   New on GitHub: repositories created in the last 7 days with the most stars (GitHub API).
//   Trending on Hugging Face: the Hub's own trending sort (Hugging Face API).
//   New tools: "Show HN" launches with the most points in the last 3 days (HN Algolia API).
import type { ModelItem, RepoItem, TechPanel, ToolItem } from "../../site/types.ts";
import { type CostMeter, type JsonRequest, WRITER_MODEL, callJson } from "../llm.ts";
import { fetchText, log, mapLimit, stripHtml } from "../util.ts";

interface Candidate {
  id: string;
  kind: "repo" | "model" | "tool";
  name: string;
  blurb: string;
  excerpt: string;
}

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const r = await fetch(url, {
    headers: { "user-agent": "MeridianNewsReader/0.1 (personal news reader)", accept: "application/json", ...headers },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return (await r.json()) as T;
}

function githubHeaders(): Record<string, string> {
  const t = process.env.GITHUB_TOKEN;
  return { accept: "application/vnd.github+json", ...(t ? { authorization: `Bearer ${t}` } : {}) };
}

/** Plain text from the start of a README: no front matter, HTML, images, badges or code. */
export function readmeExcerpt(md: string, max = 1200): string {
  return stripHtml(
    md
      .replace(/^---\n[\s\S]*?\n---\n/, "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^#+\s*/gm, ""),
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

interface GhRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  created_at: string;
  fork: boolean;
  archived: boolean;
}

async function githubRepos(): Promise<{ repos: Omit<RepoItem, "what">[]; cands: Candidate[] }> {
  const since = new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 10);
  const q = encodeURIComponent(`created:>${since} stars:>30`);
  const j = await getJson<{ items: GhRepo[] }>(`https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=25`, githubHeaders());
  const picked = j.items.filter((r) => !r.fork && !r.archived && r.description?.trim()).slice(0, 12);
  const cands: Candidate[] = [];
  await mapLimit(picked, 4, async (r, i) => {
    let excerpt = "";
    try {
      const res = await fetch(`https://api.github.com/repos/${r.full_name}/readme`, {
        headers: { ...githubHeaders(), accept: "application/vnd.github.raw", "user-agent": "MeridianNewsReader/0.1 (personal news reader)" },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) excerpt = readmeExcerpt(await res.text());
    } catch {
      /* the description alone will do */
    }
    cands[i] = { id: `r${i}`, kind: "repo", name: r.full_name, blurb: r.description ?? "", excerpt };
  });
  return {
    repos: picked.map((r) => ({ name: r.full_name, url: r.html_url, stars: r.stargazers_count, language: r.language ?? undefined, createdAt: r.created_at })),
    cands: cands.filter(Boolean),
  };
}

interface HfModel {
  id: string;
  likes: number;
  downloads: number;
  pipeline_tag?: string;
}

async function hfModels(): Promise<{ models: Omit<ModelItem, "what">[]; cands: Candidate[] }> {
  const list = await getJson<HfModel[]>("https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=10");
  const cands: Candidate[] = [];
  await mapLimit(list, 4, async (m, i) => {
    const r = await fetchText(`https://huggingface.co/${m.id}/raw/main/README.md`, { accept: "text/plain", timeoutMs: 20_000, maxBytes: 200_000 });
    cands[i] = { id: `m${i}`, kind: "model", name: m.id, blurb: m.pipeline_tag ?? "", excerpt: r.ok ? readmeExcerpt(r.text) : "" };
  });
  return {
    models: list.map((m) => ({ name: m.id, url: `https://huggingface.co/${m.id}`, likes: m.likes, downloads: m.downloads, task: m.pipeline_tag })),
    cands: cands.filter(Boolean),
  };
}

interface HnHit {
  objectID: string;
  title: string;
  url: string | null;
  points: number;
  num_comments: number;
}

async function showHn(): Promise<{ tools: Omit<ToolItem, "what">[]; cands: Candidate[] }> {
  const since = Math.floor(Date.now() / 1000) - 3 * 86400;
  const j = await getJson<{ hits: HnHit[] }>(
    `https://hn.algolia.com/api/v1/search?tags=show_hn&numericFilters=created_at_i>${since},points>40&hitsPerPage=40`,
  );
  const hits = j.hits.sort((a, b) => b.points - a.points).slice(0, 10);
  const tools = hits.map((h) => {
    const title = h.title.replace(/^Show HN:\s*/i, "").trim();
    const name = title.split(/\s+[–—-]\s+|:\s+|,\s+/)[0].trim().slice(0, 60) || title.slice(0, 60);
    const discussionUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
    return { name, url: h.url || discussionUrl, discussionUrl, points: h.points, comments: h.num_comments };
  });
  const cands = hits.map((h, i) => ({ id: `t${i}`, kind: "tool" as const, name: tools[i].name, blurb: h.title, excerpt: "" }));
  return { tools, cands };
}

const NOTES_SYSTEM = `You write the one-line notes in the "AI & software" panel of Meridian, a news site for a general reader in India who wants to keep up with technology. Each item is a new GitHub repository, a trending Hugging Face model, or a tool someone launched on Hacker News.

For each item write "what": one plain sentence of at most 20 words saying what it is or does and who would use it. Use only the material given; do not guess at features. No hype or marketing words (no "powerful", "seamless", "revolutionary", "cutting-edge", "game-changing"). Avoid jargon a curious non-programmer would not know, or explain it in a few words. Start with the thing itself, e.g. "A command-line tool that…", "An open-weight model from …".

Set keep=false for anything spam-like or not worth a reader's time: star-farmed or empty repositories, crypto token promotions, cheat or piracy tools, adult content, homework dumps, lists of links, or anything where the material doesn't show what it does.`;

const NOTES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "what", "keep"],
        properties: { id: { type: "string" }, what: { type: "string" }, keep: { type: "boolean" } },
      },
    },
  },
};

async function notes(cands: Candidate[], meter: CostMeter): Promise<Map<string, { what: string; keep: boolean }>> {
  const user = cands
    .map((c) => `[${c.id}] ${c.kind}: ${c.name}\n${c.blurb ? `Description: ${c.blurb}\n` : ""}${c.excerpt ? `README start: ${c.excerpt}\n` : ""}`)
    .join("\n");
  const req: JsonRequest = { customId: "tech_notes", model: WRITER_MODEL, system: NOTES_SYSTEM, user, schema: NOTES_SCHEMA, effort: "low", maxTokens: 6000 };
  const r = await callJson<{ items: { id: string; what: string; keep: boolean }[] }>(req, meter);
  if (!r.ok) throw new Error(`notes: ${r.error}`);
  return new Map(r.data.items.map((x) => [x.id, { what: x.what.trim(), keep: x.keep }]));
}

export async function techPanel(meter: CostMeter): Promise<TechPanel | undefined> {
  const safe = async <T>(name: string, p: Promise<T>): Promise<T | undefined> => {
    try {
      return await p;
    } catch (e) {
      log(`tech: ${name} failed: ${(e as Error).message}`);
      return undefined;
    }
  };
  const [gh, hf, hn] = await Promise.all([safe("github", githubRepos()), safe("huggingface", hfModels()), safe("show hn", showHn())]);
  const cands = [...(gh?.cands ?? []), ...(hf?.cands ?? []), ...(hn?.cands ?? [])];
  if (cands.length === 0) return undefined;
  const n = await notes(cands, meter);
  const take = <T>(rows: T[] | undefined, prefix: string, max: number): (T & { what: string })[] =>
    (rows ?? [])
      .map((row, i) => ({ row, note: n.get(`${prefix}${i}`) }))
      .filter((x) => x.note?.keep && x.note.what)
      .slice(0, max)
      .map((x) => ({ ...x.row, what: x.note!.what }));
  return {
    fetchedAt: new Date().toISOString(),
    repos: take(gh?.repos, "r", 6),
    models: take(hf?.models, "m", 6),
    tools: take(hn?.tools, "t", 5),
  };
}
