// Entertainment panel: what people are listening to and what's on at the cinema.
//   Top songs: Apple Music most-played charts (Apple's public marketing-tools RSS).
//   Films: candidates from Wikipedia's "List of <language> films of <year>" release tables
//   (American, Hindi and the four big South Indian industries), kept only if they were among
//   English Wikipedia's 1,000 most-read articles on a recent day (Wikimedia pageviews API).
//   Posters come from each film's Wikipedia infobox; trailers from the film's Wikidata item
//   (YouTube video IDs), or YouTube's search API when YOUTUBE_API_KEY is set. Only /wiki/ pages
//   are fetched: Wikipedia's robots.txt rules out /w/ and /api/. TMDB is used instead when
//   TMDB_API_KEY is set; it is not endorsed or certified by TMDB.
import type { ChartSong, CulturePanel, Movie } from "../../site/types.ts";
import { decodeEntities, fetchText, log, mapLimit, stripHtml } from "../util.ts";

interface AppleFeed {
  feed?: { results?: { name: string; artistName: string; url: string; artworkUrl100?: string }[] };
}

async function chart(cc: string): Promise<ChartSong[]> {
  const url = `https://rss.applemarketingtools.com/api/v2/${cc}/music/most-played/10/songs.json`;
  let r = await fetchText(url, { accept: "application/json", timeoutMs: 30_000 });
  if (!r.ok) r = await fetchText(url, { accept: "application/json", timeoutMs: 30_000 });
  if (!r.ok) throw new Error(`apple ${cc} ${r.status}`);
  const j = JSON.parse(r.text) as AppleFeed;
  return (j.feed?.results ?? []).slice(0, 10).map((s, i) => ({
    rank: i + 1,
    title: s.name,
    artist: s.artistName,
    url: s.url,
    // 100px artwork is too soft on phones; Apple serves other sizes from the same path.
    artwork: s.artworkUrl100?.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/160x160bb.$1"),
  }));
}

interface TmdbMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  original_language: string;
  popularity: number;
}

