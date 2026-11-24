// Data panels shown inside their sections: weather, markets, the AI & software lists and the
// entertainment charts. All values come from the edition JSON (validated by schema.ts) and are
// escaped on output; links are http(s) only.

import type { ChartSong, CulturePanel, MarketQuote, MarketsPanel, Movie, TechPanel, WeatherCity, WeatherPanel } from "../types.ts";
import { dayMonth, esc, istClock, num } from "./helpers.ts";

const EXT = 'target="_blank" rel="noopener noreferrer nofollow"';

// ───────────── weather ─────────────

type Sky = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "thunder" | "snow";

/** WMO weather code (as used by Open-Meteo) → words and icon. */
export function weatherWords(code: number): { label: string; sky: Sky } {
  const t: [number[], string, Sky][] = [
    [[0], "Clear", "clear"],
    [[1], "Mostly clear", "clear"],
    [[2], "Partly cloudy", "partly"],
    [[3], "Cloudy", "cloudy"],
    [[45, 48], "Fog", "fog"],
    [[51, 53, 55], "Drizzle", "drizzle"],
    [[56, 57], "Freezing drizzle", "drizzle"],
    [[61], "Light rain", "rain"],
    [[63], "Rain", "rain"],
    [[65], "Heavy rain", "rain"],
    [[66, 67], "Freezing rain", "rain"],
    [[71, 73, 75, 77], "Snow", "snow"],
    [[80], "Light showers", "rain"],
    [[81], "Showers", "rain"],
    [[82], "Heavy showers", "rain"],
    [[85, 86], "Snow showers", "snow"],
    [[95], "Thunderstorms", "thunder"],
    [[96, 99], "Thunderstorms with hail", "thunder"],
  ];
  const hit = t.find(([codes]) => codes.includes(code));
  return hit ? { label: hit[1], sky: hit[2] } : { label: "Mixed", sky: "cloudy" };
}

const CLOUD = "M7 18.5h10.2a4.3 4.3 0 0 0 .5-8.6 5.8 5.8 0 0 0-11.1 1.6A3.6 3.6 0 0 0 7 18.5z";
const CLOUD_HI = "M7 15h10.2a4.3 4.3 0 0 0 .5-8.6 5.8 5.8 0 0 0-11.1 1.6A3.6 3.6 0 0 0 7 15z";
const SKY_ICON: Record<Sky, string> = {
  clear: `<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>`,
  partly: `<path d="M8.6 3.4v1.6M3.2 8.8h1.6M4.8 5l1.1 1.1M12.4 5l-1.1 1.1"/><path d="M5.6 11.2a3.4 3.4 0 0 1 6-2.9"/><path d="M9 20h8.6a3.6 3.6 0 0 0 .4-7.2 4.9 4.9 0 0 0-9.4 1.3A3 3 0 0 0 9 20z"/>`,
  cloudy: `<path d="${CLOUD}"/>`,
  fog: `<path d="${CLOUD_HI}"/><path d="M4 18.5h16M6 21.5h12"/>`,
  drizzle: `<path d="${CLOUD_HI}"/><path d="M8.5 18.5v1M12 19v1M15.5 18.5v1"/>`,
  rain: `<path d="${CLOUD_HI}"/><path d="M8.5 17.5l-1 3.5M12.5 17.5l-1 3.5M16.5 17.5l-1 3.5"/>`,
  thunder: `<path d="${CLOUD_HI}"/><path d="M12.8 16.2l-2.3 3.4h3l-2.2 3.3"/>`,
  snow: `<path d="${CLOUD_HI}"/><path d="M8.5 19h.01M12 21h.01M15.5 19h.01M10.2 22.2h.01M13.8 17.6h.01" stroke-width="2.4"/>`,
};

function skyIcon(sky: Sky): string {
  return `<svg class="wx-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${SKY_ICON[sky]}</svg>`;
}

