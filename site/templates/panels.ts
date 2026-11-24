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
  return `<li class="wx-city" data-wx="${esc(c.name.toLowerCase())}">
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

/**
 * A labelled line chart of the closes. The line is neutral on purpose: colour belongs to the
 * labelled changes above it, so the chart can never seem to contradict them. A dashed line marks
 * where the period started, so above it is up and below it is down; the right edge gives the
 * period's high and low and the bottom edge its first and last dates.
 */
function chart(q: MarketQuote): string {
  const h = q.history;
  if (h.length < 3) return "";
  const vals = h.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const W = 600;
  const H = 120;
  const x = (i: number) => (i / (h.length - 1)) * W;
  const y = (v: number) => 6 + (1 - (v - lo) / span) * (H - 12);
  const line = h.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `M0,${H} L${line.replace(/ /g, " L")} L${W},${H} Z`;
  const y0 = y(vals[0]).toFixed(1);
  const lastX = x(h.length - 1).toFixed(1);
  const lastY = y(vals[vals.length - 1]).toFixed(1);
  const first = h[0];
  const last = h[h.length - 1];
  const label = `${q.name} from ${dayMonth(first.date)} to ${dayMonth(last.date)}: ${fmt(first.value, q.decimals)} to ${fmt(last.value, q.decimals)}, low ${fmt(lo, q.decimals)}, high ${fmt(hi, q.decimals)}`;
  const axis = (v: number) => fmt(v, v >= 1000 ? 0 : q.decimals);
  return `<figure class="mk-fig">
<div class="mk-plot"><svg class="mk-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}" focusable="false">
<path class="mk-area" d="${area}"/>
<line class="mk-base" x1="0" y1="${y0}" x2="${W}" y2="${y0}" vector-effect="non-scaling-stroke"/>
<polyline class="mk-line" points="${line}" vector-effect="non-scaling-stroke"/>
<line class="mk-dot" x1="${lastX}" y1="${lastY}" x2="${lastX}" y2="${lastY}" vector-effect="non-scaling-stroke"/>
</svg><span class="mk-axis" aria-hidden="true"><span>${axis(hi)}</span><span>${axis(lo)}</span></span></div>
<figcaption class="mk-dates" aria-hidden="true"><span>${esc(dayMonth(first.date))}</span><span>${esc(dayMonth(last.date))}</span></figcaption>
</figure>`;
}

function move(label: string, change: number, pct: number, decimals: number): string {
  const dir = change > 0 ? "up" : change < 0 ? "down" : "flat";
  return `<div class="mk-move"><dt>${esc(label)}</dt><dd class="is-${dir}">${signed(change, decimals)} <span class="mk-pct">(${signed(pct, 2)}%)</span></dd></div>`;
}

function quoteTile(q: MarketQuote): string {
  const h = q.history;
  const start = h.length > 2 ? h[0] : undefined;
  const sinceChange = start ? q.value - start.value : 0;
  const when = q.id === "bitcoin" ? "Latest price" : `${dayMonth(q.asOf)} close`;
  return `<li class="mk">
<div class="mk-top"><h4 class="mk-name">${esc(q.name)}${q.per ? ` <span class="mk-per">${esc(q.per)}</span>` : ""}</h4><span class="mk-when">${esc(when)}</span></div>
<p class="mk-value">${esc(q.unit)}${fmt(q.value, q.decimals)}</p>
<dl class="mk-moves">
${move(q.id === "bitcoin" ? "24 hours" : "On the day", q.change, q.changePct, q.decimals)}
${start ? move(`Since ${dayMonth(start.date)}`, sinceChange, (sinceChange / start.value) * 100, q.decimals) : ""}
</dl>
${chart(q)}
<p class="mk-src">${esc(q.source)}</p>
</li>`;
}

export function marketsPanel(p: MarketsPanel): string {
  if (p.quotes.length === 0) return "";
  return `<div class="panel panel--markets">
