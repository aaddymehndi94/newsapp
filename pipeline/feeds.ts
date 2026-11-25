import { XMLParser } from "fast-xml-parser";
import { type Leaning, type Region, type SectionHint, type Source, type Tier, outletInfo } from "../config/sources.ts";
import { allowedByRobots } from "./robots.ts";
import { decodeEntities, fetchText, hash, log, mapLimit, stripHtml } from "./util.ts";

export interface FeedItem {
  id: string;
  sourceId: string;
  outlet: string;
  leaning: Leaning;
  region: Region;
  sectionHint: SectionHint;
  kind: "rss" | "sitemap";
  /** From the outlet table: how far a story may lean on this outlet, and who owns it. */
  tier: Tier;
  owner: string;
  /** False when we won't read the article page (Source.fetchPages, or robots.txt bars Claude-User):
   *  the writer then has only what the feed carries. */
  pages?: boolean;
  title: string;
  link: string;
  summary: string;
  published?: string; // ISO
  image?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  removeNSPrefix: false,
  processEntities: true,
  htmlEntities: true,
  parseTagValue: false,
  trimValues: true,
});

const arr = <T>(x: T | T[] | undefined | null): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);

function text(x: unknown): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  if (Array.isArray(x)) return text(x[0]);
  if (typeof x === "object") {
    const o = x as Record<string, unknown>;
    if ("#text" in o) return text(o["#text"]);
    if ("__cdata" in o) return text(o["__cdata"]);
  }
  return "";
}

function attr(x: unknown, name: string): string | undefined {
  for (const el of arr(x as Record<string, unknown> | Record<string, unknown>[])) {
    if (el && typeof el === "object" && typeof el[`@_${name}`] === "string") return el[`@_${name}`] as string;
  }
  return undefined;
}

function firstImgSrc(html: string): string | undefined {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1];
}

const OFFSET = /(Z|[+-]\d{2}:?\d{2}|\b(GMT|UTC|UT|IST|[ECMP][SD]T))\s*$/i;

/** ISO time from a feed's date. Some Indian feeds give Indian time with no offset ("ist") or
 *  Indian time labelled as UTC ("ist-as-utc"); both are read as +05:30. */
