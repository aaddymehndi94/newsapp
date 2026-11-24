// The archive (an index of every edition, newest first) and the 404 page.

import type { Edition } from "../types.ts";
import type { SiteCtx } from "./layout.ts";
import { page, slimMasthead } from "./layout.ts";
import { byId, editionName, editionPath, esc, istClock, longDate, pic, plural } from "./helpers.ts";

function leadOf(ed: Edition) {
  const map = byId(ed);
  return ed.lead.map((id) => map.get(id)).find(Boolean) ?? [...ed.stories].sort((a, b) => a.rank - b.rank)[0];
}

function editionCell(ed: Edition, ctx: SiteCtx): string {
  const lead = leadOf(ed);
  const latest = ed.id === ctx.latest.id ? `<span class="ed-latest">Latest</span>` : "";
  return `<li class="ed-cell">
<article class="ed-card">
${lead ? pic(lead, ed, "mini") : ""}
<div class="ed-text">
<h3 class="ed-name"><a class="stretch" href="${editionPath(ed.id)}">${editionName(ed)}</a>${latest}</h3>
<p class="meta"><span>${istClock(ed.publishedAt)}</span><span>${plural(ed.stories.length, "story", "stories")}</span></p>
${lead ? `<p class="ed-lead">${esc(lead.headline)}</p>` : ""}
</div>
</article>
</li>`;
}

export function renderArchive(ctx: SiteCtx): string {
  const byDate = new Map<string, Edition[]>();
  for (const ed of [...ctx.editions].reverse()) {
    const list = byDate.get(ed.date) ?? [];
    list.push(ed);
    byDate.set(ed.date, list);
  }
  const days = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, eds]) => {
      const sorted = eds.sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
      return `<li class="day">
<h2 class="day-title"><time datetime="${esc(date)}">${esc(longDate(date))}</time></h2>
<ul class="day-editions">${sorted.map((e) => editionCell(e, ctx)).join("\n")}</ul>
</li>`;
    })
    .join("\n");
  const main = `<div class="wrap archive">
<header class="page-head">
<h1 class="page-title">All editions</h1>
<p class="page-lede">Two editions a day, at 5 am and 5 pm IST. ${plural(ctx.editions.length, "edition")} so far.</p>
</header>
<ol class="days">
${days}
</ol>
</div>`;
  return page({
    title: "All editions · Meridian",
    description: "Every Meridian edition, newest first.",
    bodyClass: "page-archive",
    header: slimMasthead(ctx),
    main,
    ctx,
  });
}

export function renderNotFound(ctx: SiteCtx): string {
  const main = `<div class="wrap notfound">
<h1 class="page-title">Page not found</h1>
<p class="page-lede">There is no page at this address. It may belong to an edition that has been removed, or the link may be mistyped.</p>
<p class="nf-links"><a href="/">Read the latest edition (${editionName(ctx.latest).toLowerCase()}, ${esc(longDate(ctx.latest.date))})</a><a href="/archive/">Browse all editions</a></p>
</div>`;
  return page({
    title: "Page not found · Meridian",
    bodyClass: "page-404",
    header: slimMasthead(ctx),
    main,
    ctx,
  });
}
