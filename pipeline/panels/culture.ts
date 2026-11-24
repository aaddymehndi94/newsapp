// Entertainment panel: what people are listening to and what's on at the cinema.
//   Top songs: Apple Music most-played charts (Apple's public marketing-tools RSS).
//   Films: The Movie Database (TMDB), only when TMDB_API_KEY is set. Uses the TMDB API but is
//   not endorsed or certified by TMDB.
import type { ChartSong, CulturePanel, Movie } from "../../site/types.ts";
import { fetchText, log } from "../util.ts";

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

export async function culturePanel(): Promise<CulturePanel | undefined> {
  const safe = async <T>(name: string, p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch (e) {
      log(`culture: ${name} failed: ${(e as Error).message}`);
      return fallback;
    }
  };
  const [india, us, now, soon] = await Promise.all([
    safe("chart in", chart("in"), []),
    safe("chart us", chart("us"), []),
    safe("now playing", tmdb("now_playing"), []),
    safe("upcoming", tmdb("upcoming"), []),
  ]);
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
