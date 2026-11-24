// Shared rendering helpers. Every piece of edition text is untrusted (LLM output and outlet
// metadata), so everything goes through esc()/attrUrl() and nothing is interpolated raw.

import type { Edition, Leaning, Story } from "../types.ts";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape text for HTML element content and quoted attribute values. */
export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
}

/** Return the URL if it is an absolute http(s) URL, else null. */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4000) return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

/** A string that is present and not just whitespace. */
export function has(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const EXTERNAL = 'target="_blank" rel="noopener noreferrer nofollow"';

/**
 * Render the body's limited inline markdown: *italic* and [text](url) with http(s) URLs only.
 * Anything else is shown as escaped text.
 */
export function inline(md: string): string {
  const re = /\[([^\]\n]{1,400})\]\(([^)\s]{1,2000})\)|\*([^*\n]{1,600})\*/g;
  let out = "";
  let last = 0;
  for (const m of md.matchAll(re)) {
    out += esc(md.slice(last, m.index));
    if (m[1] !== undefined) {
      const href = safeHttpUrl(m[2]);
      const text = italicOnly(m[1]);
      out += href ? `<a href="${esc(href)}" ${EXTERNAL}>${text}</a>` : text;
    } else {
      out += `<em>${esc(m[3])}</em>`;
    }
    last = (m.index ?? 0) + m[0].length;
  }
  return out + esc(md.slice(last));
}

function italicOnly(s: string): string {
  return s
    .split(/(\*[^*\n]+\*)/g)
    .map((part) => (/^\*[^*\n]+\*$/.test(part) ? `<em>${esc(part.slice(1, -1))}</em>` : esc(part)))
    .join("");
}

/** Plain-text paragraphs (background etc.) split on blank lines. */
export function paragraphs(text: string, cls = ""): string {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p${cls ? ` class="${cls}"` : ""}>${inline(p)}</p>`)
    .join("\n");
}

// ---------- time (always IST) ----------

const IST = "Asia/Kolkata";
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-IN", { timeZone: IST, ...opts });
    fmtCache.set(key, f);
  }
  return f;
}

export function istTime(iso: string): string {
  return fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}
/** "3:36 am" — how times read on a phone in India. */
export function istClock(iso: string): string {
  return fmt({ hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)).replace(/\s*([ap])\.?m\.?$/i, " $1m").toLowerCase();
}
/** "Tuesday, 24 November 2026" for an edition date "2026-11-24". */
export function longDate(date: string): string {
  return fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00+05:30`));
}
/** "Tue, 24 Nov" */
export function shortDate(date: string): string {
  return fmt({ weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00+05:30`));
}
/** "24 Nov" */
export function dayMonth(date: string): string {
  return fmt({ day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00+05:30`));
}

export function slotName(slot: Edition["slot"]): string {
  return slot === "morning" ? "Morning" : "Evening";
}
export function editionName(ed: Edition): string {
  return `${slotName(ed.slot)} edition`;
}

