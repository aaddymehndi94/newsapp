// The daily under-reported piece (part 4 of the redesign,
// docs/superpowers/specs/2026-11-26-writing-and-underreported-design.md): one story that matters
// but that mainstream outlets have not run, built on one independent or specialist outlet's
// reporting, fact-checked against it, and labelled as our analysis. "None today" is a fine answer.
import { canonicalOutlet } from "../config/sources.ts";
import { keyWords, sharedWords } from "./coverage.ts";
import type { PageInfo } from "./enrich.ts";
import { SECTION_IDS, type SectionId, type SlatePick } from "./editor.ts";
import type { FeedItem } from "./feeds.ts";
import { type CostMeter, EDITOR_MODEL, type JsonRequest, type JsonResult, WRITER_MODEL, callJson, runBatch } from "./llm.ts";
import { WRITER_STYLE } from "./style.ts";
import { log, mapLimit } from "./util.ts";
import type { WrittenStory } from "./writer.ts";

/** Outlets whose own reporting often finds what the big papers miss. */
export const INDEPENDENT = new Set([
  "The Wire", "Scroll", "The News Minute", "Newslaundry", "The Quint", "ThePrint", "Frontline", "Down To Earth",
  "LiveLaw", "Bar & Bench", "Alt News", "BOOM", "Factly", "South First", "Citizen Matters", "Mongabay India",
  "IndiaSpend", "Article 14", "The Caravan",
]);

/** Outlets whose coverage makes a story "reported": if one of them ran it, it isn't under-reported. */
export const MAINSTREAM = new Set([
  "The Times of India", "The Economic Times", "Hindustan Times", "Mint", "The Hindu", "The Indian Express",
  "The New Indian Express", "NDTV", "News18", "India Today", "Business Standard", "Deccan Herald", "Outlook",
  "Press Trust of India", "United News of India", "The Tribune", "Deccan Chronicle", "Mid-Day", "Free Press Journal",
  "BBC News", "Millennium Post", "DT Next", "Onmanorama", "Mathrubhumi English",
]);

const NOT_NEWS = /^(opinion|column|editorial|explained|explainer|watch|video|podcast|interview|in pictures|photos|quiz|newsletter|live|review|analysis-)|\|\s*(opinion|podcast|video)\b|looking to hire|is hiring|job opening|internship|vacanc|best books|book excerpt|historical fiction|short story|poem\b|recipe|horoscope/i;
/** Sections of a site that aren't Indian public-interest news. */
const OFF_BEAT = /^\/(world|international|sport|sports|entertainment|lifestyle|books|culture|food|travel|brandma|sponsored|photos|videos?)\//i;
const SIGNAL = /\b(rti|data|dataset|survey|audit|cag|report|order|petition|filing|affidavit|tender|budget|deaths?|records?|documents?|study|analysis|investigation|exclusive|notification|census|figures|accounts|hearing|chargesheet|fir)\b/gi;

export interface Candidate {
  item: FeedItem;
  promise: number;
}

/**
 * Items from independent outlets that no mainstream outlet in our library reported and that the
 * edition hasn't picked, most promising first (words that point to records: RTI, data, order…).
 */
