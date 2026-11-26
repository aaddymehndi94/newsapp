import type { FeedItem } from "./feeds.ts";
import { SOURCES, type Tier, canonicalOutlet, outletInfo } from "../config/sources.ts";
import { groupEvents } from "./events.ts";
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

/**
 * How many stories each section may carry (part 2: ranges, not quotas). Code fills each section
 * to its minimum with the best-scored candidates, then adds the next best anywhere until the
 * edition reaches TARGET_STORIES, never past a section's maximum.
 */
export const RANGES: Record<SectionId, [number, number]> = {
  india: [7, 11],
  world: [7, 11],
  bengaluru: [2, 4],
  chennai: [2, 4],
  delhi: [2, 4],
  hyderabad: [2, 4],
  kochi: [2, 4],
  kolkata: [2, 4],
  mumbai: [2, 4],
  weather: [0, 3],
  business: [4, 7],
  "ai-software": [3, 6],
  "science-tech": [3, 5],
  "health-environment": [2, 4],
  entertainment: [5, 7],
  sports: [3, 5],
};
export const TARGET_STORIES = 68;

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
  /** The editor's rubric, 0–3 each (part 2). Older slates have none. */
  scores?: { consequence: number; india: number; newness: number; publicInterest: number };
  /** An exclusive, a court ruling, official data or a regional report that few outlets carry. */
  underCovered?: boolean;
  /** Short id of the running story this belongs to ("" when it stands alone). */
  saga?: string;
  beat?: "court" | "rights" | "press-freedom" | "other";
  /** Happened outside the seven metros. */
  beyondMetros?: boolean;
  /** People or bodies whose Wikipedia lead gives the writer who's who (part 3). */
  contextNames?: string[];
}

export interface Slate {
  stories: SlatePick[];
  /** Candidates not chosen, best first per section, used when a chosen story proves too thin. */
  reserves?: SlatePick[];
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
        required: ["key", "section", "rank", "lead", "workingHeadline", "angle", "itemIds", "contested", "videoId", "scores", "underCovered", "saga", "beat", "beyondMetros", "contextNames"],
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
          scores: {
            type: "object",
            additionalProperties: false,
            required: ["consequence", "india", "newness", "publicInterest"],
            properties: {
              consequence: { type: "integer", description: "0-3: how many people, how much is at stake" },
              india: { type: "integer", description: "0-3: effect on India and readers in India" },
              newness: { type: "integer", description: "0-3: a real development, not a restatement" },
              publicInterest: { type: "integer", description: "0-3: accountability, rights, safety, public money" },
            },
          },
          underCovered: { type: "boolean" },
          saga: { type: "string", description: "kebab-case id of the running story this belongs to, or empty string" },
          beat: { type: "string", enum: ["court", "rights", "press-freedom", "other"] },
          beyondMetros: { type: "boolean" },
          contextNames: { type: "array", items: { type: "string" }, description: "0-3 exact English Wikipedia article titles" },
        },
      },
    },
  },
};