const LANGS: Record<string, string> = { hi: "Hindi", en: "English", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam", mr: "Marathi", bn: "Bengali", pa: "Punjabi", ja: "Japanese", ko: "Korean" };

async function tmdb(kind: "now_playing" | "upcoming"): Promise<Movie[]> {
  const key = process.env.TMDB_API_KEY?.trim();
  if (!key) return [];
  // A v4 read-access token is a long JWT; a v3 key is 32 hex characters.
  const bearer = key.length > 40;
  const url = `https://api.themoviedb.org/3/movie/${kind}?region=IN&language=en-IN&page=1${bearer ? "" : `&api_key=${key}`}`;
  const res = await fetch(url, {
    headers: { accept: "application/json", ...(bearer ? { authorization: `Bearer ${key}` } : {}) },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`tmdb ${kind} ${res.status}`);
  const j = (await res.json()) as { results: TmdbMovie[] };
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  let rows = j.results.filter((m) => m.title && m.release_date);
  rows = kind === "upcoming" ? rows.filter((m) => m.release_date > today).sort((a, b) => a.release_date.localeCompare(b.release_date)) : rows.sort((a, b) => b.popularity - a.popularity);
  return rows.slice(0, 8).map((m) => ({
    title: m.title,
    date: m.release_date,
    url: `https://www.themoviedb.org/movie/${m.id}`,
    poster: m.poster_path ? `https://image.tmdb.org/t/p/w185${m.poster_path}` : undefined,
    language: LANGS[m.original_language] ?? m.original_language.toUpperCase(),
  }));
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * Release rows from a Wikipedia film-list page. Each quarter's table opens rows
 * with a month cell and a day cell that span several rows, so both are carried forward until a
 * row brings new ones.
 */
export function parseWikiFilms(html: string, year: number, language: string): Movie[] {
  const out: Movie[] = [];
  for (const table of html.match(/<table[^>]*wikitable[\s\S]*?<\/table>/g) ?? []) {
    const head = stripHtml(table.slice(0, table.indexOf("</tr>")));
    if (!/Opening/i.test(head) || !/Title/i.test(head)) continue;
    let month = -1;
    let day = 0;
    for (const row of table.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
      const cells = [...row.matchAll(/<t([dh])([^>]*)>([\s\S]*?)<\/t[dh]>/g)].map((c) => ({ html: c[3], text: decodeEntities(stripHtml(c[3])).replace(/\s+/g, " ").trim() }));
      if (cells.length === 0) continue;
      // Month cells are often written down the cell ("O<br>C<br>T").
      const m0 = cells[0].text.replace(/\s+/g, "");
      const mi = MONTHS.indexOf(m0.slice(0, 3).toUpperCase());
      if (mi >= 0 && m0.length <= 9) {
        month = mi;
        cells.shift();
      }
      if (cells[0] && /^\d{1,2}$/.test(cells[0].text)) {
        day = Number(cells[0].text);
        cells.shift();
      }
      const t = cells[0];
      if (month < 0 || !day || !t || !t.text || /^Title$/i.test(t.text)) continue;
      // Only titles with their own article (red links have class "new").
      // Links come as "/wiki/X", "./X" or "https://en.wikipedia.org/wiki/X" depending on the renderer.
      const a = t.html.match(/<a\b[^>]*href="(?:https:\/\/en\.wikipedia\.org)?(?:\/wiki\/|\.\/)([^"#?]+)"[^>]*>/);
      if (!a || /class="[^"]*\bnew\b/.test(a[0])) continue;
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      out.push({ title: t.text.replace(/\s*\[\d+\]$/, ""), date, url: `https://en.wikipedia.org/wiki/${a[1]}`, language });
    }
  }
  return out;
}

const WIKI = "https://en.wikipedia.org/wiki/";

// Release lists the candidates come from. Readership decides which of them are big enough to
// show, so a small regional release only appears when lots of people are reading about it.
const WIKI_LISTS: [string, string][] = [
  ["American", "Hollywood"],
  ["Hindi", "Hindi"],
  ["Tamil", "Tamil"],
  ["Telugu", "Telugu"],
  ["Kannada", "Kannada"],
  ["Malayalam", "Malayalam"],
];

const shiftDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86400e3).toISOString().slice(0, 10);

function articleKey(url: string): string {
  const path = url.slice(url.indexOf("/wiki/") + 6);
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * The big releases: films out in the last five weeks, and films due in the next six and a half,
 * that were among English Wikipedia's 1,000 most-read articles on a recent day. Ranked by the
 * best day's readers; upcoming films are then put in date order.
 */
export function rankFilms(films: Movie[], views: Map<string, number>, today: string, max = 8): { now: Movie[]; soon: Movie[] } {
  const from = shiftDays(today, -35);
  const to = shiftDays(today, 45);
  const seen = new Set<string>();
  const scored = films
    .filter((m) => !seen.has(m.url) && seen.add(m.url))
    .map((m) => ({ m, v: views.get(articleKey(m.url)) ?? 0 }))
    .filter((x) => x.v > 0);
  const top = (xs: typeof scored) => xs.sort((a, b) => b.v - a.v).slice(0, max).map((x) => x.m);
  return {
    now: top(scored.filter((x) => x.m.date >= from && x.m.date <= today)),
    soon: top(scored.filter((x) => x.m.date > today && x.m.date <= to)).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** The poster in a Wikipedia film article's infobox (a 250px thumbnail). */
export function parseInfoboxPoster(html: string): string | undefined {
  const i = html.indexOf('class="infobox-image"');
  if (i < 0) return undefined;
  const m = html.slice(i, i + 4000).match(/<img\b[^>]*?\ssrc="((?:https:)?\/\/(?:upload|thumb)\.wikimedia\.org\/[^"?]+)/);
  if (!m) return undefined;
  return m[1].startsWith("//") ? `https:${m[1]}` : m[1];
}

/**
 * The film's trailer from its Wikidata item ("YouTube video ID", P1651). Items often list
 * announcement clips and teasers as well, so prefer the one marked as the trailer, then one
 * named as a trailer, then a teaser; in English or the film's own language; most watched.
 */
export function parseWikidataTrailer(html: string, language?: string): string | undefined {
  const i = html.indexOf('id="P1651"');
  if (i < 0) return undefined;
  const j = html.indexOf('class="wikibase-statementgroupview" id=', i + 10);
  const group = html.slice(i, j > 0 ? j : i + 200_000);
  let best: { id: string; score: number; views: number } | undefined;
  for (const st of group.split('class="wikibase-statementview ').slice(1)) {
    const id = st.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/)?.[1];
    if (!id) continue;
    const t = decodeEntities(stripHtml(`<${st}`)).replace(/\s+/g, " ");
    let score = /has role trailer\b/i.test(t) ? 3 : /\btrailer\b/i.test(t) ? 2 : /\b(teaser|glimpse)\b/i.test(t) ? 1 : 0;
    if (!score) continue;
    const lang = t.match(/language of work or name (\w+)/)?.[1];
    if (lang === "English" || (language && lang === language)) score += 1;
    const views = Number(t.match(/number of viewers\/listeners ([\d,]+)/)?.[1]?.replace(/,/g, "") ?? 0);
    if (!best || score > best.score || (score === best.score && views > best.views)) best = { id, score, views };
  }
  return best?.id;
}

/** Each day's 1,000 most-read English Wikipedia articles, for the last three full days. */
async function recentReaders(): Promise<Map<string, number>> {
  const views = new Map<string, number>();
  for (let back = 1; back <= 3; back++) {
    const day = new Date(Date.now() - back * 86400e3).toISOString().slice(0, 10).replace(/-/g, "/");
    const r = await fetchText(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia.org/all-access/${day}`, { accept: "application/json", timeoutMs: 30_000 });
    if (!r.ok) continue;
    const j = JSON.parse(r.text) as { items?: { articles?: { article: string; views: number }[] }[] };
    for (const a of j.items?.[0]?.articles ?? []) views.set(a.article, Math.max(views.get(a.article) ?? 0, a.views));
  }
  if (views.size === 0) throw new Error("no Wikipedia readership figures");
  return views;
}

/** Only with YOUTUBE_API_KEY: YouTube's own search API, for films Wikidata has no trailer for. */
async function youtubeSearchTrailer(m: Movie): Promise<string | undefined> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return undefined;
  const q = encodeURIComponent(`${m.title} official trailer`);
  const r = await fetchText(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=1&q=${q}&key=${encodeURIComponent(key)}`, {
    accept: "application/json",
  });
  if (!r.ok) return undefined;
  const id = (JSON.parse(r.text) as { items?: { id?: { videoId?: string } }[] }).items?.[0]?.id?.videoId;
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : undefined;
}

async function filmDetails(m: Movie): Promise<Movie> {
  const r = await fetchText(m.url, { timeoutMs: 30_000, maxBytes: 6_000_000 });
  if (!r.ok) return m;
  const poster = parseInfoboxPoster(r.text);
  const qid = r.text.match(/"wgWikibaseItemId":"(Q\d+)"/)?.[1];
  let trailer: string | undefined;
  if (qid) {
    const w = await fetchText(`https://www.wikidata.org/wiki/${qid}`, { timeoutMs: 30_000, maxBytes: 8_000_000 });
    if (w.ok) trailer = parseWikidataTrailer(w.text, m.language === "Hollywood" ? "English" : m.language);
  }
  trailer ??= await youtubeSearchTrailer(m).catch(() => undefined);
  return { ...m, ...(poster ? { poster } : {}), ...(trailer ? { trailer } : {}) };
}

async function wikiFilms(): Promise<{ now: Movie[]; soon: Movie[] }> {
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const years = [...new Set([shiftDays(today, -35), today, shiftDays(today, 45)].map((d) => Number(d.slice(0, 4))))];
  const jobs = WIKI_LISTS.flatMap(([page, label]) => years.map((y) => ({ page, label, y })));
  const lists = await mapLimit(jobs, 2, async ({ page, label, y }) => {
    const r = await fetchText(`${WIKI}List_of_${page}_films_of_${y}`, { timeoutMs: 30_000, maxBytes: 8_000_000 });
    if (!r.ok) {
      if (r.status !== 404) log(`culture: wikipedia ${page} ${y} ${r.status}`);
      return [];
    }
    return parseWikiFilms(r.text, y, label);
  });
  const ranked = rankFilms(lists.flat(), await recentReaders(), today);
  const details = (xs: Movie[]) => mapLimit(xs, 2, (m) => filmDetails(m).catch(() => m));
  return { now: await details(ranked.now), soon: await details(ranked.soon) };
}

export async function culturePanel(): Promise<CulturePanel | undefined> {
  const safe = async <T>(name: string, p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch (e) {
      log(`culture: ${name} failed: ${(e as Error).message}`);
      return fallback;
    }
  };
  const [india, us, tmdbNow, tmdbSoon, wiki] = await Promise.all([
    safe("chart in", chart("in"), []),
    safe("chart us", chart("us"), []),
    safe("now playing", tmdb("now_playing"), []),
    safe("upcoming", tmdb("upcoming"), []),
    safe("wikipedia films", wikiFilms(), { now: [], soon: [] }),
  ]);
  const now = tmdbNow.length ? tmdbNow : wiki.now;
  const soon = tmdbSoon.length ? tmdbSoon : wiki.soon;
  const charts = [
    { id: "in", name: "India", songs: india },
    { id: "us", name: "US", songs: us },
  ].filter((c) => c.songs.length > 0);
  if (charts.length === 0 && now.length === 0 && soon.length === 0) return undefined;
  return {
    fetchedAt: new Date().toISOString(),
    charts,
    ...(now.length ? { nowShowing: now } : {}),
    ...(soon.length ? { comingSoon: soon } : {}),
  };
}
