// Entertainment panel: what people are listening to and what's on at the cinema.
//   Top songs: Apple Music most-played charts (Apple's public marketing-tools RSS).
//   Films: Wikipedia's "List of <language> films of <year>" release tables (CC BY-SA), for Hindi,
//   Tamil, Telugu, Kannada, Malayalam and American films. Only titles that have their own
//   Wikipedia article are listed, which keeps out the smallest releases. When TMDB_API_KEY is
//   set, TMDB (posters, popularity) is used instead; it is not endorsed or certified by TMDB.
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
 * Release rows from a Wikipedia film-list page (Parsoid HTML). Each quarter's table opens rows
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
      const a = t.html.match(/<a\b[^>]*href="\/wiki\/([^"#?]+)"[^>]*>/);
      if (!a || /class="[^"]*\bnew\b/.test(a[0])) continue;
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      out.push({ title: t.text.replace(/\s*\[\d+\]$/, ""), date, url: `https://en.wikipedia.org/wiki/${a[1]}`, language });
    }
  }
  return out;
}

const WIKI_LISTS: [string, string][] = [
  ["Hindi", "Hindi"],
  ["Kannada", "Kannada"],
  ["Tamil", "Tamil"],
  ["Telugu", "Telugu"],
  ["Malayalam", "Malayalam"],
  ["American", "Hollywood"],
];

async function wikiFilms(): Promise<{ now: Movie[]; soon: Movie[] }> {
  const today = new Date(Date.now() + 5.5 * 3600e3);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const from = iso(new Date(today.getTime() - 14 * 86400e3));
  const to = iso(new Date(today.getTime() + 30 * 86400e3));
  const years = [...new Set([today.getUTCFullYear(), Number(to.slice(0, 4))])];
  const jobs = WIKI_LISTS.flatMap(([page, label]) => years.map((y) => ({ page, label, y })));
  const all = (
    await mapLimit(jobs, 3, async ({ page, label, y }) => {
      const r = await fetchText(
        `https://en.wikipedia.org/w/api.php?action=parse&page=List_of_${page}_films_of_${y}&prop=text&format=json&formatversion=2&redirects=1`,
        { accept: "application/json", timeoutMs: 30_000, maxBytes: 8_000_000 },
      );
      const html = r.ok ? (JSON.parse(r.text) as { parse?: { text?: string } }).parse?.text : undefined;
      if (!html) {
        if (r.status !== 404 && !r.text.includes("missingtitle")) log(`culture: wikipedia ${page} ${y} ${r.status}`);
        return [];
      }
      return parseWikiFilms(html, y, label);
    })
  ).flat();
  const t = iso(today);
  const seen = new Set<string>();
  const uniq = all.filter((m) => !seen.has(m.url) && seen.add(m.url));
  // Spread the picks across languages so one big list doesn't crowd out the rest.
  const spread = (xs: Movie[], max: number, newestFirst: boolean) => {
    const sorted = [...xs].sort((a, b) => (newestFirst ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
    const per = new Map<string, number>();
    const picked: Movie[] = [];
    for (const m of sorted) {
      const n = per.get(m.language ?? "") ?? 0;
      if (n >= 3) continue;
      per.set(m.language ?? "", n + 1);
      picked.push(m);
      if (picked.length >= max) break;
    }
    return picked.sort((a, b) => (newestFirst ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  };
  return {
    now: spread(uniq.filter((m) => m.date >= from && m.date <= t), 10, true),
    soon: spread(uniq.filter((m) => m.date > t && m.date <= to), 10, false),
  };
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