export function findCandidates(library: FeedItem[], picks: SlatePick[], items: Map<string, FeedItem>, max = 12): Candidate[] {
  const picked = new Set(picks.flatMap((p) => p.itemIds));
  const pickedTitles = picks.flatMap((p) => [p.workingHeadline, ...p.itemIds.map((id) => items.get(id)?.title ?? "")]).filter(Boolean);
  const mainstream = library.filter((it) => MAINSTREAM.has(canonicalOutlet(it.outlet)));
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const it of library) {
    const outlet = canonicalOutlet(it.outlet);
    if (!INDEPENDENT.has(outlet) || picked.has(it.id) || (it.region === "world" && it.sectionHint === "world")) continue;
    if (NOT_NEWS.test(it.title) || it.title.split(/\s+/).length < 6) continue;
    try {
      if (OFF_BEAT.test(new URL(it.link).pathname)) continue;
    } catch {
      continue;
    }
    const keys = [...new Set(keyWords(it.title))];
    if (keys.length < 3 || seen.has(keys.join(" "))) continue;
    seen.add(keys.join(" "));
    if (pickedTitles.some((t) => sharedWords(it.title, t) >= 3)) continue;
    const covered = mainstream.some((m) => {
      const shared = sharedWords(it.title, m.title);
      return shared >= 3 && shared >= keys.length * 0.4;
    });
    if (covered) continue;
    const promise = (`${it.title} ${it.summary}`.match(SIGNAL)?.length ?? 0) + (it.summary.length > 80 ? 1 : 0);
    out.push({ item: it, promise });
  }
  return out.sort((a, b) => b.promise - a.promise || Date.parse(b.item.published ?? "0") - Date.parse(a.item.published ?? "0")).slice(0, max);
}

const TRIAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pick", "reason", "section", "checkable"],
  properties: {
    pick: { type: "string", description: "the candidate id (c0, c1, …) or none" },
    reason: { type: "string" },
    section: { type: "string", enum: SECTION_IDS.filter((s) => s !== "weather") },
    checkable: { type: "array", items: { type: "string" }, description: "the claims the piece rests on, each with the record behind it" },
  },
};

const TRIAGE_SYSTEM = `You are the investigations editor of Measured Edition, a calm, non-partisan news site read in India's big cities. Every day you may run one under-reported story: something that matters to readers in India which the mainstream outlets have not reported. Code has already checked that none of the big papers or the wire carried these candidates.

Choose at most one. A good pick:
- rests on a record that can be checked: an RTI reply, official data, a court filing or order, an audit, a government notification, a dataset, documents the outlet obtained, or a careful field report with named people;
- matters: public money, rights, safety, health, the environment, how power is used — not a curiosity;
- is news (new in the last two days), not an opinion piece, explainer, interview or campaign;
- is reported fairly enough to build on: claims attributed, the other side asked.
Prefer stories from beyond the big cities and about people who are rarely heard. Never pick a story whose main claim rests on one unnamed source, or that names or could identify a survivor of a sexual offence.

If none is strong enough, answer pick "none": a weak piece is worse than no piece. Otherwise give the reason in one or two sentences, the section it belongs in, and the claims the piece would rest on, each with the record behind it.`;

const PIECE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "dek", "summary", "body", "keyFacts", "background", "whatNext", "notChecked", "dateline", "tags", "imageQuery", "imageAlt"],
  properties: {
    headline: { type: "string" },
    dek: { type: "string" },
    summary: { type: "string" },
    body: { type: "array", items: { type: "string" } },
    keyFacts: { type: "array", items: { type: "string" } },
    background: { type: "string" },
    whatNext: { type: "string" },
    notChecked: { type: "string", description: "one or two sentences on what we could not check ourselves" },
    dateline: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    imageQuery: { type: "string" },
    imageAlt: { type: "string" },
  },
};

const PIECE_SYSTEM = `You write Measured Edition's daily under-reported story: an analysis built on one outlet's reporting of something the mainstream outlets have not covered. It runs under the label "Measured Edition analysis", with the outlet credited, so the reader knows whose reporting it rests on.

- Use only what the source reports. Every fact, figure and quote must be in it. Attribute: what the record shows ("the RTI reply shows", "the order says"), what people said, and that the outlet found or obtained it ("documents obtained by The Wire show"). Credit the outlet by name in the first or second paragraph, then attribute to the records and people.
- Say plainly what is established by a record and what is a claim. Give the response of the officials or the other side when the source has it, and say so when it does not.
- Shape: a 20–30 word first paragraph with the finding; a second paragraph on why it matters to readers in India; then the record, the people affected, the response and the context. 350–600 words. Plain sentences.
- notChecked: one or two sentences, honest and specific, on what we could not check ourselves (for example "We have not seen the RTI reply itself" or "The ministry's figures could not be independently checked").

${WRITER_STYLE}`;

