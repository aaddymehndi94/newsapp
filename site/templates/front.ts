// Edition front page: lead, top stories, then each section; ends with the colophon.

import type { Edition, Story } from "../types.ts";
import type { SiteCtx } from "./layout.ts";
import { frontMasthead, page } from "./layout.ts";
import {
  byId,
  cardMeta,
  editionName,
  editionPath,
  esc,
  longDate,
  num,
  pic,
  plural,
  slotName,
  storyPath,
  usableImageUrl,
} from "./helpers.ts";

interface RenderSection {
  id: string;
  name: string;
  stories: Story[];
}

/** Work out what goes where, tolerating leads inside sections and unreferenced stories. */
export function frontLayout(ed: Edition): { lead: Story[]; sections: RenderSection[] } {
  const map = byId(ed);
  const ranked = [...ed.stories].sort((a, b) => a.rank - b.rank);
  let lead = ed.lead.map((id) => map.get(id)).filter((s): s is Story => Boolean(s));
  if (lead.length === 0) lead = ranked.slice(0, 4);
  lead = lead.slice(0, 5);
  const shown = new Set(lead.map((s) => s.id));

  const sections: RenderSection[] = ed.sections.map((sec) => {
    const stories: Story[] = [];
    for (const id of sec.storyIds) {
      const s = map.get(id);
      if (s && !shown.has(s.id)) {
        stories.push(s);
        shown.add(s.id);
      }
    }
    return { id: sec.id, name: sec.name, stories };
  });
  // Stories no section listed: file them under their own section, else under "More stories".
  const more: Story[] = [];
  for (const s of ranked) {
    if (shown.has(s.id)) continue;
    const home = sections.find((sec) => sec.id === s.section);
    (home ? home.stories : more).push(s);
    shown.add(s.id);
  }
  if (more.length) sections.push({ id: "more", name: "More stories", stories: more });
  return { lead, sections: sections.filter((s) => s.stories.length > 0) };
}

function storyAttrs(ed: Edition, s: Story): string {
  return `id="${esc(s.id)}" data-story="${esc(`${ed.id}/${s.id}`)}"`;
}

function headlineLink(ed: Edition, s: Story): string {
  return `<a class="stretch" href="${storyPath(ed.id, s.id)}">${esc(s.headline)}</a>`;
}

function sectionNameOf(ed: Edition, s: Story): string {
  return ed.sections.find((x) => x.id === s.section)?.name ?? "";
}

function leadStory(ed: Edition, s: Story): string {
  return `<article class="card lead" ${storyAttrs(ed, s)}>
${pic(s, ed, "lead", { eager: true })}
<div class="card-text">
<h3 class="hl hl--lead">${headlineLink(ed, s)}</h3>
<p class="summary">${esc(s.summary)}</p>
${cardMeta(s, sectionNameOf(ed, s))}
</div>
</article>`;
}

function featureStory(ed: Edition, s: Story): string {
  return `<article class="card feature" ${storyAttrs(ed, s)}>
${pic(s, ed, "feature")}
<div class="card-text">
<h3 class="hl hl--feature">${headlineLink(ed, s)}</h3>
<p class="summary">${esc(s.summary)}</p>
${cardMeta(s)}
</div>
</article>`;
}

/**
 * Row: headline with its thumbnail beside it, the summary underneath. Used for top stories,
 * section lists and the article page's "keep reading". Every row has a thumbnail.
 */
export function rowStory(
  ed: Edition,
  s: Story,
  opts: { headingLevel?: 3 | 4; withSection?: boolean; eager?: boolean } = {},
): string {
  const h = opts.headingLevel ?? 3;
  return `<article class="card row" ${storyAttrs(ed, s)}>
<h${h} class="hl hl--row">${headlineLink(ed, s)}</h${h}>
${pic(s, ed, "thumb", { eager: opts.eager })}
<p class="summary">${esc(s.summary)}</p>
${cardMeta(s, opts.withSection ? sectionNameOf(ed, s) : undefined)}
</article>`;
}

function sectionBlock(ed: Edition, sec: RenderSection): string {
  // The feature slot carries the section's biggest picture, so it goes to the highest-ranked
  // story whose picture can load; the rest keep editorial order.
  const fi = Math.max(0, sec.stories.findIndex((s) => usableImageUrl(s) !== null));
  const first = sec.stories[fi];
  const rest = sec.stories.filter((_, i) => i !== fi);
  // Up to three rows sit beside the feature on desktop; the rest run below in a grid.
  // On phones it is one continuous list.
  const side = rest.slice(0, 3);
  const more = rest.slice(3);
  return `<section class="section" id="${esc(sec.id)}" aria-labelledby="h-${esc(sec.id)}">
<header class="section-head">
<h2 class="section-title" id="h-${esc(sec.id)}">${esc(sec.name)}</h2>
<p class="section-count">${plural(sec.stories.length, "story", "stories")}</p>
</header>
<div class="section-body${side.length ? "" : " is-solo"}">
${featureStory(ed, first)}
${side.length ? `<div class="rows">${side.map((s) => rowStory(ed, s)).join("\n")}</div>` : ""}
</div>
${more.length ? `<div class="rows rows--more">${more.map((s) => rowStory(ed, s)).join("\n")}</div>` : ""}
</section>`;
}

