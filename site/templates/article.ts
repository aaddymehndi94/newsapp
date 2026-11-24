// Article page: picture, headline, key facts, body, context, framing, video, sources,
// then more to read so the reader never has to go back to keep going.

import type { Edition, Story } from "../types.ts";
import { rowStory } from "./front.ts";
import type { SiteCtx } from "./layout.ts";
import { ICON_BACK, page, slimMasthead } from "./layout.ts";
import {
  byId,
  editionName,
  editionPath,
  esc,
  has,
  inline,
  istClock,
  leaningMark,
  paragraphs,
  pic,
  placeName,
  safeHttpUrl,
  sectionName,
  usableImageUrl,
  sectionStories,
  shortDate,
} from "./helpers.ts";

const EXTERNAL = 'target="_blank" rel="noopener noreferrer nofollow"';


/** Paths of the front pages this story was listed on; the back link uses history.back() from them. */
function frontPaths(ed: Edition, ctx: SiteCtx): string {
  const paths = [editionPath(ed.id), `${editionPath(ed.id)}index.html`];
  if (ctx.latest.id === ed.id) paths.push("/", "/index.html");
  return paths.join(" ");
}

function backLink(ed: Edition, s: Story, ctx: SiteCtx, cls: string, label: string): string {
  return `<a class="${cls}" href="${editionPath(ed.id)}#${esc(s.id)}" data-back data-front="${esc(frontPaths(ed, ctx))}">${ICON_BACK}<span>${label}</span></a>`;
}

function hero(ed: Edition, s: Story): string {
  const img = s.image;
  const href = img ? safeHttpUrl(img.sourceUrl) : null;
  const credit = img && has(img.credit) ? esc(img.credit) : "";
  const caption = img && usableImageUrl(s) && credit
    ? `<figcaption class="credit">Photo: ${href ? `<a href="${esc(href)}" ${EXTERNAL}>${credit}</a>` : credit}</figcaption>`
    : "";
  return `<figure class="hero">${pic(s, ed, "hero", { eager: true })}${caption}</figure>`;
}

function keyFacts(s: Story): string {
  const facts = s.keyFacts.filter(has);
  if (!facts.length) return "";
  return `<aside class="keyfacts" aria-labelledby="kf-h">
<h2 class="box-title" id="kf-h">Key facts</h2>
<ul>${facts.map((f) => `<li>${inline(f)}</li>`).join("")}</ul>
</aside>`;
}

function video(s: Story): string {
  const v = s.video;
  if (!v || !/^[A-Za-z0-9_-]{6,20}$/.test(v.youtubeId)) return "";
  const id = v.youtubeId;
  const title = has(v.title) ? v.title : "Video";
  return `<figure class="video">
<a class="video-lite" href="https://www.youtube.com/watch?v=${id}" data-yt="${id}" data-title="${esc(title)}" ${EXTERNAL}>
<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer">
<span class="video-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" focusable="false"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg></span>
<span class="visually-hidden">Play video: ${esc(title)}</span>
</a>
<figcaption class="video-cap"><span class="video-title">${esc(title)}</span><span class="video-src">${has(v.channel) ? `<span>${esc(v.channel)}</span><span class="sep" aria-hidden="true"></span>` : ""}<span>Plays from YouTube</span></span></figcaption>
</figure>`;
}

function context(s: Story): string {
  const parts: string[] = [];
  if (has(s.background)) parts.push(`<section class="ctx" aria-labelledby="bg-h"><h2 class="sub-title" id="bg-h">Background</h2>${paragraphs(s.background)}</section>`);
  if (has(s.whyItMatters)) parts.push(`<section class="ctx" aria-labelledby="wim-h"><h2 class="sub-title" id="wim-h">Why it matters</h2>${paragraphs(s.whyItMatters)}</section>`);
  return parts.join("\n");
}

function framing(s: Story): string {
  const ps = (s.perspectives ?? []).filter((p) => has(p.label) && has(p.summary));
  if (!ps.length) return "";
  return `<section class="framing" aria-labelledby="fr-h">
<h2 class="box-title" id="fr-h">How it’s being framed</h2>
<p class="framing-note">Outlets are presenting this story in different ways. Each view is summarised as reported, without endorsement.</p>
<dl>${ps
    .map(
      (p) => `<div class="persp"><dt>${esc(p.label)}</dt><dd><p>${inline(p.summary)}</p>${
        p.outlets.filter(has).length ? `<p class="persp-outlets">${p.outlets.filter(has).map(esc).join(", ")}</p>` : ""
      }</dd></div>`,
    )
    .join("")}</dl>
</section>`;
}