const CHECK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["unsupported"],
  properties: {
    unsupported: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "problem", "serious"],
        properties: {
          claim: { type: "string" },
          problem: { type: "string" },
          serious: { type: "boolean", description: "true for a wrong or unsupported fact about the story; false for an overstatement, a loose generalisation or a wording problem" },
        },
      },
    },
  },
};

const CHECK_SYSTEM = `You are Measured Edition's fact-checker. Compare a draft story with the one source it is built on. List every statement of fact in the draft (headline, dek, summary, body, key facts, background, what next) that the source does not support: a figure, name, date, quote or claim that is missing from the source, stated more strongly than the source states it, or presented as established when the source presents it as a claim. Wording differences are fine; meaning differences are not.

Not problems: statements about the source itself that are true ("the report carries no response from the company"); a plain explanation of a general term ("suo motu, meaning on its own"); widely known facts about who someone is or what a body does, when they agree with the source.

Mark each problem serious (a wrong or unsupported fact about the story: a figure, name, date, quote, allegation or finding) or not (an overstatement, a loose generalisation, a wording problem). An empty list means the draft is fully supported.`;

export type Piece = Omit<WrittenStory, "perspectives" | "developing"> & { notChecked: string };

export interface UnderReported {
  piece: Piece;
  item: FeedItem;
  page: PageInfo;
  section: SectionId;
  reason: string;
}

async function ask<T>(req: JsonRequest, meter: CostMeter, batch: boolean, deadline: Date, stateFile: string): Promise<JsonResult<T>> {
  if (!batch) return callJson<T>(req, meter);
  const res = await runBatch<T>([req], meter, { deadline, stateFile, pollMs: 20_000 });
  return res.get(req.customId) ?? { ok: false, error: "missing" };
}

