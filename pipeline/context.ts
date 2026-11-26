// Context for the writer (part 3): who people are and what came before, kept apart from today's
// sources. Two kinds: our own stories on the subject from the last 14 days, and the lead section
// of English Wikipedia's article on people or bodies the editor names. Wikipedia's robots.txt
// allows /wiki/ pages (not /w/ or /api/), so those are what we read.
import fs from "node:fs";
import path from "node:path";
import { parseHTML } from "linkedom";
import { sharedWords } from "./coverage.ts";
import { fetchText } from "./util.ts";

interface PastStory {
  headline: string;
  summary?: string;
  background?: string;
  tags?: string[];
}

/** Our stories from editions in the last `days` days (newest first), with their edition date. */
export function pastStories(editionsDir: string, beforeDate: string, days = 14): (PastStory & { date: string })[] {
  const since = new Date(Date.parse(`${beforeDate}T00:00:00Z`) - days * 86400_000).toISOString().slice(0, 10);
  const out: (PastStory & { date: string })[] = [];
  for (const f of fs.readdirSync(editionsDir).filter((f) => f.endsWith(".json")).sort().reverse()) {
    const date = f.slice(0, 10);
    if (date >= beforeDate || date < since) continue;
    try {
      const ed = JSON.parse(fs.readFileSync(path.join(editionsDir, f), "utf8")) as { stories?: PastStory[] };
      for (const s of ed.stories ?? []) out.push({ ...s, date });
    } catch {
      /* a damaged edition gives no context */
    }
  }
  return out;
}

/** Our earlier stories about the same subject: headlines sharing three key words, or two tags. */
export function matchPast(headline: string, past: (PastStory & { date: string })[], max = 3): (PastStory & { date: string })[] {
  const seen = new Set<string>();
  return past
    .filter((p) => sharedWords(headline, p.headline) >= 3)
    .filter((p) => !seen.has(p.headline) && !!seen.add(p.headline))
    .slice(0, max);
}

/** The lead paragraphs of a Wikipedia article page, or undefined for a missing or disambiguation page. */
export function wikiLeadFromHtml(html: string, maxChars = 1200): string | undefined {
  const { document } = parseHTML(html);
  if (document.querySelector("#disambigbox, #noarticletext")) return undefined;
  let root = document.querySelector("#mw-content-text .mw-parser-output") ?? document.querySelector(".mw-parser-output");
  if (!root) return undefined;
  // Newer pages wrap each part in <section>: the lead is the first one.
  if (root.firstElementChild?.tagName === "SECTION") root = root.firstElementChild;
  for (const junk of [...root.querySelectorAll("style, script, sup, .reference, .mw-ref, .noprint, .IPA, .rt-commentedText")]) junk.remove();
  const paras: string[] = [];
  for (const el of [...root.children]) {
    if (/^H2$/i.test(el.tagName) || el.classList.contains("mw-heading") || el.id === "toc") break;
    if (el.tagName !== "P" || el.classList.contains("mw-empty-elt")) continue;
    const t = (el.textContent ?? "").replace(/\[[^\]]{1,12}\]/g, "").replace(/\s+/g, " ").trim();
    if (t.length > 40) paras.push(t);
    if (paras.join(" ").length > maxChars) break;
  }
  const text = paras.join("\n").slice(0, maxChars).replace(/\s+\S*$/, "");
  if (!text || /\bmay (also )?refer to\b/i.test(text.slice(0, 300))) return undefined;
  return text;
}

export async function wikiLead(title: string): Promise<string | undefined> {
  const slug = encodeURIComponent(title.trim().replace(/\s+/g, "_")).replace(/%2F/g, "/");
  if (!slug) return undefined;
  const r = await fetchText(`https://en.wikipedia.org/wiki/${slug}`, { timeoutMs: 15_000 });
  return r.ok ? wikiLeadFromHtml(r.text) : undefined;
}

/** The CONTEXT block for one story's writer, or "" when there is nothing to add. */
export function contextBlock(past: (PastStory & { date: string })[], wiki: { title: string; text: string }[]): string {
  const parts: string[] = [];
  for (const p of past) parts.push(`<earlier date="${p.date}">${p.headline}. ${p.summary ?? ""}${p.background ? ` ${p.background}` : ""}</earlier>`);
  for (const w of wiki) parts.push(`<encyclopedia title="${w.title}">${w.text}</encyclopedia>`);
  return parts.join("\n");
}