const CHEVRON = (d: "l" | "r") =>
  `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="${d === "r" ? "M6 3l5 5-5 5" : "M10 3 5 8l5 5"}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Sticky section tabs. Anchors only (never a filter); site.js marks the one in view. */
function tabBar(sections: RenderSection[]): string {
  const tabs = [{ id: "top-stories", name: "Top stories" }, ...sections]
    .map((s, i) => `<a class="tab${i === 0 ? " is-active" : ""}" href="#${esc(s.id)}" data-jump="${esc(s.id)}"${i === 0 ? ' aria-current="location"' : ""}>${esc(s.name)}</a>`)
    .join("");
  return `<nav class="tabs at-start" aria-label="Sections">
<div class="wrap tabs-inner">
<button class="tabs-arrow tabs-arrow--l" type="button" data-scroll="-1" aria-label="Scroll sections left" tabindex="-1" hidden>${CHEVRON("l")}</button>
<div class="tabs-track">${tabs}</div>
<button class="tabs-arrow tabs-arrow--r" type="button" data-scroll="1" aria-label="Scroll sections right" tabindex="-1" hidden>${CHEVRON("r")}</button>
</div>
</nav>`;
}

function colophon(ed: Edition, ctx: SiteCtx): string {
  const idx = ctx.editions.findIndex((e) => e.id === ed.id);
  const prev = idx > 0 ? ctx.editions[idx - 1] : undefined;
  const next = idx >= 0 && idx < ctx.editions.length - 1 ? ctx.editions[idx + 1] : undefined;
  const links: string[] = [];
  if (next) links.push(`<a class="btn" href="${editionPath(next.id)}">Next: ${slotName(next.slot).toLowerCase()} edition, ${esc(longDate(next.date))}</a>`);
  if (prev) links.push(`<a class="btn" href="${editionPath(prev.id)}">Previous: ${slotName(prev.slot).toLowerCase()} edition, ${esc(longDate(prev.date))}</a>`);
  links.push(`<a class="btn" href="/archive/">All editions</a>`);
  const due = next
    ? ""
    : `<p class="colo-due">The ${ed.slot === "morning" ? "evening edition is due at 5 pm" : "next morning edition is due at 5 am"} IST.</p>`;
  const st = ed.stats;
  const stats =
    st && st.itemsSeen > 0
      ? `<p class="colo-stats">Edited from ${plural(st.itemsSeen, "report")} across ${plural(st.feedsScanned, "feed")}; ${num(st.pagesRead)} articles read in full. Editing cost $${st.costUsd.toFixed(2)}.</p>`
      : "";
  return `<section class="colophon" aria-labelledby="colo-h">
<h2 id="colo-h" class="colo-title">You’re all caught up</h2>
<p class="colo-sub">That’s the end of the ${editionName(ed).toLowerCase()}.</p>
${due}
<p class="colo-nav">${links.join("")}</p>
${stats}
</section>`;
}

export function renderFront(ed: Edition, ctx: SiteCtx): string {
  const { lead, sections } = frontLayout(ed);
  const [top, ...subs] = lead;
  const main = `${tabBar(sections)}
<div class="wrap front">
<section class="top-stories${subs.length ? "" : " is-solo"}" id="top-stories" aria-labelledby="h-top">
<h2 class="visually-hidden" id="h-top">Top stories</h2>
${top ? leadStory(ed, top) : ""}
${subs.length ? `<div class="rows subs">${subs.map((s) => rowStory(ed, s, { withSection: true, eager: true })).join("\n")}</div>` : ""}
</section>
${sections.map((s) => sectionBlock(ed, s)).join("\n")}
${colophon(ed, ctx)}
</div>`;
  return page({
    title: `Meridian · ${editionName(ed)}, ${longDate(ed.date)}`,
    description: top ? `${top.headline}. ${top.dek}` : "Meridian: a balanced daily edition.",
    bodyClass: "page-front",
    bodyAttrs: { "data-edition": ed.id },
    header: frontMasthead(ed, ctx),
    main,
    ctx,
  });
}