// Where each city's label sits relative to its dot, so neighbours don't collide.
const LABEL_SIDE: Record<string, "l" | "r"> = { Bengaluru: "l", Chennai: "r", Mumbai: "l", Pune: "r", Kochi: "l", Kolkata: "l", Delhi: "r", Hyderabad: "r" };

function satellite(p: WeatherPanel): string {
  const s = p.satellite;
  if (!s) return "";
  const [south, west, north, east] = s.bbox;
  const W = s.width;
  const H = s.height;
  const marks = p.cities
    .filter((c) => c.lat > south && c.lat < north && c.lon > west && c.lon < east)
    .map((c) => {
      const x = ((c.lon - west) / (east - west)) * W;
      const y = ((north - c.lat) / (north - south)) * H;
      const side = LABEL_SIDE[c.name] ?? "r";
      const tx = side === "r" ? x + 14 : x - 14;
      return `<g class="sat-mark"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7"/><text x="${tx.toFixed(1)}" y="${(y + 9).toFixed(1)}" text-anchor="${side === "r" ? "start" : "end"}">${esc(c.name)} ${c.today.max}°</text></g>`;
    })
    .join("");
  const when = istClock(s.time);
  return `<figure class="sat">
<div class="sat-frame">
<img src="${esc(s.url)}" alt="Infrared satellite image of India and the surrounding seas at ${esc(when)} IST, with today's highs for eight cities" width="${W}" height="${H}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
<svg class="sat-overlay" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">${marks}</svg>
</div>
<figcaption>Infrared view from the Meteosat satellite at ${esc(when)} IST. The whiter the cloud, the higher and colder its top. Labels show today’s highs. <span class="credit">${esc(s.credit)}</span></figcaption>
</figure>`;
}

function cityRow(c: WeatherCity): string {
  const w = weatherWords(c.today.code);
  const bits = [esc(w.label)];
  if (c.today.rainChance >= 20) bits.push(`${c.today.rainChance}% chance of rain`);
  const aqi = c.aqi
    ? `<span class="aqi${c.aqi.value > 200 ? " is-bad" : ""}">Air quality ${num(c.aqi.value)}, ${esc(c.aqi.category.toLowerCase())}</span>`
    : "";
  return `<li class="wx-city">
<div class="wx-name"><h4>${esc(c.name)}</h4><p>${bits.join(" · ")}</p>${aqi ? `<p>${aqi}</p>` : ""}</div>
${skyIcon(w.sky)}
<p class="wx-temps"><span class="hi">${c.today.max}°</span><span class="lo"><span class="visually-hidden">low </span>${c.today.min}°</span></p>
</li>`;
}

export function weatherPanel(p: WeatherPanel): string {
  if (p.cities.length === 0) return "";
  return `<div class="panel panel--weather${p.satellite ? "" : " is-solo"}">
<div class="wx-list-wrap">
<h3 class="panel-title">Today in eight cities</h3>
<ul class="wx-list">${p.cities.map(cityRow).join("\n")}</ul>
<p class="panel-note">Forecasts: Open-Meteo. Air quality is India’s AQI worked out from modelled PM2.5 and PM10 levels (CAMS), so treat it as an estimate.</p>
</div>
${satellite(p)}
</div>`;
}

// ───────────── markets ─────────────

const MINUS = "−";

function fmt(v: number, decimals: number): string {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}
function signed(v: number, decimals: number): string {
  return `${v < 0 ? MINUS : "+"}${fmt(Math.abs(v), decimals)}`;
}

/** A real (if small) line chart: 30 closes, scaled to their own range, labelled underneath. */
function chart(q: MarketQuote): string {
  const h = q.history;
  if (h.length < 3) return "";
  const vals = h.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const W = 300;
  const H = 64;
  const pts = h.map((p, i) => `${((i / (h.length - 1)) * W).toFixed(1)},${(H - 4 - ((p.value - lo) / span) * (H - 8)).toFixed(1)}`).join(" ");
  const trend = vals[vals.length - 1] >= vals[0] ? "up" : "down";
  const first = h[0];
  const last = h[h.length - 1];
  const label = `${q.name} from ${dayMonth(first.date)} to ${dayMonth(last.date)}: ${fmt(first.value, q.decimals)} to ${fmt(last.value, q.decimals)}, low ${fmt(lo, q.decimals)}, high ${fmt(hi, q.decimals)}`;
  const axis = (v: number) => fmt(v, v >= 1000 ? 0 : q.decimals);
  return `<div class="mk-plot"><svg class="mk-chart is-${trend}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}" focusable="false"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg><span class="mk-axis" aria-hidden="true"><span>${axis(hi)}</span><span>${axis(lo)}</span></span></div>`;
}