<ul class="mk-grid">${p.quotes.map(quoteTile).join("\n")}</ul>
<p class="panel-note">“On the day” compares the latest close with the one before; bitcoin compares the latest price with 24 hours earlier. The chart and the “since” figure cover the period shown under each chart. Green is up, red is down.</p>
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
    lists.push(`<section class="tl" aria-labelledby="tl-gh"><h3 class="panel-title" id="tl-gh">Rising fast on GitHub</h3>
<ul>${p.repos.map((r) => techItem(r.name, r.url, r.what, [`${compact(r.stars)} stars`, ...(r.perDay ? [`about ${compact(r.perDay)} a day`] : []), ...(r.language ? [esc(r.language)] : []), ageDays(r.createdAt, p.fetchedAt)])).join("\n")}</ul></section>`);
  if (p.models.length)
    lists.push(`<section class="tl" aria-labelledby="tl-hf"><h3 class="panel-title" id="tl-hf">Trending on Hugging Face</h3>
<ul>${p.models.map((m) => techItem(m.name, m.url, m.what, [`${compact(m.likes)} likes`, ...(m.downloads > 0 ? [`${compact(m.downloads)} downloads`] : [])])).join("\n")}</ul></section>`);
  if (p.tools.length)
    lists.push(`<section class="tl" aria-labelledby="tl-hn"><h3 class="panel-title" id="tl-hn">Launched on Hacker News</h3>
<ul>${p.tools.map((t) => techItem(t.name, t.url, t.what, [`${num(t.points)} points`, `<a href="${esc(t.discussionUrl)}" ${EXT}>${num(t.comments)} comments</a>`])).join("\n")}</ul></section>`);
  if (!lists.length) return "";
  return `<div class="panel panel--tech">
<div class="tl-grid">${lists.join("\n")}</div>
<p class="panel-note">From GitHub (repositories under a month old gaining the most stars a day, with spam and piracy screened out), Hugging Face’s trending list and Hacker News “Show HN” posts. The one-line descriptions are ours.</p>
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

const PLAY = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>`;

function filmRow(m: Movie, upcoming: boolean): string {
  const img = m.poster
    ? `<img src="${esc(m.poster)}" alt="" width="185" height="278" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<span class="film-noposter">${esc(m.title)}</span>`;
  const trailer = m.trailer && /^[A-Za-z0-9_-]{11}$/.test(m.trailer) ? m.trailer : "";
  const yt = (cls: string, extra: string) =>
    `<a class="${cls}" href="https://www.youtube.com/watch?v=${trailer}" data-yt="${trailer}" data-yt-modal data-title="${esc(`${m.title}: trailer`)}" ${EXT}${extra}>`;
  // With a trailer the poster also plays it (a pointer shortcut; the "Trailer" link is the one
  // keyboards and screen readers get).
  const poster = trailer
    ? `${yt("film-poster film-poster--play", ' tabindex="-1" aria-hidden="true"')}${img}<span class="film-play">${PLAY}</span></a>`
    : `<span class="film-poster">${img}</span>`;
  return `<li class="film">
${poster}
<a class="film-name" href="${esc(m.url)}" ${EXT}>${esc(m.title)}</a>
<span class="film-meta">${upcoming ? "Out" : "Released"} ${esc(dayMonth(m.date))}${m.language ? ` · ${esc(m.language)}` : ""}</span>
${trailer ? `${yt("film-trailer", "")}${PLAY}<span>Trailer<span class="visually-hidden">: ${esc(m.title)}</span></span></a>` : ""}
</li>`;
}

/** Poster cards when the source has posters; otherwise a dated list. */
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
  const anyFilms = [...(p.nowShowing ?? []), ...(p.comingSoon ?? [])];
  // Poster strips get the full width; plain lists sit side by side on wide screens.
  if (films.length) parts.push(anyFilms.some((m) => m.poster) ? films.join("\n") : `<div class="film-cols">${films.join("\n")}</div>`);
  if (!parts.length) return "";
  const tmdb = anyFilms.some((m) => m.url.includes("themoviedb.org"))
    ? " Film listings use the TMDB API but are not endorsed or certified by TMDB."
    : anyFilms.length
      ? " Films are the releases, in cinemas or streaming, that most people have been reading about on Wikipedia over the past few days. Posters from Wikipedia; trailers play from YouTube."
      : "";
  return `<div class="panel panel--culture">
${parts.join("\n")}
<p class="panel-note">Charts from Apple Music, updated daily.${tmdb}</p>
</div>`;
}