const EDITOR_SYSTEM = `You are the editor-in-chief of Measured Edition, a non-partisan news site. Its readers live in India's big cities (Bengaluru, Chennai, Delhi, Hyderabad, Kochi, Kolkata, Mumbai) and want one calm, complete, balanced picture of the news each morning instead of reading six or seven sites. You choose which stories go into this edition. Writers will then produce each story from the source items you assign.

How to choose
- The items come grouped into events: code has put together reports whose headlines share key words, and each group shows how many outlets and owners carry it. Check the grouping: join reports it left apart, and split a group that mixes two events. One story = one event.
- Judge importance the way a serious national newspaper would: consequences for many people, significance for India and the world, genuinely new developments. Prefer hard news in every section except entertainment. Everywhere, skip horoscopes, shopping deals, product promotions, listicles, explainers with no news peg, opinion columns, sponsored posts, "how to watch" pieces, and trivial viral stories. Outside the entertainment section, also skip celebrity gossip and entertainment fluff.
- Score every story you return, 0 to 3 on each: consequence (how many people, how much is at stake), india (its effect on India and on readers in India), newness (a real development today, not a restatement or a reaction to a reaction), publicInterest (accountability of power, rights, safety, public money). Score honestly: code ranks the edition by these scores, so a low score keeps a story out. Within entertainment and sports, score against that section's own news, not against wars and budgets.
- How many outlets carry an event is evidence, not a verdict. A court ruling, official data, an exclusive or a regional report carried by one or two careful outlets can matter more than a celebrity saga every outlet repeats: mark such stories underCovered.
- Return candidates for every section, best first: at least the section's minimum when the news supports it, and up to its maximum plus two reserves. Code then fills each section to its minimum and adds the best remaining stories up to about ${TARGET_STORIES} in all. Ranges (minimum–maximum): ${Object.entries(RANGES)
  .map(([k, [lo, hi]]) => `${k} ${lo}–${hi}`)
  .join(", ")}. Fewer is fine when a section's news is thin; never pad with filler.
- saga: a running story (a war, a long court case, an election campaign, a company saga) gets a short kebab-case id, the same id for every story from it; code keeps at most two stories per saga, so pick that saga's two most important developments. "" for a story that stands alone.
- Accountability: find and return at least two court or rights stories (beat "court" or "rights"), one of them from beyond the seven metros (beyondMetros true), and any credible report of state action against a journalist (beat "press-freedom"). National stories (voter-roll exclusions, central laws) go in india, not under one city.
- contextNames: up to three people or bodies the reader needs explained (a minister's party and post, what a commission is), as exact English Wikipedia article titles ("Mamata Banerjee", "Election Commission of India"). [] when nobody needs explaining.
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
- Lead: mark 4 stories as lead — the most important overall, normally a mix of India and world. Never a city-section story: city stories are shown only to that city's readers. Rank all stories 1..N by importance across the whole edition.
- Freshness: the previous edition's headlines are listed. Do not repeat a story unless there is a material new development; if you do, make the angle about what is new.

Assigning sources (itemIds)
- Each feed shows its tier. core: an outlet with its own reporting, which can lead a story. wire: the Press Trust of India, whose headlines show an event happened (its text is not available, so it is never a story's only source). primary: the body itself (the Reserve Bank, NASA, a company announcing its own news). corroborate: may confirm a story but is never its first or only source (The Times of India and The Economic Times, NDTV, News18, Fox News, the New York Post and others whose owners' interests, paid-content business or record of trial balloons call for a second outlet). perspective: only to show what one side is saying. A story carried only by corroborate outlets is not ready to publish: leave it out.
- Give each story 2–6 item ids reporting that same event, from different outlets where possible. Put the most informative core, wire or primary item first. Items from the same owner (shown in the feed header) count as one outlet, and two items from one outlet are not corroboration.
- No single outlet should carry the edition: over-reliance on one paper makes the news worse, however good the paper. When one outlet's item would lead many stories, look for the same event from other owners and give their items too; a story only one outlet reports needs a reason to be in (an exclusive, a court ruling, official data, a regional report nobody else has).
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

/** Order of the event listing's sections: the paper's own order, then anything else. */
const HOME_ORDER = ["india", "world", ...CITY_SECTIONS, "business", "ai", "tech", "science", "health", "environment", "entertainment", "sports", "general"];

/**
 * The editor's menu: a legend of feeds (f-codes carrying outlet, leaning, tier and owner once),
 * then the items as events, by section, newest first. Items get short aliases (i0, i1, …) to save
 * tokens; returns the alias → item id map so the slate can be translated back.
 */
export function formatItems(items: FeedItem[], now = Date.now()): { text: string; aliases: Map<string, string> } {
  const aliases = new Map<string, string>();
  const feeds = new Map<string, string>();
  const legend: string[] = [];
  const feedCode = (f: FeedItem) => {
    let code = feeds.get(f.sourceId);
    if (!code) {
      code = `f${feeds.size}`;
      feeds.set(f.sourceId, code);
      const info = outletInfo(f.outlet);
      const group = items.filter((x) => x.sourceId === f.sourceId);
      const text = !f.body && (f.pages === false || NO_PAGES.has(f.sourceId)) ? (group.every((x) => !x.summary) ? "; headlines only" : "; feed summaries only") + (group.some((x) => x.alt) ? ", except items marked + (full text available)" : "") : "";
      legend.push(`${code} ${f.outlet} · ${f.sectionHint}; ${LEAN[f.leaning]}; ${f.tier ?? info?.tier ?? "core"}; owner ${f.owner ?? info?.owner ?? f.outlet}${text}`);
    }
    return code;
  };
  let n = 0;
  const line = (it: FeedItem) => {
    const alias = `i${(n++).toString(36)}`;
    aliases.set(alias, it.id);
    return `${alias}${it.alt ? "+" : ""} ${feedCode(it)} ${age(it.published, now)} ${it.title}`;
  };
  const events = groupEvents(items);
  const homes = [...new Set(events.map((e) => e.home))].sort((a, b) => {
    const i = (h: string) => (HOME_ORDER.includes(h) ? HOME_ORDER.indexOf(h) : HOME_ORDER.length);
    return i(a) - i(b) || a.localeCompare(b);
  });
  const out: string[] = [];
  for (const h of homes) {
    out.push(`## ${h}`);
    const evs = events.filter((e) => e.home === h).sort((a, b) => Date.parse(b.firstSeen ?? "0") - Date.parse(a.firstSeen ?? "0"));
    for (const e of evs) {
      if (e.items.length === 1) out.push(line(e.items[0]));
      else {
        out.push(`* ${e.outlets} outlet${e.outlets > 1 ? "s" : ""}, ${e.owners} owner${e.owners > 1 ? "s" : ""}, first ${age(e.firstSeen, now)} ago`);
        for (const it of e.items) out.push(`  ${line(it)}`);
      }
    }
  }
  return { text: `FEEDS (code outlet · section; leaning; tier; owner)\n${legend.join("\n")}\n\nEVENTS\n${out.join("\n")}`, aliases };
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