function quoteTile(q: MarketQuote): string {
  const dir = q.change > 0 ? "up" : q.change < 0 ? "down" : "flat";
  return `<li class="mk">
<h4 class="mk-name">${esc(q.name)}${q.per ? ` <span class="mk-per">${esc(q.per)}</span>` : ""}</h4>
<p class="mk-value">${esc(q.unit)}${fmt(q.value, q.decimals)}</p>
<p class="mk-change is-${dir}">${signed(q.change, q.decimals)} (${signed(q.changePct, 2)}%)</p>
${chart(q)}
<p class="mk-src">${q.history.length > 2 ? `${esc(dayMonth(q.history[0].date))} to ` : ""}${esc(dayMonth(q.asOf))} · ${esc(q.source)}</p>
</li>`;
}

export function marketsPanel(p: MarketsPanel): string {
  if (p.quotes.length === 0) return "";
  return `<div class="panel panel--markets">
<ul class="mk-grid">${p.quotes.map(quoteTile).join("\n")}</ul>
<p class="panel-note">Closing prices, with the change from the previous close; bitcoin is the latest price. Charts cover about a month.</p>
</div>`;
}

// ───────────── AI & software ─────────────

function ageDays(iso: string, now: string): string {
  const d = Math.max(0, Math.round((Date.parse(now) - Date.parse(iso)) / 86400e3));
  return d <= 0 ? "new today" : d === 1 ? "1 day old" : `${d} days old`;
}

function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(0)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

function techItem(name: string, url: string, what: string, meta: string[]): string {
  return `<li class="tl-item">
<h4><a href="${esc(url)}" ${EXT}>${esc(name)}</a></h4>
<p class="tl-what">${esc(what)}</p>
<p class="meta">${meta.map((m) => `<span>${m}</span>`).join("")}</p>
</li>`;
}

export function techPanel(p: TechPanel): string {
  const lists: string[] = [];
  if (p.repos.length)
    lists.push(`<section class="tl" aria-labelledby="tl-gh"><h3 class="panel-title" id="tl-gh">New on GitHub this week</h3>
<ul>${p.repos.map((r) => techItem(r.name, r.url, r.what, [`${compact(r.stars)} stars`, ...(r.language ? [esc(r.language)] : []), ageDays(r.createdAt, p.fetchedAt)])).join("\n")}</ul></section>`);
  if (p.models.length)
    lists.push(`<section class="tl" aria-labelledby="tl-hf"><h3 class="panel-title" id="tl-hf">Trending on Hugging Face</h3>
<ul>${p.models.map((m) => techItem(m.name, m.url, m.what, [`${compact(m.likes)} likes`, ...(m.downloads > 0 ? [`${compact(m.downloads)} downloads`] : [])])).join("\n")}</ul></section>`);
  if (p.tools.length)
    lists.push(`<section class="tl" aria-labelledby="tl-hn"><h3 class="panel-title" id="tl-hn">Launched on Hacker News</h3>
<ul>${p.tools.map((t) => techItem(t.name, t.url, t.what, [`${num(t.points)} points`, `<a href="${esc(t.discussionUrl)}" ${EXT}>${num(t.comments)} comments</a>`])).join("\n")}</ul></section>`);
  if (!lists.length) return "";
  return `<div class="panel panel--tech">
<div class="tl-grid">${lists.join("\n")}</div>
<p class="panel-note">From GitHub (new repositories with the most stars), Hugging Face’s trending list and Hacker News “Show HN” posts. The one-line descriptions are Meridian’s.</p>
</div>`;
}

