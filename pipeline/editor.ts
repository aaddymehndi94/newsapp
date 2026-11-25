import type { FeedItem } from "./feeds.ts";
import { SOURCES, type Tier, outletInfo } from "../config/sources.ts";
import type { VideoItem } from "./videos.ts";
import { EDITOR_MODEL, type CostMeter, type JsonRequest, type JsonResult, callJson, runBatch } from "./llm.ts";

/** City sections. Readers pick one city on the site; each gets its own small section here. */
export const CITY_SECTIONS = ["bengaluru", "chennai", "delhi", "hyderabad", "kochi", "kolkata", "mumbai"] as const;

export const SECTION_IDS = [
  "india",
  "world",
  ...CITY_SECTIONS,
  "weather",
  "business",
  "ai-software",
  "science-tech",
  "health-environment",
  "entertainment",
  "sports",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_NAMES: Record<SectionId, string> = {
  india: "India",
  world: "World",
  bengaluru: "Bengaluru",
  chennai: "Chennai",
  delhi: "Delhi",
  hyderabad: "Hyderabad",
  kochi: "Kochi",
  kolkata: "Kolkata",
  mumbai: "Mumbai",
  weather: "Weather",
  business: "Business",
  "ai-software": "AI & Software",
  "science-tech": "Science & Tech",
  "health-environment": "Health & Environment",
  entertainment: "Entertainment",
  sports: "Sports",
};

export const QUOTAS: Record<SectionId, number> = {
  india: 9,
  world: 9,
  bengaluru: 3,
  chennai: 3,
  delhi: 3,
  hyderabad: 3,
  kochi: 3,
  kolkata: 3,
  mumbai: 3,
  weather: 2,
  business: 5,
  "ai-software": 5,
  "science-tech": 4,
  "health-environment": 3,
  entertainment: 6,
  sports: 4,
};

export interface SlatePick {
  key: string;
  section: SectionId;
  rank: number;
  lead: boolean;
  workingHeadline: string;
  angle: string;
  itemIds: string[];
  contested: boolean;
  videoId: string; // "" when none
}

export interface Slate {
  stories: SlatePick[];
}

const SLATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["stories"],
  properties: {
    stories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "section", "rank", "lead", "workingHeadline", "angle", "itemIds", "contested", "videoId"],
        properties: {
          key: { type: "string", description: "short kebab-case id for the event" },
          section: { type: "string", enum: [...SECTION_IDS] },
          rank: { type: "integer", description: "1 = most important story of the edition" },
          lead: { type: "boolean" },
          workingHeadline: { type: "string" },
          angle: { type: "string", description: "one sentence telling the writer what the story is and what is new" },
          itemIds: { type: "array", items: { type: "string" } },
          contested: { type: "boolean" },
          videoId: { type: "string", description: "a v:... id from the video list that covers this exact event, or empty string" },
        },
      },
    },
  },
};

