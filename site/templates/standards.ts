// How we work: how stories are chosen and written, the outlet tiers, the fairness rules and the AI
// disclosure (part 3 of the 2026-11 redesign). Plain prose; it changes only when the rules do.

import type { SiteCtx } from "./layout.ts";
import { page, slimMasthead } from "./layout.ts";

const SECTIONS: [string, string[]][] = [
  [
    "Who writes it",
    [
      "Measured Edition is written and edited with Claude, an AI made by Anthropic. One model (the editor) chooses each morning’s stories; another (the writer) writes each one from the reporting of the outlets credited at its foot. Stories about Anthropic carry a note saying so.",
      "The writer may use only what those outlets reported for facts about the day’s event. For who people are and what came before, it may also use our own earlier stories and the opening of the subject’s Wikipedia article.",
    ],
  ],
  [
    "How stories are chosen",
    [
      "Every morning we read about 180 news feeds and sitemaps from Indian, regional and international outlets, back to the previous edition. Reports of the same event are grouped together, and the editor scores each event for its consequences, its effect on India, how new it is, and the public interest. How many outlets carry a story counts as evidence, not as proof of importance: a court ruling or a regional report from one careful outlet can matter more than a story every outlet repeats.",
      "Each edition carries at least two court or rights stories, one of them from beyond the big cities, and any credible report of the state acting against a journalist. No running story gets more than two stories in one edition.",
    ],
  ],
  [
    "Whose reporting we rely on",
    [
      "Each outlet has an owner and a tier. Wire services, public bodies and outlets with their own reporting can lead a story. Outlets whose owners’ business interests, paid-content deals or record call for a second source (among them the Times group, NDTV, News18, Fox News and the New York Post) can confirm a story but never be its first or only source. Outlets from one owner count as one outlet, and no outlet is the first source of more than about one story in seven.",
      "Each source is listed with a mark for its general leaning, so you can see the mix behind every story.",
    ],
  ],
  [
    "Fairness",
    [
      "Police, ministries and “government sources” are parties to a story, not referees: their account is reported as theirs, beside the account of the people they act against. We don’t repeat an unnamed official’s description of a named person. Accused people are described as accused until a court decides.",
      "We never publish anything that could identify a survivor of a sexual offence. On contested stories, a short box sets out how each side on record frames the story, without a verdict. Incitement is not a side.",
    ],
  ],
  [
    "The under-reported story",
    [
      "Most days we carry one story that matters but that mainstream outlets have not run: a court filing, an official dataset, an RTI reply, a regional report. It is labelled “Measured Edition analysis”, names the outlet whose reporting it is built on, says what we could not check, and is fact-checked against that reporting before it is published. Some days there is none.",
    ],
  ],
  [
    "Pictures and links",
    [
      "Pictures are the credited outlets’ own, linked to where they were published, or free photos from Wikimedia Commons. We never use AI-made pictures of real events.",
    ],
  ],
];

export function renderStandards(ctx: SiteCtx): string {
  const main = `<div class="wrap standards">
<h1 class="page-title">How we work</h1>
<p class="page-lede">How Measured Edition chooses, writes and sources its stories.</p>
${SECTIONS.map(([h, ps]) => `<section class="std-part"><h2 class="sub-title">${h}</h2>${ps.map((p) => `<p>${p}</p>`).join("")}</section>`).join("\n")}
</div>`;
  return page({
    title: "How we work · Measured Edition",
    description: "How Measured Edition chooses, writes and sources its stories: the outlet tiers, the fairness rules and the AI that writes it.",
    canonicalPath: "/standards/",
    bodyClass: "page-standards",
    header: slimMasthead(ctx),
    main,
    ctx,
  });
}
