// Document shell, mastheads and footer shared by every page.

import type { Edition } from "../types.ts";
import { editionName, editionPath, esc, istTime, longDate, shortDate, slotName } from "./helpers.ts";

export interface SiteCtx {
  /** All editions, oldest first. */
  editions: Edition[];
  latest: Edition;
  /** True when any edition is a fixture: every page then carries a "sample" banner. */
  sample: boolean;
  css: string;
  js: string;
  fontPreloads: string[];
}

/**
 * Runs in <head> before first paint: applies a saved theme (or ?theme=light|dark, not saved)
 * and swaps any picture that fails to load for its typographic card. Must stay byte-identical
 * across pages: its hash is pinned in the Content-Security-Policy.
 */
export const HEAD_SCRIPT =
  `(function(){var d=document.documentElement;d.className+=" js";try{var q=new URLSearchParams(location.search).get("theme"),t=q==="light"||q==="dark"?q:localStorage.getItem("meridian:theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t)}catch(e){}` +
  `document.addEventListener("error",function(e){var i=e.target;if(i&&i.tagName==="IMG"){var p=i.closest(".pic");if(p){p.classList.add("is-broken");i.remove()}}},true)})();`;

export interface PageOpts {
  title: string;
  description?: string;
  bodyClass: string;
  bodyAttrs?: Record<string, string>;
  header: string;
  main: string;
  ctx: SiteCtx;
}

export function page(o: PageOpts): string {
  const attrs = Object.entries(o.bodyAttrs ?? {})
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join("");
  const preloads = o.ctx.fontPreloads
    .map((href) => `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`)
    .join("\n");
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(o.title)}</title>
${o.description ? `<meta name="description" content="${esc(o.description)}">` : ""}
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f5f7fa" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#10151d" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<script>${HEAD_SCRIPT}</script>
${preloads}
<link rel="stylesheet" href="${o.ctx.css}">
<script src="${o.ctx.js}" defer></script>
</head>
<body class="${esc(o.bodyClass)}"${attrs}>
<a class="skip" href="#main">Skip to main content</a>
${o.ctx.sample ? `<p class="sample-banner">Sample edition: these stories are invented, for testing the site. They are not news.</p>` : ""}
${o.header}
<main id="main" tabindex="-1">
${o.main}
</main>
${footer(o.ctx)}
</body>
</html>
`;
}

export function themeToggle(): string {
  return `<button class="theme-toggle" type="button" data-theme-toggle hidden>
<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 2.75a7.25 7.25 0 0 1 0 14.5z" fill="currentColor"/></svg>
<span class="theme-toggle-label">Theme</span>
</button>`;
}

/**
 * The graduated neatline: a map border whose 24 segments are the hours of the IST day,
 * with the two edition times marked and the current edition's mark emphasised.
 * `labels: false` keeps the ticks but drops the times (slim mastheads).
 */
export function neatline(current?: Edition["slot"], opts: { labels?: boolean } = {}): string {
  const labels = opts.labels ?? true;
  const tick = (slot: Edition["slot"]) => {
    const hour = slot === "morning" ? "05" : "17";
    const cur = current === slot ? " is-current" : "";
    return `<span class="tick at-${hour}${cur}">${labels ? `${hour}:00` : ""}</span>`;
  };
  return `<div class="neatline${labels ? "" : " neatline--ticks"}" aria-hidden="true"><div class="neatline-bar"></div><div class="neatline-scale">${tick("morning")}${tick("evening")}</div></div>`;
}

/** Morning / Evening switch for an edition's date, plus the archive. */
function editionSwitch(ed: Edition, ctx: SiteCtx): string {
  const sameDay = ctx.editions.filter((e) => e.date === ed.date);
  const cell = (slot: Edition["slot"]) => {
    const e = sameDay.find((x) => x.slot === slot);
    const label = slotName(slot);
    if (e && e.id === ed.id) return `<a class="seg is-current" href="${editionPath(e.id)}" aria-current="page">${label}</a>`;
    if (e) return `<a class="seg" href="${editionPath(e.id)}">${label}</a>`;
    const due = ed.id === ctx.latest.id && slot === "evening" ? `${label} at 17:00` : label;
    return `<span class="seg is-absent" aria-disabled="true">${due}</span>`;
  };
  return `<nav class="edition-switch" aria-label="Editions">
<div class="segs">${cell("morning")}${cell("evening")}</div>
<a class="archive-link" href="/archive/">All editions</a>
</nav>`;
}

/** Full masthead for an edition front page. */
export function frontMasthead(ed: Edition, ctx: SiteCtx): string {
  const time = istTime(ed.publishedAt);
  return `<header class="masthead masthead--front">
<div class="wrap">
<div class="mast-top">
<p class="margin-note margin-note--left">Compiled in Bengaluru<br><span class="coord">12°58′ N 77°35′ E</span></p>
<h1 class="wordmark"><a href="/">Meridian</a></h1>
<div class="mast-tools">
<p class="margin-note margin-note--right">All times IST<br><span class="coord">the 82°30′ E meridian</span></p>
${themeToggle()}
</div>
</div>
<div class="mast-edition">
<p class="edition-line"><strong>${editionName(ed)}</strong><span class="sep" aria-hidden="true"></span><time datetime="${esc(ed.publishedAt)}"><span class="date-long">${esc(longDate(ed.date))}</span><span class="date-short">${esc(shortDate(ed.date))}</span></time><span class="sep" aria-hidden="true"></span><span>${time} IST</span></p>
${editionSwitch(ed, ctx)}
</div>
${neatline(ed.slot)}
</div>
</header>`;
}

/** Compact masthead for articles, the archive and the 404 page. */
export function slimMasthead(ctx: SiteCtx, ed?: Edition): string {
  const editionLink = ed
    ? `<a class="mast-edition-link" href="${editionPath(ed.id)}">${editionName(ed)}<span class="sep" aria-hidden="true"></span><span>${esc(shortDate(ed.date))}</span></a>`
    : "";
  return `<header class="masthead masthead--slim">
<div class="wrap">
<div class="mast-row">
<a class="wordmark wordmark--slim" href="/">Meridian</a>
${editionLink}
${themeToggle()}
</div>
${neatline(ed?.slot, { labels: false })}
</div>
</header>`;
}

function footer(ctx: SiteCtx): string {
  return `<footer class="site-foot">
<div class="wrap">
<div class="foot-grid">
<p class="foot-mark">Meridian</p>
<div class="foot-note">
<p>Stories on Meridian are written by AI from the reporting of the outlets credited on each story, and edited for balance across outlets of different leanings. Pictures belong to their credited owners and link to where they were published.</p>
<p>No ads, no tracking. Which stories you have read is remembered only in this browser.</p>
</div>
<nav class="foot-nav" aria-label="Site">
<a href="/">Latest edition</a>
<a href="/archive/">All editions</a>
</nav>
</div>
</div>
</footer>`;
}
