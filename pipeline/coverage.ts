// Finding the same story elsewhere. When the editor's sources for a story give the writer too
// little to read (headline-only wire copy, outlets that bar AI readers), we look for other
// outlets' reports of the same event: first in our own library (every recent item we gathered,
// plus search-only news sitemaps), then the Guardian's own search (full text comes with each
// result), then GDELT's free news search when it answers (it asks for one request every five
// seconds and often refuses with 429). Only outlets we know, and only reports about the story.
import { type Leaning, outletInfo, leaningFor } from "../config/sources.ts";
import { type FeedItem, guardianTurn, parseGuardian } from "./feeds.ts";
import { fetchText, hash, log } from "./util.ts";

/** Outlets we accept from a search, by web address. Unknown sites are never used. */
const DOMAINS: Record<string, string> = {
  "thehindu.com": "The Hindu", "frontline.thehindu.com": "Frontline", "hindustantimes.com": "Hindustan Times",
  "livemint.com": "Mint", "business-standard.com": "Business Standard", "theprint.in": "ThePrint",
  "thewire.in": "The Wire", "thequint.com": "The Quint", "scroll.in": "Scroll", "newindianexpress.com": "The New Indian Express",
  "deccanherald.com": "Deccan Herald", "deccanchronicle.com": "Deccan Chronicle", "ndtv.com": "NDTV", "news18.com": "News18",
  "timesofindia.indiatimes.com": "The Times of India", "economictimes.indiatimes.com": "The Economic Times",
  "indianexpress.com": "The Indian Express", "thenewsminute.com": "The News Minute", "livelaw.in": "LiveLaw",
  "barandbench.com": "Bar & Bench", "downtoearth.org.in": "Down To Earth", "onmanorama.com": "Onmanorama",
  "english.mathrubhumi.com": "Mathrubhumi English", "dtnext.in": "DT Next", "mid-day.com": "Mid-Day",
  "freepressjournal.in": "Free Press Journal", "thesouthfirst.com": "South First", "siasat.com": "Siasat",
  "uniindia.com": "United News of India", "ptinews.com": "Press Trust of India", "indiatoday.in": "India Today", "tribuneindia.com": "The Tribune", "outlookindia.com": "Outlook",
  "bbc.com": "BBC News", "bbc.co.uk": "BBC News", "aljazeera.com": "Al Jazeera", "dw.com": "DW", "scmp.com": "South China Morning Post",
  "abc.net.au": "ABC News (Australia)", "thediplomat.com": "The Diplomat", "wsj.com": "The Wall Street Journal",
  "theguardian.com": "The Guardian", "nytimes.com": "The New York Times", "france24.com": "France 24",
  "channelnewsasia.com": "CNA", "dawn.com": "Dawn", "thedailystar.net": "The Daily Star (Bangladesh)", "kathmandupost.com": "The Kathmandu Post",
  "independent.co.uk": "The Independent", "japantimes.co.jp": "The Japan Times", "straitstimes.com": "The Straits Times",
};

export function outletForUrl(url: string): string | undefined {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
  for (let h = host; h.includes("."); h = h.slice(h.indexOf(".") + 1)) if (DOMAINS[h]) return DOMAINS[h];
  return undefined;
}

const STOP = new Set("a an the and or but of in on at to for from by with as is are was were be been may might will would can could should has have had its it this that these those after before over under into about amid against than then there their they he she his her who what when where why how not no new says said say also more most up out off all any just nearly remain remains likely despite first major ahead among during while being other still again today latest report reports update live amid over".split(" "));

/**
 * Search terms, most distinctive first: names, acronyms and figures (quoted), then other long
 * words. In a Title Case headline capitals say nothing, so only acronyms count there.
 */