export function toIso(s: string, times?: Source["times"]): string | undefined {
  s = s.trim();
  if (!s) return undefined;
  if (times === "ist-as-utc") s = s.replace(/(Z|[+-]00:?00)$/i, "");
  if ((times === "ist" || times === "ist-as-utc") && !OFFSET.test(s)) s += /^\d{4}-\d{2}-\d{2}T/.test(s) ? "+05:30" : " +0530";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Fix the link's host if the source asks, and apply its path and headline filters. */
function keep(source: Source, title: string, link: string): string | undefined {
  let u: URL;
  try {
    u = new URL(link);
  } catch {
    return undefined;
  }
  if (source.host && u.hostname === source.host[0]) u.hostname = source.host[1];
  if (source.path && !source.path.test(u.pathname)) return undefined;
  if (source.match && !source.match.test(title)) return undefined;
  return u.toString();
}

function itemFor(source: Source, f: { title: string; link: string; summary: string; published?: string; image?: string }): FeedItem {
  const info = outletInfo(source.outlet);
  return {
    id: hash(f.link),
    sourceId: source.id,
    outlet: source.outlet,
    leaning: source.leaning,
    region: source.region,
    sectionHint: source.section,
    kind: source.kind ?? "rss",
    tier: info?.tier ?? "core",
    owner: info?.owner ?? source.outlet,
    ...f,
  };
}

/**
 * A Google News sitemap (urlset with news:title) or a sitemap index (children to follow).
 * Headlines without news:title are rebuilt from the link's last part.
 */
export function parseSitemap(xml: string, source: Source): { items: FeedItem[]; children: string[] } {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return { items: [], children: [] };
  }
  const index = doc["sitemapindex"] as Record<string, unknown> | undefined;
  if (index) return { items: [], children: arr(index["sitemap"] as Record<string, unknown>[]).map((x) => text(x["loc"]).trim()).filter((l) => /^https?:\/\//.test(l)) };
  const urls = arr((doc["urlset"] as Record<string, unknown> | undefined)?.["url"] as Record<string, unknown>[]);
  const items: FeedItem[] = [];
  for (const u of urls) {
    const raw = text(u["loc"]).trim();
    const news = (u["news:news"] ?? {}) as Record<string, unknown>;
    let title = stripHtml(decodeEntities(text(news["news:title"]))).trim();
    if (!title) {
      const slug = raw.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() ?? "";
      const words = slug.replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " ").replace(/\b\d{5,}\b/g, "").trim();
      title = words ? words[0].toUpperCase() + words.slice(1) : "";
    }
    const link = title ? keep(source, title, raw) : undefined;
    if (!link) continue;
    const published = toIso(text(news["news:publication_date"]) || text(u["lastmod"]), source.times);
    items.push(itemFor(source, { title, link, summary: "", published }));
  }
  return { items, children: [] };
}

function pickImage(it: Record<string, unknown>, rawHtml: string): string | undefined {
  // media:content can be an array of renditions; prefer the widest image.
  const media = [...arr(it["media:content"] as unknown[]), ...arr((it["media:group"] as Record<string, unknown>)?.["media:content"] as unknown[])];
  let best: { url: string; w: number } | undefined;
  for (const m of media as Record<string, string>[]) {
    const url = m?.["@_url"];
    if (!url) continue;
    const medium = m["@_medium"] ?? "";
    const type = m["@_type"] ?? "";
    if (medium && medium !== "image") continue;
    if (type && !type.startsWith("image")) continue;
    const w = Number(m["@_width"] ?? 0);
    if (!best || w > best.w) best = { url, w };
  }
  if (best) return best.url;
  const thumb = attr(it["media:thumbnail"], "url");
  if (thumb) return thumb;
  for (const enc of arr(it["enclosure"] as Record<string, string>[])) {
    if (enc?.["@_url"] && (enc["@_type"] ?? "image").startsWith("image")) return enc["@_url"];
  }
  const img = text(it["image"]);
  if (img.startsWith("http")) return img;
  return firstImgSrc(rawHtml);
}

export function parseFeed(xml: string, source: Source): FeedItem[] {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return [];
  }
  const rss = doc["rss"] as Record<string, unknown> | undefined;
  const rdf = doc["rdf:RDF"] as Record<string, unknown> | undefined;
  const atom = doc["feed"] as Record<string, unknown> | undefined;

  const raw: Record<string, unknown>[] = rss
    ? arr((rss["channel"] as Record<string, unknown>)?.["item"] as Record<string, unknown>[])
    : rdf
      ? arr(rdf["item"] as Record<string, unknown>[])
      : atom
        ? arr(atom["entry"] as Record<string, unknown>[])
        : [];

  const out: FeedItem[] = [];
  for (const it of raw) {
    const title = stripHtml(decodeEntities(text(it["title"])));
    let link = "";
    if (typeof it["link"] === "string") link = it["link"];
    else {
      const links = arr(it["link"] as Record<string, string>[]);
      const alt = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0];
      link = alt?.["@_href"] ?? text(alt);
    }
    if (!link && typeof it["guid"] === "string" && it["guid"].startsWith("http")) link = it["guid"];
    link = link.trim();
    if (!title || !/^https?:\/\//.test(link)) continue;

    const kept = keep(source, title, link);
    if (!kept) continue;
    const rawHtml = text(it["content:encoded"]) || text(it["description"]) || text(it["content"]) || text(it["summary"]);
    let summary = stripHtml(text(it["description"]) || text(it["summary"]) || text(it["media:description"]) || rawHtml);
    if (summary.length > 600) summary = summary.slice(0, 600).replace(/\s+\S*$/, "") + "…";
    const published = toIso(
      text(it["pubDate"]) || text(it["pubdate"]) || text(it["PubDate"]) || text(it["dc:date"]) || text(it["published"]) || text(it["updated"]),
      source.times,
    );
    out.push(itemFor(source, { title, link: kept, summary, published, image: pickImage(it, rawHtml) }));
  }
  return out;
}

const TRACKING = /^(utm_|at_|fbclid|gclid|ocid|cmpid|ref$|ref_|src$|from$|itm_|mc_)/i;

/** Identity of an article link for de-duplication: drops the fragment and tracking parameters only. */
export function dedupeKey(link: string): string {
  try {
    const u = new URL(link);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return link;
  }
}

