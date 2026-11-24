// Document shell, mastheads and footer shared by every page.

import type { Edition } from "../types.ts";
import { CITIES, editionName, editionPath, esc, istClock, longDate, shortDate } from "./helpers.ts";

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
 * and the reader's city (so the city section opens on it without a flash),
 * and swaps any picture that fails to load for its placeholder. Must stay byte-identical
 * across pages: its hash is pinned in the Content-Security-Policy.
 */
export const HEAD_SCRIPT =
  `(function(){var d=document.documentElement;d.className+=" js";try{var q=new URLSearchParams(location.search).get("theme"),t=q==="light"||q==="dark"?q:localStorage.getItem("meridian:theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);var c=localStorage.getItem("meridian:city");if(/^(${CITIES.map((c) => c.id).join("|")})$/.test(c))d.setAttribute("data-city",c)}catch(e){}` +
  `document.addEventListener("error",function(e){var i=e.target;if(i&&i.tagName==="IMG"){var p=i.closest(".pic");if(p){p.classList.add("is-broken");i.remove()}}},true)})();`;

/** Browser chrome colours; must match --bg in site.css (site.js keeps them in sync on toggle). */
export const THEME_COLORS = { light: "#ffffff", dark: "#111111" } as const;

/** The public address. Each page names its own URL here as canonical, so the www and
 * workers.dev copies of the site don't compete with it in search results. */
export const SITE_ORIGIN = "https://measurededition.com";

export interface PageOpts {
  title: string;
  /** Site path of this page ("/e/<id>/<story>/"), given as its canonical URL. */
  canonicalPath?: string;
  /** Keep this page out of search (the 404 page). Fixture builds are always kept out. */
  noindex?: boolean;
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
${o.ctx.sample ? `<meta name="robots" content="noindex, nofollow">` : o.noindex ? `<meta name="robots" content="noindex">` : ""}
${o.canonicalPath && !o.ctx.sample ? `<link rel="canonical" href="${SITE_ORIGIN}${esc(o.canonicalPath)}">` : ""}
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="${THEME_COLORS.light}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${THEME_COLORS.dark}" media="(prefers-color-scheme: dark)">
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

const ICON_THEME = `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 2.75a7.25 7.25 0 0 1 0 14.5z" fill="currentColor"/></svg>`;
export const ICON_BACK = `<svg class="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function themeToggle(): string {
  return `<button class="icon-btn theme-toggle" type="button" data-theme-toggle aria-label="Switch theme" hidden>${ICON_THEME}<span class="visually-hidden theme-toggle-label">Theme</span></button>`;
}

/** Masthead for an edition front page: wordmark, theme button, and one edition line. */
export function frontMasthead(ed: Edition, ctx: SiteCtx): string {
  const sameDay = ctx.editions.filter((e) => e.date === ed.date && e.id !== ed.id);
  const other = sameDay[0];
  const otherLink = other
    ? `<a class="mast-link" href="${editionPath(other.id)}">${editionName(other)}</a>`
    : "";
  return `<header class="masthead">
<div class="wrap mast-row">
<h1 class="wordmark"><a href="/">Measured Edition</a></h1>
${themeToggle()}
</div>
<div class="wrap mast-sub">
<p class="edition-line"><strong>${editionName(ed)}</strong><span><time datetime="${esc(ed.publishedAt)}"><span class="date-long">${esc(longDate(ed.date))}</span><span class="date-short">${esc(shortDate(ed.date))}</span></time></span><span><span class="date-long">Updated </span>${istClock(ed.publishedAt)}</span></p>
<p class="mast-links">${otherLink}<a class="mast-link" href="/archive/">All editions</a></p>
</div>
</header>`;
}

/**
 * Compact top bar for articles, the archive and the 404 page: a way back on the left, the
 * wordmark in the middle, the theme button on the right. Sticky, so the way back is always
 * one tap away.
 */
export function slimMasthead(ctx: SiteCtx, back?: string): string {
  const left = back ?? `<a class="back" href="/">${ICON_BACK}<span>Latest</span></a>`;
  return `<header class="topbar">
<div class="wrap topbar-row">
<div class="topbar-left">${left}</div>
<a class="wordmark wordmark--slim" href="/">Measured Edition</a>
<div class="topbar-right">${themeToggle()}</div>
</div>
</header>`;
}

function footer(ctx: SiteCtx): string {
  return `<footer class="site-foot">
<div class="wrap foot-grid">
<p class="foot-mark">Measured Edition</p>
<div class="foot-note">
<p>Stories on Measured Edition are written by AI from the reporting of the outlets credited on each story, and edited for balance across outlets of different leanings. Pictures belong to their credited owners and link to where they were published.</p>
<p>No ads, no tracking. Which stories you have read is remembered only in this browser.</p>
</div>
<nav class="foot-nav" aria-label="Site">
<a href="/">Latest edition</a>
<a href="/archive/">All editions</a>
</nav>
</div>
</footer>`;
}
