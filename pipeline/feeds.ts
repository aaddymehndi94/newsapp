import { XMLParser } from "fast-xml-parser";
import { type Leaning, type Region, type SectionHint, type Source, canonicalOutlet, leaningFor } from "../config/sources.ts";
import { decodeEntities, fetchText, hash, log, mapLimit, stripHtml } from "./util.ts";

export interface FeedItem {
  id: string;
  sourceId: string;
  outlet: string;
  leaning: Leaning;
  region: Region;
  sectionHint: SectionHint;
  kind: "rss" | "gnews" | "reddit";
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

function toIso(s: string): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
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
  const kind = source.kind ?? "rss";
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
    let title = stripHtml(decodeEntities(text(it["title"])));
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

    const rawHtml = text(it["content:encoded"]) || text(it["description"]) || text(it["content"]) || text(it["summary"]);
    let summary = stripHtml(text(it["description"]) || text(it["summary"]) || text(it["media:description"]) || rawHtml);
    let outlet = source.outlet;
    let leaning = source.leaning;

    if (kind === "gnews") {
      // "Headline - Outlet" + <source>Outlet</source>
      const src = text(it["source"]);
      if (src) {
        title = title.replace(new RegExp(`\\s+[-–|]\\s+${src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`), "");
        // Single-site queries keep their configured outlet name; aggregate feeds name the real outlet.
        if (/google news/i.test(source.outlet)) {
          outlet = canonicalOutlet(src);
          leaning = leaningFor(outlet) ?? source.leaning;
        }
      }
      summary = ""; // Google News descriptions are just link lists
    }
    if (kind === "reddit") summary = "";
    if (summary.length > 600) summary = summary.slice(0, 600).replace(/\s+\S*$/, "") + "…";

    const published = toIso(
      text(it["pubDate"]) || text(it["pubdate"]) || text(it["PubDate"]) || text(it["dc:date"]) || text(it["published"]) || text(it["updated"]),
    );
    out.push({
      id: hash(link),
      sourceId: source.id,
      outlet,
      leaning,
      region: source.region,
      sectionHint: source.section,
      kind,
      title,
      link,
      summary,
      published,
      image: kind === "rss" ? pickImage(it, rawHtml) : undefined,
    });
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

export async function gatherAll(sources: Source[], sinceHours: number): Promise<{ items: FeedItem[]; stats: GatherStats }> {
  const since = Date.now() - sinceHours * 3600_000;
  const stats: GatherStats = { feedsTried: sources.length, feedsOk: 0, failed: [], itemsSeen: 0 };
  const lists = await mapLimit(sources, 10, async (s) => {
    const res = await fetchText(s.url, { accept: "application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.5" });
    if (!res.ok) {
      stats.failed.push({ id: s.id, status: res.status, note: res.status ? "" : res.text.slice(0, 80) });
      return [];
    }
    let items: FeedItem[];
    try {
      items = parseFeed(res.text, s);
    } catch (e) {
      stats.failed.push({ id: s.id, status: res.status, note: `parse error: ${(e as Error).message.slice(0, 60)}` });
      return [];
    }
    if (items.length === 0) {
      stats.failed.push({ id: s.id, status: res.status, note: "no items parsed" });
      return [];
    }
    stats.feedsOk++;
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