// ───────────── entertainment ─────────────

function songRow(s: ChartSong, i: number): string {
  const art = s.artwork
    ? `<img src="${esc(s.artwork)}" alt="" width="160" height="160" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : "";
  return `<li class="song${i >= 5 ? " song--more" : ""}">
<span class="song-rank">${s.rank}</span>
<span class="song-art">${art}</span>
<span class="song-text"><a href="${esc(s.url)}" ${EXT}>${esc(s.title)}</a><span class="song-artist">${esc(s.artist)}</span></span>
</li>`;
}

function filmRow(m: Movie, upcoming: boolean): string {
  const poster = m.poster ? `<img src="${esc(m.poster)}" alt="" width="185" height="278" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : "";
  return `<li class="film">
<span class="film-poster">${poster}</span>
<a href="${esc(m.url)}" ${EXT}>${esc(m.title)}</a>
<span class="film-meta">${upcoming ? `Out ${esc(dayMonth(m.date))}` : `Since ${esc(dayMonth(m.date))}`}${m.language ? ` · ${esc(m.language)}` : ""}</span>
</li>`;
}

/** Posters when the source has them (TMDB); otherwise a dated list. */
function filmList(ms: Movie[], upcoming: boolean): string {
  if (ms.some((m) => m.poster)) return `<ul class="film-strip">${ms.map((m) => filmRow(m, upcoming)).join("")}</ul>`;
  return `<ul class="film-list">${ms
    .map(
      (m) => `<li><time datetime="${esc(m.date)}">${esc(dayMonth(m.date))}</time><span class="film-title"><a href="${esc(m.url)}" ${EXT}>${esc(m.title)}</a>${m.language ? `<span class="film-lang">${esc(m.language)}</span>` : ""}</span></li>`,
    )
    .join("")}</ul>`;
}

export function culturePanel(p: CulturePanel): string {
  const parts: string[] = [];
  if (p.charts.length) {
    const cols = p.charts
      .map(
        (c) => `<section class="chart" aria-labelledby="ch-${esc(c.id)}"><h4 class="chart-name" id="ch-${esc(c.id)}">${esc(c.name)}</h4>
<ol class="songs">${c.songs.slice(0, 5).map(songRow).join("\n")}</ol>
${c.songs.length > 5 ? `<details class="songs-more"><summary>Show ${c.songs.length - 5} more</summary><ol class="songs" start="6">${c.songs.slice(5).map((s, i) => songRow(s, i)).join("\n")}</ol></details>` : ""}
</section>`,
      )
      .join("\n");
    parts.push(`<div class="charts"><h3 class="panel-title">Most played on Apple Music</h3><div class="chart-cols">${cols}</div></div>`);
  }
  const films: string[] = [];
  if (p.nowShowing?.length) films.push(`<section class="films" aria-labelledby="fl-now"><h3 class="panel-title" id="fl-now">New releases</h3>${filmList(p.nowShowing, false)}</section>`);
  if (p.comingSoon?.length) films.push(`<section class="films" aria-labelledby="fl-soon"><h3 class="panel-title" id="fl-soon">Coming soon</h3>${filmList(p.comingSoon, true)}</section>`);
  if (films.length) parts.push(`<div class="film-cols">${films.join("\n")}</div>`);
  if (!parts.length) return "";
  const anyFilms = [...(p.nowShowing ?? []), ...(p.comingSoon ?? [])];
  const tmdb = anyFilms.some((m) => m.url.includes("themoviedb.org"))
    ? " Film listings use the TMDB API but are not endorsed or certified by TMDB."
    : anyFilms.length
      ? " Film release dates from Wikipedia’s lists of Hindi, Kannada, Tamil, Telugu, Malayalam and American films (cinema and streaming)."
      : "";
  return `<div class="panel panel--culture">
${parts.join("\n")}
<p class="panel-note">Charts from Apple Music, updated daily.${tmdb}</p>
</div>`;
}