/** Finds, writes and fact-checks today's piece; undefined when there is none. Never throws. */
export async function underReported(opts: {
  library: FeedItem[];
  picks: SlatePick[];
  items: Map<string, FeedItem>;
  read: (url: string) => Promise<PageInfo>;
  meter: CostMeter;
  batch: boolean;
  deadline: Date;
  workDir: string;
  editionLabel: string;
}): Promise<UnderReported | undefined> {
  try {
    const cands = findCandidates(opts.library, opts.picks, opts.items);
    log(`under-reported: ${cands.length} candidates no mainstream outlet ran`);
    if (!cands.length) return undefined;
    const pages = new Map<string, PageInfo>();
    await mapLimit(cands, 4, async (c) => {
      const p = c.item.body ? { ok: true, status: 200, text: c.item.body } : await opts.read(c.item.alt ?? c.item.link);
      pages.set(c.item.id, p);
    });
    const readable = cands.filter((c) => (pages.get(c.item.id)?.text?.length ?? 0) >= 1500);
    if (!readable.length) return undefined;
    const listing = readable
      .map((c, i) => `<candidate id="c${i}" outlet="${canonicalOutlet(c.item.outlet)}" published="${c.item.published ?? "?"}">\nTITLE: ${c.item.title}\n${pages.get(c.item.id)!.text!.slice(0, 2500)}\n</candidate>`)
      .join("\n\n");
    const state = (n: string) => `${opts.workDir}/batch-underreported-${n}.json`;
    const triage = await ask<{ pick: string; reason: string; section: SectionId; checkable: string[] }>(
      { customId: "ur_triage", model: EDITOR_MODEL, system: TRIAGE_SYSTEM, user: `Edition: ${opts.editionLabel}\n\nCANDIDATES\n${listing}\n\nChoose today's under-reported story, or none.`, schema: TRIAGE_SCHEMA, effort: "medium", maxTokens: 8000 },
      opts.meter, opts.batch, opts.deadline, state("triage"),
    );
    if (!triage.ok) return void log(`under-reported: triage failed (${triage.error})`);
    const m = triage.data.pick.match(/^c(\d+)$/);
    const chosen = m ? readable[Number(m[1])] : undefined;
    if (!chosen) return void log(`under-reported: none today (${triage.data.reason.slice(0, 160)})`);
    const page = pages.get(chosen.item.id)!;
    const outlet = canonicalOutlet(chosen.item.outlet);
    const source = `<source outlet="${outlet}" published="${chosen.item.published ?? "unknown"}">\nTITLE: ${chosen.item.title}\nTEXT:\n${page.text!.slice(0, 12_000)}\n</source>`;
    const brief = `ASSIGNMENT\nEdition: ${opts.editionLabel}\nWhy this story: ${triage.data.reason}\nThe claims it rests on:\n${triage.data.checkable.map((c) => `- ${c}`).join("\n")}\n\nSOURCE (${outlet})\n${source}`;
    const write = (extra = "", n = "write") =>
      ask<Piece>({ customId: `ur_${n}`, model: WRITER_MODEL, system: PIECE_SYSTEM, user: `${brief}${extra}\n\nWrite the piece.`, schema: PIECE_SCHEMA, effort: "medium", maxTokens: 12000 }, opts.meter, opts.batch, opts.deadline, state(n));
    const check = (p: Piece, n: string) =>
      ask<{ unsupported: { claim: string; problem: string; serious: boolean }[] }>(
        { customId: `ur_${n}`, model: WRITER_MODEL, system: CHECK_SYSTEM, user: `${source}\n\nDRAFT\n${JSON.stringify({ headline: p.headline, dek: p.dek, summary: p.summary, body: p.body, keyFacts: p.keyFacts, background: p.background, whatNext: p.whatNext }, null, 1)}\n\nList the unsupported statements.`, schema: CHECK_SCHEMA, effort: "medium", maxTokens: 8000 },
        opts.meter, opts.batch, opts.deadline, state(n),
      );
    let draft = await write();
    if (!draft.ok) return void log(`under-reported: writing failed (${draft.error})`);
    let verdict = await check(draft.data, "check");
    if (!verdict.ok) return void log(`under-reported: fact-check failed (${verdict.error})`);
    if (verdict.data.unsupported.length) {
      log(`under-reported: fact-check found ${verdict.data.unsupported.length} unsupported statements; revising once`);
      draft = await write(`\n\nA fact-checker found these statements in your draft unsupported by the source. Remove or correct every one:\n${verdict.data.unsupported.map((u) => `- ${u.claim}: ${u.problem}`).join("\n")}\n\nDRAFT\n${JSON.stringify(draft.data, null, 1)}`, "revise");
      if (!draft.ok) return void log(`under-reported: revision failed (${draft.error})`);
      verdict = await check(draft.data, "recheck");
      // Only a serious problem left after the revision stops the piece.
      const serious = verdict.ok ? verdict.data.unsupported.filter((u) => u.serious) : [];
      if (!verdict.ok || serious.length) {
        return void log(`under-reported: still unsupported after revision (${verdict.ok ? serious.map((u) => u.claim).join("; ").slice(0, 200) : verdict.error}); none today`);
      }
      if (verdict.data.unsupported.length) log(`under-reported: ${verdict.data.unsupported.length} minor points left (${verdict.data.unsupported.map((u) => u.problem).join("; ").slice(0, 200)})`);
    }
    log(`under-reported: "${draft.data.headline}" from ${outlet} (${triage.data.reason.slice(0, 120)})`);
    return { piece: draft.data, item: chosen.item, page, section: triage.data.section, reason: triage.data.reason };
  } catch (e) {
    log(`under-reported: failed (${(e as Error).message}); none today`);
    return undefined;
  }
}