const EDITOR_SYSTEM = `You are the editor-in-chief of Measured Edition, a non-partisan news site. Its readers live in India's big cities (Bengaluru, Chennai, Delhi, Hyderabad, Kochi, Kolkata, Mumbai) and want one calm, complete, balanced picture of the news each morning instead of reading six or seven sites. You choose which stories go into this edition. Writers will then produce each story from the source items you assign.

How to choose
- Group items that report the same event or development. One story = one event.
- Judge importance the way a serious national newspaper would: consequences for many people, significance for India and the world, genuinely new developments. Prefer hard news in every section except entertainment. Everywhere, skip horoscopes, shopping deals, product promotions, listicles, explainers with no news peg, opinion columns, sponsored posts, "how to watch" pieces, and trivial viral stories. Outside the entertainment section, also skip celebrity gossip and entertainment fluff.
- Fill the sections close to these targets (±1 if the day's news clearly calls for it): ${Object.entries(QUOTAS)
  .map(([k, v]) => `${k} ${v}`)
  .join(", ")}.
  * india: national politics, government and courts, security, states, society, infrastructure.
  * world: international news, including events abroad that involve India.
  * city sections (bengaluru, chennai, delhi, hyderabad, kochi, kolkata, mumbai): each city's own news and its state's where it touches the city — civic issues, transport, water, housing, local government and politics, the city's economy and jobs, its schools and hospitals. Each reader sees only their own city, so pick what that city's residents most need to know. Avoid minor crime items unless they matter to the city. A city story of national importance belongs in india instead. Use the city's own feeds first; fewer stories is fine on a quiet day.
  * weather: real weather news — IMD warnings, monsoon, cyclones, heat and cold waves, fog, floods and heavy rain in India (the seven cities' weather included), and major storms, floods or heatwaves abroad. Skip routine "weather today" filler; fewer stories (even none) is fine when nothing notable is happening. A page of forecasts already sits in this section.
  * business: economy, markets, companies, jobs, trade — India first, plus major global business news.
  * ai-software: AI models and labs, AI policy, safety and lawsuits, major software releases, developer tools and open source, big tech's AI moves, and India's AI and software industry. Pick what someone who wants to keep up with AI and software should know today; explain-the-trend pieces only with a news peg.
  * science-tech: research, space, gadgets and consumer technology, telecom and the internet (AI and software stories go to ai-software).
  * health-environment: public health, medicine, climate, pollution, wildlife, disasters' environmental side.
  * entertainment: the paper's Page 3 — Bollywood, Hollywood and South Indian cinema (including Kannada), OTT and TV, music (new albums and songs, charts, tours), awards (Oscars, Emmys, Grammys, Filmfare and others), fashion, and the celebrity news people are talking about. Fun is welcome here. Mix Indian and international. Skip anything cruel, invasive or sexualised about people's private lives, rumours that no outlet stands behind, and paid promotions.
  * sports: results and major developments; cricket plus at least one other sport (football, tennis, chess, F1, hockey, badminton, athletics…). Results over previews.
- Balance: across the edition, Indian politics must not be one-sided — cover government actions and decisions, opposition activity and criticism, and courts on their merits. Keep the world section global (not only US/UK); include Asia, the Middle East, Africa, Latin America and Europe when there is real news.
- Lead: mark exactly 4 stories as lead — the most important overall, normally a mix of India and world. Never a city-section story: city stories are shown only to that city's readers. Rank all stories 1..N by importance across the whole edition.
- Freshness: the previous edition's headlines are listed. Do not repeat a story unless there is a material new development; if you do, make the angle about what is new.

Assigning sources (itemIds)
- Each feed shows its tier. core: an outlet with its own reporting, which can lead a story. wire: the Press Trust of India, whose headlines show an event happened (its text is not available, so it is never a story's only source). primary: the body itself (the Reserve Bank, NASA, a company announcing its own news). corroborate: may confirm a story but is never its first or only source (The Times of India and The Economic Times, NDTV, News18, Fox News, the New York Post and others whose owners' interests, paid-content business or record of trial balloons call for a second outlet). perspective: only to show what one side is saying. A story carried only by corroborate outlets is not ready to publish: leave it out.
- Give each story 2–6 item ids reporting that same event, from different outlets where possible. Put the most informative core, wire or primary item first. Items from the same owner (shown in the feed header) count as one outlet, and two items from one outlet are not corroboration.
- How widely a story is covered is a clue to its importance, not proof of it: a court ruling, an official document or a regional report carried by one or two careful outlets can matter more than a celebrity story every outlet repeats.
- For political or disputed stories, include outlets from different leanings (each feed shows its leaning code) so the writer sees how each side reports it. For every contested story, assign at least one left-of-centre (L/CL) and one right-of-centre (CR/R) item whenever a core or corroborate feed carries the event; check those feeds before settling on a one-sided set.
- A single-source story is acceptable only for significant news from a core or primary outlet (e.g. a science paper, a court ruling reported by LiveLaw, a city report from that city's paper), never from a corroborate outlet.
- Fact-checkers (Alt News, BOOM, Factly): at most two stories, and only when the false claim and who spread it are themselves news.
- Only use ids that appear in the list (like i3f).

Other fields
- contested: true only when outlets or political sides frame the story in clearly different ways (partisan disputes, religion- or identity-related controversies, wars and conflicts, culture-war issues). Most stories are not contested.
- videoId: a v:… id only if that video's title is clearly about this same event; otherwise "".
- angle: one sentence for the writer — what happened and what is new.
- key: short kebab-case id.`;

function age(published: string | undefined, now: number): string {
  if (!published) return "?";
  const h = (now - Date.parse(published)) / 3600_000;
  return h < 1 ? `${Math.max(1, Math.round(h * 60))}m` : `${Math.round(h)}h`;
}

/** Feeds we read without fetching their pages: the writer gets only what the feed carries. */
const NO_PAGES = new Set(SOURCES.filter((s) => s.fetchPages === false).map((s) => s.id));

const LEAN: Record<string, string> = { left: "L", "centre-left": "CL", centre: "C", "centre-right": "CR", right: "R" };

/**
 * Compact listing grouped by feed. Items get short aliases (i0, i1, …) to save tokens;
 * returns the alias → item id map so the slate can be translated back.
 */
export function formatItems(items: FeedItem[], now = Date.now()): { text: string; aliases: Map<string, string> } {
  const aliases = new Map<string, string>();
  const groups = new Map<string, FeedItem[]>();
  for (const it of items) {
    const g = groups.get(it.sourceId) ?? [];
    g.push(it);
    groups.set(it.sourceId, g);
  }
  const out: string[] = [];
  let n = 0;
  for (const g of groups.values()) {
    const f = g[0];
    const info = outletInfo(f.outlet);
    const text = f.pages === false || NO_PAGES.has(f.sourceId) ? (g.every((x) => !x.summary) ? "; headlines only" : "; feed summaries only") : "";
    out.push(`## ${f.outlet} (${LEAN[f.leaning]}; ${f.sectionHint}; ${f.tier ?? info?.tier ?? "core"}; owner ${f.owner ?? info?.owner ?? f.outlet}${text})`);
    for (const it of g) {
      const alias = `i${(n++).toString(36)}`;
      aliases.set(alias, it.id);
      out.push(`${alias} ${age(it.published, now)} ${it.title}`);
    }
  }
  return { text: out.join("\n"), aliases };
}