function sources(s: Story): string {
  if (!s.sources.length) return "";
  const items = s.sources
    .map((src) => {
      const href = safeHttpUrl(src.url);
      const title = has(src.title) ? esc(src.title) : "Original report";
      return `<li class="source"><div class="source-main"><span class="source-outlet">${esc(src.outlet)}</span>${
        href ? `<a class="source-title" href="${esc(href)}" ${EXTERNAL}>${title}</a>` : `<span class="source-title">${title}</span>`
      }</div>${leaningMark(src.leaning)}</li>`;
    })
    .join("");
  return `<section class="sources" aria-labelledby="src-h">
<h2 class="sub-title" id="src-h">Sources</h2>
<p class="sources-note">Reported from these outlets. The scale shows each outlet’s general leaning, from left to right.</p>
<ul>${items}</ul>
</section>`;
}

/** Up to 3 more from the same section (the ones after this one first), plus 2 top stories. */
export function keepReading(ed: Edition, s: Story): { next: Story[]; more: Story[] } {
  const inSection = sectionStories(ed, s.section).filter((x) => x.id !== s.id);
  const after = inSection.filter((x) => x.rank > s.rank);
  const before = inSection.filter((x) => x.rank < s.rank);
  const next = [...after, ...before].slice(0, 3);
  const taken = new Set([s.id, ...next.map((x) => x.id)]);
  const map = byId(ed);
  const leadFirst = [
    ...ed.lead.map((id) => map.get(id)).filter((x): x is Story => Boolean(x)),
    ...[...ed.stories].sort((a, b) => a.rank - b.rank),
  ];
  const more: Story[] = [];
  for (const x of leadFirst) {
    if (more.length >= 2) break;
    if (!taken.has(x.id)) {
      more.push(x);
      taken.add(x.id);
    }
  }
  return { next, more };
}

export function renderArticle(ed: Edition, s: Story, ctx: SiteCtx): string {
  const sec = sectionName(ed, s.section);
  const { next, more } = keepReading(ed, s);
  const metaParts = [
    `<span class="meta-section">${esc(sec)}</span>`,
    s.developing ? `<span class="developing"><i class="dot" aria-hidden="true"></i>Developing</span>` : "",
    has(s.dateline) ? `<span class="place">${esc(placeName(s.dateline))}</span>` : "",
    `<time datetime="${esc(ed.publishedAt)}">${esc(shortDate(ed.date))}, ${istClock(ed.publishedAt)}</time>`,
    `<span>${Math.max(1, Math.round(s.readingMinutes))} min read</span>`,
  ].filter(Boolean);

  const main = `<div class="wrap article-wrap">
<article class="story" aria-labelledby="story-h">
${hero(ed, s)}
<header class="story-head">
<h1 class="hl hl--story" id="story-h">${esc(s.headline)}</h1>
${has(s.dek) ? `<p class="dek">${esc(s.dek)}</p>` : ""}
<p class="meta story-meta">${metaParts.join("")}</p>
</header>
<div class="story-grid">
${keyFacts(s)}
<div class="story-body">
${s.body.filter(has).map((p) => `<p>${inline(p)}</p>`).join("\n")}
</div>
${video(s)}
${context(s)}
${framing(s)}
${sources(s)}
</div>
</article>
<aside class="keep-reading" aria-label="Keep reading">
${next.length ? `<section class="kr-block"><h2 class="kr-title">More in ${esc(sec)}</h2><div class="rows">${next.map((x) => rowStory(ed, x)).join("\n")}</div></section>` : ""}
${more.length ? `<section class="kr-block"><h2 class="kr-title">Also in this edition</h2><div class="rows">${more.map((x) => rowStory(ed, x, { withSection: true })).join("\n")}</div></section>` : ""}
</aside>
<p class="back-foot">${backLink(ed, s, ctx, "back back--foot", `Back to the ${editionName(ed).toLowerCase()}`)}</p>
</div>`;

  return page({
    title: `${s.headline} · Measured Edition`,
    description: has(s.dek) ? s.dek : s.summary,
    bodyClass: "page-article",
    bodyAttrs: { "data-edition": ed.id, "data-story": `${ed.id}/${s.id}` },
    header: slimMasthead(ctx, backLink(ed, s, ctx, "back", "Back")),
    main,
    ctx,
  });
}