export interface GatherStats {
  feedsTried: number;
  feedsOk: number;
  failed: { id: string; status: number; note: string }[];
  itemsSeen: number;
}

/** The IST dates (YYYY-MM-DD) from `since` to now, newest first. */
function istDates(since: number): string[] {
  const out: string[] = [];
  for (let t = Date.now(); t > since - 86400_000; t -= 86400_000) {
    const d = new Date(t + 5.5 * 3600_000).toISOString().slice(0, 10);
    if (!out.includes(d)) out.push(d);
  }
  return out;
}

export async function gatherAll(sources: Source[], sinceHours: number): Promise<{ items: FeedItem[]; stats: GatherStats }> {
  const since = Date.now() - sinceHours * 3600_000;
  const stats: GatherStats = { feedsTried: sources.length, feedsOk: 0, failed: [], itemsSeen: 0 };
  // Several sources share one document (PTI's sitemap is routed to seven cities): fetch it once.
  const fetched = new Map<string, ReturnType<typeof fetchText>>();
  const get = (url: string) => {
    let p = fetched.get(url);
    if (!p) {
      p = fetchText(url, { timeoutMs: 30_000, maxBytes: 8_000_000, accept: "application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.5" });
      fetched.set(url, p);
    }
    return p;
  };
  const lists = await mapLimit(sources, 10, async (s) => {
    // A feed whose site bars readers like us is skipped, never fetched.
    if (!(await allowedByRobots(s.url))) {
      stats.failed.push({ id: s.id, status: 0, note: "robots.txt disallows it; not fetched" });
      return [];
    }
    const res = await get(s.url);
    if (!res.ok) {
      stats.failed.push({ id: s.id, status: res.status, note: res.status ? "" : res.text.slice(0, 80) });
      return [];
    }
    let items: FeedItem[];
    try {
      if (s.kind === "sitemap") {
        const first = parseSitemap(res.text, s);
        items = first.items;
        if (first.children.length) {
          // A sitemap index: follow the children for the days in our window (by the date in their
          // link), or the first two when their links carry no date.
          const days = istDates(since);
          const dated = first.children.filter((c) => days.some((d) => c.includes(d)));
          const pick = dated.length ? dated : first.children.slice(0, 2);
          for (const c of pick) {
            if (!(await allowedByRobots(c))) continue;
            const r = await get(c);
            if (r.ok) items.push(...parseSitemap(r.text, s).items);
          }
        }
      } else items = parseFeed(res.text, s);
    } catch (e) {
      stats.failed.push({ id: s.id, status: res.status, note: `parse error: ${(e as Error).message.slice(0, 60)}` });
      return [];
    }
    if (items.length === 0) {
      stats.failed.push({ id: s.id, status: res.status, note: "no items parsed" });
      return [];
    }
    stats.feedsOk++;
    const pages = s.fetchPages !== false && (await allowedByRobots(items[0].link, { ai: true }));
    for (const it of items) it.pages = pages;
    return items;
  });
  const seen = new Set<string>();
  const items: FeedItem[] = [];
  const recentBySource = new Map<string, number>();
  for (const it of lists.flat()) {
    stats.itemsSeen++;
    // Undated items can't be shown to be recent, so they are dropped (stale news is worse than less news).
    if (!it.published) continue;
    if (Date.parse(it.published) < since) continue;
    if (Date.parse(it.published) > Date.now() + 3600_000) continue;
    const key = dedupeKey(it.link);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(it);
    recentBySource.set(it.sourceId, (recentBySource.get(it.sourceId) ?? 0) + 1);
  }
  const quiet = sources.filter((s) => !recentBySource.has(s.id) && !stats.failed.some((f) => f.id === s.id)).map((s) => s.id);
  if (quiet.length) log(`feeds with no recent dated items: ${quiet.join(", ")}`);
  log(`feeds: ${stats.feedsOk}/${stats.feedsTried} ok, ${stats.itemsSeen} items seen, ${items.length} recent+unique`);
  if (stats.failed.length) log("feeds failed:", stats.failed.map((f) => `${f.id}(${f.status}${f.note ? " " + f.note : ""})`).join(", "));
  return { items, stats };
}