export function num(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${num(n)} ${n === 1 ? one : many}`;
}

// ---------- paths ----------

export function editionPath(id: string): string {
  return `/e/${id}/`;
}
export function storyPath(editionId: string, storyId: string): string {
  return `/e/${editionId}/${storyId}/`;
}

// ---------- sections ----------

/** Front-page order of every section the site knows. */
export const SECTION_ORDER = [
  "india",
  "world",
  "bengaluru",
  "weather",
  "business",
  "markets",
  "ai-software",
  "science-tech",
  "health-environment",
  "entertainment",
  "sports",
] as const;
const KNOWN_SECTIONS = new Set<string>(SECTION_ORDER);

/** A safe CSS class naming the section (for hooks and tests; sections are not colour-coded). */
export function tint(sectionId: string): string {
  return `s-${KNOWN_SECTIONS.has(sectionId) ? sectionId : "other"}`;
}

const FALLBACK_NAMES: Record<string, string> = {
  india: "India",
  world: "World",
  business: "Business",
  "science-tech": "Science & Tech",
  sports: "Sports",
  "health-environment": "Health & Environment",
  bengaluru: "Bengaluru",
  weather: "Weather",
  markets: "Markets",
  "ai-software": "AI & Software",
  entertainment: "Entertainment",
};

/** The section each data panel lives in. */
export const PANEL_SECTION = { weather: "weather", markets: "markets", tech: "ai-software", culture: "entertainment" } as const;

export function sectionName(ed: Edition, sectionId: string): string {
  return ed.sections.find((s) => s.id === sectionId)?.name ?? FALLBACK_NAMES[sectionId] ?? "News";
}

// ---------- places ----------

/** "NEW DELHI" -> "New Delhi". Where the event happened; Measured Edition has no reporter there. */
export function placeName(dateline: string): string {
  const t = dateline.trim().replace(/[\s,\u2014\u2013-]+$/, "");
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s\-\/(.])(\p{L})/gu, (_, pre: string, ch: string) => pre + ch.toUpperCase());
}

// ---------- pictures ----------

/**
 * Image hosts that refuse hotlinked requests (verified 403 for browsers sending no referrer).
 * Their pictures are treated as missing so the stand-in shows at once instead of after a failed
 * request, and so a section's feature slot goes to a story whose picture will load.
 */
import { HOTLINK_BLOCKED_HOSTS } from "../../config/sources.ts";
// Shared with the pipeline, which avoids choosing these pictures in the first place.
export const BLOCKED_IMAGE_HOSTS = HOTLINK_BLOCKED_HOSTS;

/** The story's picture URL if it is http(s) and not on a host known to block hotlinking. */
export function usableImageUrl(story: Story): string | null {
  const src = story.image ? safeHttpUrl(story.image.url) : null;
  if (!src) return null;
  return BLOCKED_IMAGE_HOSTS.has(new URL(src).hostname) ? null : src;
}

export type PicVariant = "lead" | "feature" | "card" | "thumb" | "hero" | "mini";

const RATIOS: [string, number][] = [
  ["r43", 4 / 3],
  ["r32", 3 / 2],
  ["r169", 16 / 9],
  ["r21", 2],
];

/**
 * The aspect-ratio class nearest the photo's own shape, so a wide outlet picture is shown whole
 * instead of being cut to 3:2. Portrait and square photos use 4:3; unknown sizes use 16:9.
 */
export function ratioClass(width?: number, height?: number): string {
  if (!width || !height || width <= 0 || height <= 0) return "r169";
  const r = width / height;
  if (r < 1.2) return "r43";
  let best = RATIOS[0];
  for (const c of RATIOS) if (Math.abs(Math.log(r / c[1])) < Math.abs(Math.log(r / best[1]))) best = c;
  return best[0];
}

/**
 * A picture box with a fixed aspect ratio (no layout shift). Large pictures (lead, feature,
 * hero) take the ratio nearest the photo's own; thumbnails are a fixed 4:3 crop. Behind the
 * image sits a quiet placeholder naming the section and outlet; it shows while the photo loads,
 * and on its own when there is no photo or it fails (the head script marks the box `is-broken`).
 */
export function pic(story: Story, ed: Edition, variant: PicVariant, opts: { eager?: boolean } = {}): string {
  const sec = sectionName(ed, story.section);
  const img = story.image;
  const src = usableImageUrl(story);
  const outlet = (img && has(img.credit) ? img.credit : story.sources[0]?.outlet) ?? "";
  const small = variant === "thumb" || variant === "mini";
  const ratio = variant === "lead" || variant === "feature" || variant === "hero" ? ` ${ratioClass(img?.width, img?.height)}` : "";
  const card = `<span class="pic-card" aria-hidden="true"><span class="pic-card-sec">${esc(sec)}</span>${
    !small && has(outlet) ? `<span class="pic-card-src">${esc(outlet)}</span>` : ""
  }</span>`;
  if (!src) {
    return `<div class="pic pic--${variant}${ratio} is-empty">${card}</div>`;
  }
  const w = img?.width && img.width > 0 ? Math.round(img.width) : 1200;
  const h = img?.height && img.height > 0 ? Math.round(img.height) : 800;
  const loading = opts.eager ? `fetchpriority="high"` : `loading="lazy"`;
  return `<div class="pic pic--${variant}${ratio}">${card}<img src="${esc(src)}" alt="${esc(img?.alt ?? "")}" width="${w}" height="${h}" ${loading} decoding="async" referrerpolicy="no-referrer"></div>`;
}

// ---------- sources & leaning ----------

const LEANINGS: Leaning[] = ["left", "centre-left", "centre", "centre-right", "right"];
const LEANING_LABEL: Record<Leaning, string> = {
  left: "Left",
  "centre-left": "Centre-left",
  centre: "Centre",
  "centre-right": "Centre-right",
  right: "Right",
};

/** A five-step scale with the outlet's position marked, plus the word. Neutral ink, never red/blue. */
export function leaningMark(leaning: Leaning | undefined): string {
  if (!leaning) return "";
  const pos = LEANINGS.indexOf(leaning);
  if (pos < 0) return "";
  const ticks = LEANINGS.map((_, i) => `<i${i === pos ? ' class="on"' : ""}></i>`).join("");
  return `<span class="lean"><span class="lean-scale" aria-hidden="true">${ticks}</span><span class="lean-label"><span class="visually-hidden">Leaning: </span>${LEANING_LABEL[leaning]}</span></span>`;
}

export function outletCount(story: Story): number {
  return new Set(story.sources.map((s) => s.outlet.trim().toLowerCase())).size;
}

/** "India · Developing · 4 outlets · 3 min read". Read marks are prepended by site.js. */
export function cardMeta(story: Story, section?: string): string {
  const parts: string[] = [];
  if (section) parts.push(`<span class="meta-section">${esc(section)}</span>`);
  if (story.developing) parts.push(`<span class="developing"><i class="dot" aria-hidden="true"></i>Developing</span>`);
  const n = outletCount(story);
  if (n > 0) parts.push(`<span>${plural(n, "outlet")}</span>`);
  parts.push(`<span>${Math.max(1, Math.round(story.readingMinutes))} min read</span>`);
  return `<p class="meta">${parts.join("")}</p>`;
}

/** Stories of a section other than `exclude`, by rank. */
export function sectionStories(ed: Edition, sectionId: string): Story[] {
  return ed.stories.filter((s) => s.section === sectionId).sort((a, b) => a.rank - b.rank);
}

export function byId(ed: Edition): Map<string, Story> {
  return new Map(ed.stories.map((s) => [s.id, s]));
}