INCOMING ITEMS (${opts.items.length}) — a legend of feeds, then the items grouped into events by section, newest first. A line starting with * opens a group of reports of one event (the indented lines under it); other lines are single reports. Each item line: id, feed code, age, headline. Leaning codes: L left, CL centre-left, C centre, CR centre-right, R right.
${listing.text}

Choose this edition's stories.`;
  const req: JsonRequest = {
    customId: "editor",
    model: EDITOR_MODEL,
    system: EDITOR_SYSTEM,
    user,
    schema: SLATE_SCHEMA,
    effort: "medium",
    maxTokens: 48000,
  };
  return { req, aliases: listing.aliases };
}

/** Translate alias item ids (i0, i1…) in a slate back to real item ids. */
export function unalias(slate: Slate, aliases: Map<string, string>): Slate {
  return { stories: slate.stories.map((s) => ({ ...s, itemIds: s.itemIds.map((a) => aliases.get(a.trim().replace(/\+$/, "")) ?? a) })) };
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
  // Part 2: with the editor's scores, code chooses from the candidates (ranges, saga cap,
  // accountability floor); older slates without scores are taken as they come.
  let reserves: SlatePick[] = [];
  if (stories.length && stories.every((s) => s.scores)) {
    const chosen = selectStories(stories, items);
    stories.length = 0;
    stories.push(...chosen.stories);
    reserves = chosen.reserves;
  }
  stories.forEach((s, i) => (s.rank = i + 1));
  spreadFirstSources(stories, items);
  // Exactly up to 4 leads, falling back to top-ranked stories. City stories are shown only to
  // that city's readers, so they never lead the edition.
  const canLead = (s: SlatePick) => !(CITY_SECTIONS as readonly string[]).includes(s.section);
  const leads = stories.filter((s) => s.lead && canLead(s)).slice(0, 4);
  if (leads.length < 4) for (const s of stories) if (!leads.includes(s) && canLead(s) && leads.length < 4) leads.push(s);
  for (const s of stories) s.lead = leads.includes(s);
  return { stories, reserves };
}

export const scoreOf = (s: SlatePick) => (s.scores ? s.scores.consequence + s.scores.india + s.scores.newness + s.scores.publicInterest : 0);
const ACCOUNTABILITY = new Set(["court", "rights"]);