export function buildEditorRequest(opts: {
  items: FeedItem[];
  videos: VideoItem[];
  previousHeadlines: string[];
  editionLabel: string;
}): { req: JsonRequest; aliases: Map<string, string> } {
  const listing = formatItems(opts.items);
  const user = `Edition: ${opts.editionLabel} (India Standard Time).

PREVIOUS EDITION HEADLINES
${opts.previousHeadlines.length ? opts.previousHeadlines.map((h) => `- ${h}`).join("\n") : "(none)"}

VIDEOS AVAILABLE (news channel uploads)
${opts.videos.map((v) => `${v.id} ${v.channel}: ${v.title}`).join("\n") || "(none)"}

INCOMING ITEMS (${opts.items.length}) — grouped by feed; each line: id, age, headline. Leaning codes: L left, CL centre-left, C centre, CR centre-right, R right.
${listing.text}

Choose this edition's stories.`;
  const req: JsonRequest = {
    customId: "editor",
    model: EDITOR_MODEL,
    system: EDITOR_SYSTEM,
    user,
    schema: SLATE_SCHEMA,
    effort: "medium",
    maxTokens: 32000,
  };
  return { req, aliases: listing.aliases };
}

/** Translate alias item ids (i0, i1…) in a slate back to real item ids. */
export function unalias(slate: Slate, aliases: Map<string, string>): Slate {
  return { stories: slate.stories.map((s) => ({ ...s, itemIds: s.itemIds.map((a) => aliases.get(a.trim()) ?? a) })) };
}

const CAN_LEAD = new Set<Tier>(["core", "wire", "primary"]);
const tierOf = (it: FeedItem): Tier => it.tier ?? (it.outlet ? outletInfo(it.outlet)?.tier : undefined) ?? "core";
const ownerOf = (it: FeedItem): string => it.owner ?? (it.outlet ? outletInfo(it.outlet)?.owner : undefined) ?? it.outlet ?? "";

/** Validate the editor's slate against the items we actually have. */
export function cleanSlate(slate: Slate, items: Map<string, FeedItem>, videoIds: Set<string>): Slate {
  const usedItems = new Set<string>();
  const stories: SlatePick[] = [];
  const keys = new Set<string>();
  for (const s of [...slate.stories].sort((a, b) => a.rank - b.rank)) {
    if (!SECTION_IDS.includes(s.section)) continue;
    let ids = s.itemIds.filter((id) => items.has(id) && !usedItems.has(id));
    // One owner gives at most two items; a corroborate or perspective outlet never comes first,
    // and a story with no core, wire or primary item is dropped (enforced here, not just asked).
    const perOwner = new Map<string, number>();
    ids = ids.filter((id) => {
      const o = ownerOf(items.get(id)!);
      perOwner.set(o, (perOwner.get(o) ?? 0) + 1);
      return perOwner.get(o)! <= 2;
    });
    const first = ids.findIndex((id) => CAN_LEAD.has(tierOf(items.get(id)!)));
    if (first < 0) continue;
    ids = [ids[first], ...ids.filter((_, i) => i !== first)];
    ids.forEach((id) => usedItems.add(id));
    let key = s.key.replace(/[^a-z0-9-]/gi, "-").toLowerCase().slice(0, 50) || "story";
    while (keys.has(key)) key += "-2";
    keys.add(key);
    stories.push({ ...s, key, itemIds: ids, videoId: videoIds.has(s.videoId) ? s.videoId : "" });
  }
  stories.forEach((s, i) => (s.rank = i + 1));
  // Exactly up to 4 leads, falling back to top-ranked stories. City stories are shown only to
  // that city's readers, so they never lead the edition.
  const canLead = (s: SlatePick) => !(CITY_SECTIONS as readonly string[]).includes(s.section);
  const leads = stories.filter((s) => s.lead && canLead(s)).slice(0, 4);
  if (leads.length < 4) for (const s of stories) if (!leads.includes(s) && canLead(s) && leads.length < 4) leads.push(s);
  for (const s of stories) s.lead = leads.includes(s);
  return { stories };
}

export async function planEdition(
  req: JsonRequest,
  meter: CostMeter,
  mode: { batch: boolean; deadline: Date; stateFile?: string },
): Promise<JsonResult<Slate>> {
  if (!mode.batch) return callJson<Slate>(req, meter);
  const res = await runBatch<Slate>([req], meter, { deadline: mode.deadline, stateFile: mode.stateFile, pollMs: 20_000 });
  return res.get(req.customId) ?? { ok: false, error: "missing" };
}