export function searchTerms(headline: string): string[] {
  const words = headline.replace(/[‘’“”"'.,:;!?()[\]]/g, " ").split(/\s+/).filter(Boolean);
  const titleCase = words.filter((w) => /^[A-Z]/.test(w)).length > words.length * 0.6;
  const special: string[] = [];
  const plain: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const lw = w.toLowerCase();
    if (/^\d[\d,.]*$/.test(w) && words[i + 1] && /^(lakh|crore|million|billion|per|percent|%)$/i.test(words[i + 1])) special.push(`"${w} ${words[++i]}"`);
    else if (STOP.has(lw)) continue;
    else if (/^[A-Z]{2,}$/.test(w) || (!titleCase && /^[A-Z][\p{L}-]{2,}$/u.test(w))) special.push(`"${w}"`);
    else if (w.length >= 5) plain.push(lw);
  }
  return [...special.slice(0, 4), ...plain];
}

/** GDELT needs every term: six of them. */
export const gdeltQuery = (headline: string) => `${searchTerms(headline).slice(0, 6).join(" ")} sourcelang:english`;

/** Distinctive words of a headline: long words, figures and acronyms ("SIR", "MEA"). */
const keyWords = (t: string) =>
  [
    ...t.toLowerCase().replace(/(\d),(\d)/g, "$1$2").replace(/[^\p{L}\p{N} ]+/gu, " ").split(/\s+/).filter((w) => (w.length >= 4 || /^\d+$/.test(w)) && !STOP.has(w)),
    ...(t.match(/\b[A-Z]{2,3}\b/g) ?? []).map((a) => a.toLowerCase()),
  ].map((w) => (w.length > 4 && /[^s]s$/.test(w) ? w.slice(0, -1) : w)); // "tariffs" = "tariff"

/** How many key words two headlines share. */
export const sharedWords = (a: string, b: string) => {
  const kb = new Set(keyWords(b));
  return [...new Set(keyWords(a))].filter((w) => kb.has(w)).length;
};

/** Whether a page is about this story: at least half of the headline's key words (and two) appear. */
export function relevant(text: string, headline: string): boolean {
  const body = ` ${text.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ")} `;
  const keys = [...new Set(keyWords(headline))];
  const hits = keys.filter((k) => body.includes(` ${k}`)).length;
  return hits >= 2 && hits >= keys.length / 2;
}

/**
 * Items in our library that report the same story: other outlets' items (with pages we may
 * read) whose headline shares most of this headline's key words, closest first.
 */
export function matchLibrary(headline: string, library: FeedItem[], have: Set<string>, max = 6): FeedItem[] {
  const keys = [...new Set(keyWords(headline))];
  const scored: { it: FeedItem; score: number }[] = [];
  for (const it of library) {
    if (it.pages === false || have.has(it.outlet) || outletInfo(it.outlet)?.tier === "perspective") continue;
    const words = new Set(keyWords(it.title));
    const shared = keys.filter((k) => words.has(k)).length;
    if (shared >= 3 && shared >= keys.length * 0.4) scored.push({ it, score: shared / Math.max(keys.length, words.size) });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, max).map((s) => s.it);
}

let lastCall = 0;
let failures = 0;
async function gdelt(query: string): Promise<{ url: string; title: string; seendate: string }[]> {
  if (failures >= 3) return []; // GDELT is refusing us today: stop asking
  const wait = lastCall + 5500 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const u = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=40&format=json&timespan=3d&sort=hybridrel`;
  const r = await fetchText(u, { timeoutMs: 20_000, accept: "application/json" });
  try {
    if (!r.ok) throw new Error(String(r.status));
    const articles = (JSON.parse(r.text).articles ?? []) as { url: string; title: string; seendate: string }[];
    failures = 0;
    return articles;
  } catch {
    // Refused (429), timed out, or answered in plain text (a malformed or too-frequent query).
    if (++failures === 3) log("coverage search: GDELT refused three times in a row; using our own library only");
    return [];
  }
}

/**
 * Other outlets' reports of a story, as items the writer can use. `have` holds the outlets the
 * story already uses; `read` fetches a page (it obeys robots.txt). At most `max` are returned.
 */
/** The Guardian's reports from the last three days that use the headline's key words. */
async function guardianSearch(headline: string, like: Pick<FeedItem, "region" | "sectionHint">): Promise<FeedItem[]> {
  const key = process.env.GUARDIAN_API_KEY;
  const words = [...new Set(searchTerms(headline))].slice(0, 3);
  if (!key || words.length < 3) return [];
  await guardianTurn();
  const from = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);
  const q = encodeURIComponent(words.join(" AND "));
  const r = await fetchText(
    `https://content.guardianapis.com/search?q=${q}&from-date=${from}&order-by=relevance&page-size=3&show-fields=trailText,bodyText,thumbnail&api-key=${key}`,
    { timeoutMs: 20_000, accept: "application/json" },
  );
  if (!r.ok) return [];
  return parseGuardian(r.text, { id: "coverage-search", outlet: "The Guardian", url: "", region: like.region, section: like.sectionHint, leaning: "left" });
}

export async function findCoverage(
  headline: string,
  like: Pick<FeedItem, "region" | "sectionHint">,
  have: Set<string>,
  read: (url: string) => Promise<string | undefined>,
  max = 2,
  library: FeedItem[] = [],
): Promise<{ item: FeedItem; text: string }[]> {
  const out: { item: FeedItem; text: string }[] = [];
  const seenOutlets = new Set(have);
  let reads = 0;
  for (const it of matchLibrary(headline, library, seenOutlets)) {
    if (out.length >= max || reads >= 6) break;
    if (seenOutlets.has(it.outlet)) continue;
    reads++;
    const text = await read(it.alt ?? it.link);
    if (!text || text.length < 800 || !relevant(text, headline)) continue;
    seenOutlets.add(it.outlet);
    out.push({ text, item: { ...it, region: like.region, sectionHint: like.sectionHint } });
  }
  if (out.length < max && !seenOutlets.has("The Guardian")) {
    // A report on the same event: not a live blog, a headline sharing two key words, text about it.
    const g = (await guardianSearch(headline, like).catch(() => [])).find(
      (it) => it.body && it.body.length >= 800 && !/\/live\//.test(it.link) && sharedWords(it.title, headline) >= 2 && relevant(it.body, headline),
    );
    if (g) {
      seenOutlets.add(g.outlet);
      out.push({ item: g, text: g.body!.slice(0, 14_000) });
    }
  }
  if (out.length < max) for (const a of await gdelt(gdeltQuery(headline))) {
    if (out.length >= max || reads >= 6) break;
    const outlet = outletForUrl(a.url);
    if (!outlet || seenOutlets.has(outlet)) continue;
    const info = outletInfo(outlet);
    if (info?.tier === "perspective") continue;
    reads++;
    const text = await read(a.url);
    if (!text || text.length < 800 || !relevant(text, headline)) continue;
    seenOutlets.add(outlet);
    const m = a.seendate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    out.push({
      text,
      item: {
        id: hash(a.url),
        sourceId: "coverage-search",
        outlet,
        leaning: (leaningFor(outlet) ?? "centre") as Leaning,
        region: like.region,
        sectionHint: like.sectionHint,
        kind: "rss",
        tier: info?.tier ?? "corroborate",
        owner: info?.owner ?? outlet,
        title: a.title,
        link: a.url,
        summary: "",
        published: m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : undefined,
        pages: true,
      },
    });
  }
  log(`coverage search "${headline.slice(0, 60)}": ${out.length} more (${out.map((o) => o.item.outlet).join(", ")})`);
  return out;
}