/**
 * Chooses the edition from scored candidates (already cleaned): best first by score, then by how
 * many owners carry it, then the editor's rank. At most two stories per saga. Each section gets
 * its minimum, then the best remaining stories go in until TARGET_STORIES, never past a
 * section's maximum. Then the accountability floor: two court or rights stories (one from beyond
 * the metros) and every press-freedom story, swapped in for a section's weakest when needed.
 */
export function selectStories(cands: SlatePick[], items: Map<string, FeedItem>): { stories: SlatePick[]; reserves: SlatePick[] } {
  const owners = (s: SlatePick) => new Set(s.itemIds.map((id) => ownerOf(items.get(id)!))).size;
  const order = [...cands].sort((a, b) => scoreOf(b) - scoreOf(a) || owners(b) - owners(a) || a.rank - b.rank);
  const perSaga = new Map<string, number>();
  const pool = order.filter((s) => {
    if (!s.saga) return true;
    perSaga.set(s.saga, (perSaga.get(s.saga) ?? 0) + 1);
    return perSaga.get(s.saga)! <= 2;
  });
  const chosen = new Set<SlatePick>();
  const inSection = (sec: string) => [...chosen].filter((s) => s.section === sec).length;
  for (const s of pool) if (inSection(s.section) < RANGES[s.section][0]) chosen.add(s);
  for (const s of pool) if (chosen.size < TARGET_STORIES && !chosen.has(s) && inSection(s.section) < RANGES[s.section][1]) chosen.add(s);

  // Accountability floor: promote the best unchosen story that meets a need, in place of its
  // section's weakest story that isn't itself one of these, when the section is full.
  const isAcc = (s: SlatePick) => ACCOUNTABILITY.has(s.beat ?? "") || s.beat === "press-freedom";
  const promote = (need: (s: SlatePick) => boolean): boolean => {
    const s = pool.find((x) => !chosen.has(x) && need(x));
    if (!s) return false;
    if (inSection(s.section) >= RANGES[s.section][1]) {
      const weakest = [...chosen].filter((x) => x.section === s.section && !isAcc(x)).sort((a, b) => scoreOf(a) - scoreOf(b))[0];
      if (!weakest) return false;
      chosen.delete(weakest);
    }
    chosen.add(s);
    return true;
  };
  const accCount = () => [...chosen].filter((s) => ACCOUNTABILITY.has(s.beat ?? "")).length;
  while (accCount() < 2 && promote((s) => ACCOUNTABILITY.has(s.beat ?? ""))) {}
  if (![...chosen].some((s) => ACCOUNTABILITY.has(s.beat ?? "") && s.beyondMetros)) promote((s) => ACCOUNTABILITY.has(s.beat ?? "") && !!s.beyondMetros);
  while (promote((s) => s.beat === "press-freedom")) {}

  const stories = order.filter((s) => chosen.has(s));
  return { stories, reserves: order.filter((s) => !chosen.has(s) && pool.includes(s)) };
}

/**
 * No owner leads (is the first source of) more than about one story in seven: past that, a
 * story's next lead-eligible item from an owner still under the cap goes first. Stories keep all
 * their items; only who is credited first, and read first by the writer, changes.
 */
export function spreadFirstSources(stories: SlatePick[], items: Map<string, FeedItem>): void {
  const cap = Math.max(3, Math.ceil(stories.length * 0.15));
  const led = new Map<string, number>();
  const count = (o: string) => led.get(o) ?? 0;
  for (const s of stories) {
    let owner = ownerOf(items.get(s.itemIds[0])!);
    if (count(owner) >= cap) {
      const alt = s.itemIds.findIndex((id, i) => {
        const it = items.get(id)!;
        return i > 0 && CAN_LEAD.has(tierOf(it)) && ownerOf(it) !== owner && count(ownerOf(it)) < cap;
      });
      if (alt > 0) {
        s.itemIds = [s.itemIds[alt], ...s.itemIds.filter((_, i) => i !== alt)];
        owner = ownerOf(items.get(s.itemIds[0])!);
      }
    }
    led.set(owner, count(owner) + 1);
  }
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
