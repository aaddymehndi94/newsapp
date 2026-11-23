// Edition front page: lead, secondary leads, then each section; ends with the colophon.

import type { Edition, Story } from "../types.ts";
import type { SiteCtx } from "./layout.ts";
import { frontMasthead, neatline, page } from "./layout.ts";
import {
  byId,
  cardMeta,
  editionName,
  editionPath,
  esc,
  legendKey,
  longDate,
  num,
  pic,
  plural,
  slotName,
  storyPath,
  tint,
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

function leadStory(ed: Edition, s: Story): string {
  return `<article class="lead ${tint(s.section)}" ${storyAttrs(ed, s)}>
${pic(s, ed, "lead", { eager: true })}
<div class="lead-text">
<h3 class="hl hl--lead">${headlineLink(ed, s)}</h3>
<p class="summary">${esc(s.summary)}</p>
${cardMeta(s, sectionNameOf(ed, s))}
</div>
</article>`;
}

function subStory(ed: Edition, s: Story): string {
  return `<article class="sub ${tint(s.section)}" ${storyAttrs(ed, s)}>
${pic(s, ed, "sub")}
<div class="sub-text">
<h3 class="hl hl--sub">${headlineLink(ed, s)}</h3>
<p class="summary">${esc(s.summary)}</p>
${cardMeta(s, sectionNameOf(ed, s))}
</div>
</article>`;
}

function sectionNameOf(ed: Edition, s: Story): string {
  return ed.sections.find((x) => x.id === s.section)?.name ?? "";
}

function featureStory(ed: Edition, s: Story): string {
  return `<article class="feature" ${storyAttrs(ed, s)}>
${pic(s, ed, "feature")}
<div class="feature-text">
<h3 class="hl hl--feature">${headlineLink(ed, s)}</h3>
<p class="summary">${esc(s.summary)}</p>
${cardMeta(s)}
</div>
</article>`;
}

/** Compact row: headline beside a thumbnail, summary beneath. Also used on article pages. */
export function rowStory(ed: Edition, s: Story, opts: { headingLevel?: 3 | 4; withSection?: boolean } = {}): string {
  const h = opts.headingLevel ?? 3;
  return `<article class="row" ${storyAttrs(ed, s)}>
${pic(s, ed, "thumb")}
<h${h} class="hl hl--row">${headlineLink(ed, s)}</h${h}>
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
  // Beside the feature: up to three rows. Anything more runs below as a grid of picture cards.
  // Three rows sit beside the feature (a fourth only when it would otherwise be alone below).
  const sideCount = rest.length === 4 ? 4 : 3;
  const side = rest.slice(0, sideCount);
  const more = rest.slice(sideCount);
  // A 4-up grid would strand one card on its last row; 3-up doesn't.
  const gridCols = more.length % 4 === 1 && more.length % 3 !== 1 ? " cols-3" : "";
  const solo = rest.length === 0 ? " is-solo" : "";
  return `<section class="section ${tint(sec.id)}" id="${esc(sec.id)}" aria-labelledby="h-${esc(sec.id)}">
<header class="section-head">
<h2 class="section-title" id="h-${esc(sec.id)}">${legendKey(sec.id)}<span>${esc(sec.name)}</span></h2>
<p class="section-count">${plural(sec.stories.length, "story", "stories")}</p>
</header>
<div class="section-body${solo}">
${featureStory(ed, first)}
${side.length ? `<div class="rows">${side.map((s) => rowStory(ed, s)).join("\n")}</div>` : ""}
</div>
${more.length ? `<div class="rows rows--grid${gridCols}">${more.map((s) => rowStory(ed, s)).join("\n")}</div>` : ""}
</section>`;
}

function jumpBar(sections: RenderSection[]): string {
  const links = sections
    .map((s) => `<a href="#${esc(s.id)}" data-jump="${esc(s.id)}">${legendKey(s.id)}${esc(s.name)}</a>`)
    .join("");
  return `<nav class="jumpbar" aria-label="Sections">
<div class="wrap"><div class="jumpbar-track"><a href="#top-stories" data-jump="top-stories">Top stories</a>${links}</div></div>
</nav>`;
}

function colophon(ed: Edition, ctx: SiteCtx): string {
  const idx = ctx.editions.findIndex((e) => e.id === ed.id);
  const prev = idx > 0 ? ctx.editions[idx - 1] : undefined;
  const next = idx >= 0 && idx < ctx.editions.length - 1 ? ctx.editions[idx + 1] : undefined;
  const nextLine = next
    ? `<a class="colo-link" href="${editionPath(next.id)}">Next: ${slotName(next.slot).toLowerCase()} edition, ${esc(longDate(next.date))}</a>`
    : `<span>The ${ed.slot === "morning" ? "evening edition is due at 17:00" : "next morning edition is due at 05:00"} IST.</span>`;
  const prevLine = prev
    ? `<a class="colo-link" href="${editionPath(prev.id)}">Previous: ${slotName(prev.slot).toLowerCase()} edition, ${esc(longDate(prev.date))}</a>`
    : "";
  const st = ed.stats;
  const stats =
    st && st.itemsSeen > 0
      ? `<p class="colo-stats">Edited from ${plural(st.itemsSeen, "report")} across ${plural(st.feedsScanned, "feed")}; ${num(st.pagesRead)} articles read in full. Editing cost $${st.costUsd.toFixed(2)}.</p>`
      : "";
  return `<section class="colophon" aria-labelledby="colo-h">
${neatline(ed.slot, { labels: false })}
<h2 id="colo-h" class="colo-title">End of the ${editionName(ed).toLowerCase()}</h2>
<p class="colo-nav">${nextLine}${prevLine ? `<span class="sep" aria-hidden="true"></span>${prevLine}` : ""}<span class="sep" aria-hidden="true"></span><a class="colo-link" href="/archive/">All editions</a></p>
${stats}
</section>`;
}

export function renderFront(ed: Edition, ctx: SiteCtx): string {
  const { lead, sections } = frontLayout(ed);
  const [top, ...subs] = lead;
  const main = `${jumpBar(sections)}
<div class="wrap front">
<section class="top-stories${subs.length ? "" : " is-solo"}" id="top-stories" aria-labelledby="h-top">
<h2 class="visually-hidden" id="h-top">Top stories</h2>
${top ? leadStory(ed, top) : ""}
${subs.length ? `<div class="subs subs--${subs.length}">${subs.map((s) => subStory(ed, s)).join("\n")}</div>` : ""}
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
