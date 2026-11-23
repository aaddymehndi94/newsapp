import { probeImage } from "./enrich.ts";
import { fetchText, stripHtml } from "./util.ts";

export interface StoryImage {
  url: string;
  credit: string;
  sourceUrl: string;
  alt: string;
  width?: number;
  height?: number;
  kind: "outlet" | "wikimedia";
}

export interface ImageCandidate {
  url: string;
  outlet: string;
  sourceUrl: string;
  declaredWidth?: number;
  from: "og" | "rss";
}

const JUNK = /logo|placeholder|default[-_.]|[-_/]default|sprite|favicon|icon[-_.]|avatar|blank|spacer|1x1|no[-_]?image|fallback|share[-_]?image|social[-_]?share|og[-_]?default|branding|\.svg(\?|$)/i;

export function isJunkImage(url: string): boolean {
  return JUNK.test(url);
}

/** Order candidates by preference: og images first, larger declared width first, junk removed, de-duplicated. */
export function rankCandidates(cands: ImageCandidate[]): ImageCandidate[] {
  const seen = new Set<string>();
  return cands
    .filter((c) => /^https?:\/\//.test(c.url) && !isJunkImage(c.url))
    .filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)))
    .sort((a, b) => {
      const wa = a.declaredWidth ?? (a.from === "og" ? 1200 : 600);
      const wb = b.declaredWidth ?? (b.from === "og" ? 1200 : 600);
      return wb - wa;
    });
}

/** Probe ranked candidates; return the first that loads without a referrer and is big enough. */
export async function chooseOutletImage(cands: ImageCandidate[], alt: string, maxProbes = 5): Promise<StoryImage | undefined> {
  let fallback: StoryImage | undefined;
  for (const c of rankCandidates(cands).slice(0, maxProbes)) {
    const p = await probeImage(c.url);
    if (!p.ok) continue;
    const img: StoryImage = { url: c.url, credit: c.outlet, sourceUrl: c.sourceUrl, alt, width: p.width, height: p.height, kind: "outlet" };
    if (p.width && p.width < 500) continue;
    const landscape = !p.width || !p.height || p.width / p.height >= 1.15;
    if (landscape) return img;
    fallback ??= img; // portrait/square: keep looking for landscape, use if nothing better
  }
  return fallback;
}

/** Search Wikimedia Commons for a freely licensed photo of the subject. */
export async function wikimediaImage(query: string, alt: string): Promise<StoryImage | undefined> {
  if (!query.trim()) return undefined;
  const api =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8" +
    `&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}` +
    "&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1400";
  const r = await fetchText(api, { accept: "application/json", timeoutMs: 12_000 });
  if (!r.ok) return undefined;
  let data: { query?: { pages?: Record<string, { index?: number; title: string; imageinfo?: WikiInfo[] }> } };
  try {
    data = JSON.parse(r.text);
  } catch {
    return undefined;
  }
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info?.thumburl || !info.width || !info.height) continue;
    if (info.width < 800 || info.width / info.height < 1.15) continue;
    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value ?? "");
    if (!/cc|public domain|pd/i.test(license)) continue;
    const artist = stripHtml(meta.Artist?.value ?? "").replace(/\s+/g, " ").slice(0, 60) || "Unknown author";
    return {
      url: info.thumburl,
      credit: `${artist} / Wikimedia Commons (${license})`,
      sourceUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
      alt,
      width: info.thumbwidth,
      height: info.thumbheight,
      kind: "wikimedia",
    };
  }
  return undefined;
}

interface WikiInfo {
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
  width?: number;
  height?: number;
  descriptionurl?: string;
  extmetadata?: Record<string, { value?: string }>;
}
