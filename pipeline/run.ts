// Produce one Measured Edition edition end to end.
//   node pipeline/run.ts [--slot am|pm] [--date YYYY-MM-DD] [--batch] [--no-deploy] [--fresh] [--max N]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { SOURCES, canonicalOutlet, leaningFor } from "../config/sources.ts";
import { type FeedItem, gatherAll, linkRepublished } from "./feeds.ts";
import { budgetItems, windowHours } from "./budget.ts";
import { findCoverage } from "./coverage.ts";
import { type PageInfo, readPage } from "./enrich.ts";
import { type Slate, type SlatePick, CITY_SECTIONS, SECTION_IDS, SECTION_NAMES, buildEditorRequest, cleanSlate, planEdition, unalias } from "./editor.ts";
import { type WrittenStory, buildRevisionRequest, buildWriterRequest, sourceDocs, storyCustomId, storyText } from "./writer.ts";
import { CostMeter, type JsonResult, callJson, runBatch } from "./llm.ts";
import { findAiTells } from "./style.ts";
import { type ImageCandidate, type StoryImage, chooseOutletImage, wikimediaImage } from "./images.ts";
import { type VideoItem, gatherVideos } from "./videos.ts";
import { gatherPanels } from "./panels/index.ts";
import type { Panels } from "../site/types.ts";
import { istParts, loadDotEnv, log, mapLimit, readJson, slugify, writeJson } from "./util.ts";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
process.chdir(ROOT);
loadDotEnv(path.join(ROOT, ".env"));

// ───────────── args ─────────────
const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const now = new Date();
const ist = istParts(now);
// One edition a day (05:00 IST); the scheduled run starts ~90 min before. "pm" still works by hand.
const slot = (opt("slot") as "am" | "pm" | undefined) ?? (ist.hour < 14 ? "am" : "pm");
const date = opt("date") ?? ist.date;
if (slot !== "am" && slot !== "pm") throw new Error(`--slot must be am or pm, got ${slot}`);
const realDate = (d: string) => {
  const t = new Date(`${d}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
};
if (!realDate(date)) {
  throw new Error(`--date must be a real YYYY-MM-DD date, got ${date}`);
}
const editionId = `${date}-${slot}`;
const useBatch = flag("batch");
const build = !flag("no-build");
const deploy = build && !flag("no-deploy");
const fresh = flag("fresh");
const maxStories = Number(opt("max") ?? 0) || undefined;
const publishAt = new Date(`${date}T${slot === "am" ? "05:00" : "17:00"}:00+05:30`);
const editionLabel = `${new Date(publishAt).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}, ${slot === "am" ? "morning" : "evening"} edition`;

const WORK = path.join(ROOT, "data/work", editionId);
const EDITIONS = path.join(ROOT, "data/editions");
fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(EDITIONS, { recursive: true });

// ───────────── lock ─────────────
const LOCK = path.join(ROOT, "data/work/run.lock");
if (fs.existsSync(LOCK)) {
  const age = Date.now() - fs.statSync(LOCK).mtimeMs;
  if (age < 2 * 3600e3) {
    log(`another run holds the lock (${Math.round(age / 60000)} min old) — exiting`);
    process.exit(0);
  }
}
fs.writeFileSync(LOCK, String(process.pid));
const unlock = () => fs.rmSync(LOCK, { force: true });
process.on("exit", unlock);
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

// --fresh: start this edition from scratch (no cached feeds, slate, stories, pages or pictures).
if (fresh) {
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
}

const meter = new CostMeter();
const cached = <T>(name: string) => (fresh ? undefined : readJson<T>(path.join(WORK, name)));

function isMostlyLatin(s: string): boolean {
  const letters = s.replace(/[^\p{L}]/gu, "");
  if (!letters) return false;
  return (letters.match(/[A-Za-z]/g)?.length ?? 0) / letters.length > 0.8;
}

interface PastEdition {
  publishedAt?: string;
  stories: { headline: string }[];
  stats?: { gatheredAt?: string };
}

function previousEdition(): PastEdition | undefined {
  const files = fs.readdirSync(EDITIONS).filter((f) => f.endsWith(".json") && !f.startsWith(editionId)).sort();
  const last = files.at(-1);
  return last ? readJson<PastEdition>(path.join(EDITIONS, last)) : undefined;
}

function previousHeadlines(): string[] {
  return previousEdition()?.stories.map((s) => s.headline) ?? [];
}

/** When the last edition read its feeds (older editions only record when they were published). */
function lastGather(): number | undefined {
  const ed = previousEdition();
  const t = Date.parse(ed?.stats?.gatheredAt ?? ed?.publishedAt ?? "");
  return Number.isFinite(t) ? t : undefined;
}

const SEARCH_ONLY = new Set(SOURCES.filter((s) => s.searchOnly).map((s) => s.id));

/** Feeds read without fetching their pages (see Source.fetchPages). */
const NO_PAGES = new Set(SOURCES.filter((s) => s.fetchPages === false).map((s) => s.id));

async function main() {
  log(`edition ${editionId} (${editionLabel}) batch=${useBatch} deploy=${deploy}`);

  // 1. Gather
  let gathered = cached<{ items: FeedItem[]; library?: FeedItem[]; stats: { feedsTried: number; feedsOk: number; itemsSeen: number; gatheredAt?: string; windowHours?: number; failed?: { id: string; status: number; note: string }[] } }>("items.json");
  if (!gathered) {
    const gatheredAt = new Date().toISOString();
    const hours = windowHours(lastGather());
    log(`reading feeds back ${hours} hours (to the last edition's gather)`);
    const { items, stats } = await gatherAll(SOURCES, hours);
    // Each owner gets a budget per section, sampled across the whole window (pipeline/budget.ts).
    const readable = linkRepublished(items.filter((it) => isMostlyLatin(it.title) && it.title.split(/\s+/).length >= 4));
    log(`${readable.filter((i) => i.alt).length} headline-only items have a full republished copy we may read`);
    // Everything readable stays in a library for finding other reports of picked stories.
    const library = readable.filter((it) => it.pages !== false || it.alt || it.body);
    gathered = {
      items: budgetItems(readable.filter((it) => !SEARCH_ONLY.has(it.sourceId))),
      library,
      stats: { ...stats, gatheredAt, windowHours: hours },
    };
    writeJson(path.join(WORK, "items.json"), gathered);
  }
  const items = new Map(gathered.items.map((i) => [i.id, i]));
  log(`items for editor: ${items.size}`);

  let videos = cached<VideoItem[]>("videos.json");
  if (!videos) {
    videos = await gatherVideos(slot === "am" ? 16 : 14);
    writeJson(path.join(WORK, "videos.json"), videos);
  }
  const videoById = new Map(videos.map((v) => [v.id, v]));

  // 2. Editor
  let slate = cached<Slate>("slate.json");
  if (!slate) {
    const { req, aliases } = buildEditorRequest({ items: gathered.items, videos, previousHeadlines: previousHeadlines(), editionLabel });
    log(`editor: asking ${req.model} (${req.user.length} chars)…`);
    // Batch (half price). The owner prefers cost to punctuality, so wait until 40 minutes before
    // publication (at least 25 minutes) before paying full price for a direct call. On
    // 2026-11-24 a 25-minute limit expired and the direct re-run doubled the editor's cost.
    const res = await planEdition(req, meter, {
      batch: useBatch,
      deadline: new Date(Math.max(publishAt.getTime() - 40 * 60e3, Date.now() + 25 * 60e3)),
      stateFile: path.join(WORK, "batch-editor.json"),
    });
    if (!res.ok) throw new Error(`editor failed: ${res.error}`);
    writeJson(path.join(WORK, "slate.raw.json"), res.data);
    slate = cleanSlate(unalias(res.data, aliases), items, new Set(videoById.keys()));
    writeJson(path.join(WORK, "slate.json"), slate);
    log(`editor: ${slate.stories.length} stories, cost so far $${meter.total.toFixed(3)}`);
  }
  {
    // Visibility: contested stories whose sources all sit on one side of centre.
    const side = (id: string) => items.get(id)?.leaning ?? "centre";
    const oneSided = slate.stories.filter((p) => {
      if (!p.contested) return false;
      const l = p.itemIds.map(side);
      return !(l.some((x) => x === "left" || x === "centre-left") && l.some((x) => x === "right" || x === "centre-right"));
    });
    if (oneSided.length) log(`contested stories missing one side's sources: ${oneSided.map((p) => p.key).join(", ")}`);
  }
  let picks = slate.stories;
  if (maxStories) picks = picks.slice(0, maxStories);

  // 3. Enrich the chosen items (article text + og:image)
  const pagesFile = path.join(WORK, "pages.json");
  const pageCache = new Map<string, PageInfo>(Object.entries(readJson<Record<string, PageInfo>>(pagesFile) ?? {}));
  const toRead = [...new Set(picks.flatMap((p) => p.itemIds))]
    .map((id) => items.get(id)!)
    .filter((it) => it && (it.body || it.alt || (it.pages !== false && !NO_PAGES.has(it.sourceId))) && !pageCache.has(it.id));
  log(`reading ${toRead.length} article pages…`);
  await mapLimit(toRead, 8, async (it) => {
    const page = it.body && it.pages === false ? { ok: false, status: 0 } : await readPage(it.alt ?? it.link);
    // Full text that came with the item (the Guardian's API) beats a page we couldn't parse.
    if (it.body && (page.text?.length ?? 0) < it.body.length * 0.8) {
      Object.assign(page, { ok: true, text: it.body.length > 14_000 ? it.body.slice(0, 14_000) + " …" : it.body });
    }
    pageCache.set(it.id, page);
  });
  writeJson(pagesFile, Object.fromEntries(pageCache));

  // 3b. Stories with fewer than three full texts to write from: find other outlets' reports of the
  // same event (pipeline/coverage.ts) and read those we may. Saved, so a re-run doesn't repeat it.
  let coverage = cached<{ items: FeedItem[]; added: Record<string, string[]> }>("coverage.json");
  if (!coverage) {
    coverage = { items: [], added: {} };
    const fullTexts = (p: SlatePick) => p.itemIds.filter((id) => (pageCache.get(id)?.text?.length ?? 0) >= 800).length;
    const needMore = picks.filter((p) => fullTexts(p) < 3);
    log(`searching for more coverage of ${needMore.length} stories…`);
    const stopAt = Date.now() + 12 * 60e3; // never let the search hold up the edition
    for (const p of needMore) {
      if (Date.now() > stopAt) {
        log("coverage search: out of time, stopping");
        break;
      }
      const first = items.get(p.itemIds[0]);
      if (!first) continue;
      const have = new Set(p.itemIds.map((id) => canonicalOutlet(items.get(id)?.outlet ?? "")));
      const pages = new Map<string, PageInfo>();
      const found = await findCoverage(p.workingHeadline, first, have, async (url) => {
        const page = await readPage(url);
        pages.set(url, page);
        return page.ok ? page.text : undefined;
      }, 2, gathered.library ?? []).catch((e) => {
        log(`coverage search failed for ${p.key}: ${(e as Error).message}`);
        return [];
      });
      for (const f of found) {
        coverage.items.push(f.item);
        pageCache.set(f.item.id, pages.get(f.item.alt ?? f.item.link) ?? { ok: true, status: 200, text: f.text });
        (coverage.added[p.key] ??= []).push(f.item.id);
      }
    }
    writeJson(path.join(WORK, "coverage.json"), coverage);
    writeJson(pagesFile, Object.fromEntries(pageCache));
  }
  for (const it of coverage.items) items.set(it.id, it);
  for (const p of picks) for (const id of coverage.added[p.key] ?? []) if (!p.itemIds.includes(id)) p.itemIds.push(id);
  log(`coverage search added ${coverage.items.length} reports to ${Object.keys(coverage.added).length} stories`);
  const okPages = [...pageCache.values()].filter((p) => p.ok && p.text).length;
  log(`pages with text: ${okPages}/${pageCache.size}`);

  // Drop stories whose material is too thin to write responsibly.
  picks = picks.filter((p) => {
    const material = p.itemIds.reduce((n, id) => n + (pageCache.get(id)?.text?.length ?? 0) + (items.get(id)?.summary.length ?? 0), 0);
    if (material < 500) log(`dropping thin story ${p.key} (${material} chars of material)`);
    return material >= 500;
  });

  // 4. Write
  const storiesDir = path.join(WORK, "stories");
  fs.mkdirSync(storiesDir, { recursive: true });
  const written = new Map<string, WrittenStory>();
  for (const p of picks) {
    const s = cached<WrittenStory>(`stories/${p.key}.json`);
    if (s) written.set(p.key, s);
  }
  const docsFor = (p: SlatePick) => sourceDocs(p, items, pageCache);
  const todo = picks.filter((p) => !written.has(p.key));
  const reqs = todo.map((p) => buildWriterRequest(p, docsFor(p), editionLabel));
  log(`writing ${reqs.length} stories (${useBatch ? "batch" : "direct"})…`);
  let results: Map<string, JsonResult<WrittenStory>>;
  if (useBatch) {
    results = await runBatch<WrittenStory>(reqs, meter, {
      // Re-running a past edition: give the batch an hour rather than an already-passed deadline.
      deadline: new Date(Math.max(publishAt.getTime() - 15 * 60e3, Date.now() + 60 * 60e3)),
      stateFile: path.join(WORK, "batch-writer.json"),
    });
  } else {
    results = new Map();
    await mapLimit(reqs, 6, async (r) => {
      results.set(r.customId, await callJson<WrittenStory>(r, meter));
    });
  }
  for (const p of todo) {
    const r = results.get(storyCustomId(p.key));
    if (r?.ok) {
      written.set(p.key, r.data);
      writeJson(path.join(storiesDir, `${p.key}.json`), r.data);
    } else log(`story ${p.key} failed: ${r && !r.ok ? r.error : "missing"}`);
  }
  log(`written ${written.size}/${picks.length}, cost so far $${meter.total.toFixed(3)}`);

  // 5. Style check → one revision for stories with AI tells
  const revise = picks.filter((p) => written.has(p.key) && findAiTells(storyText(written.get(p.key)!)).length > 0);
  if (revise.length) log(`revising ${revise.length} stories for style…`);
  await mapLimit(revise, 4, async (p) => {
    const draft = written.get(p.key)!;
    const tells = findAiTells(storyText(draft));
    const r = await callJson<WrittenStory>(buildRevisionRequest(p, draft, tells, docsFor(p), editionLabel), meter);
    if (r.ok) {
      const left = findAiTells(storyText(r.data));
      log(`revised ${p.key}: [${tells.join(", ")}] → [${left.join(", ")}]`);
      if (left.length <= tells.length) {
        written.set(p.key, r.data);
        writeJson(path.join(storiesDir, `${p.key}.json`), r.data);
      }
    }
  });

  // 6. Pictures
  const imagesFile = path.join(WORK, "images.json");
  const images = new Map<string, StoryImage | null>(Object.entries(readJson<Record<string, StoryImage | null>>(imagesFile) ?? {}));
  const needImg = picks.filter((p) => written.has(p.key) && !images.has(p.key));
  log(`choosing pictures for ${needImg.length} stories…`);
  await mapLimit(needImg, 6, async (p) => {
    const w = written.get(p.key)!;
    const cands: ImageCandidate[] = [];
    for (const id of p.itemIds) {
      const it = items.get(id);
      if (!it) continue;
      const page = pageCache.get(id);
      // A republished copy's picture belongs to the republisher, whom the story doesn't credit.
      if (page?.ogImage && !it.alt) cands.push({ url: page.ogImage, outlet: it.outlet, sourceUrl: it.link, declaredWidth: page.ogImageWidth, from: "og" });
      if (it.image) cands.push({ url: it.image, outlet: it.outlet, sourceUrl: it.link, from: "rss" });
    }
    let img = await chooseOutletImage(cands, w.imageAlt || w.headline);
    if (!img) img = await wikimediaImage(w.imageQuery, w.imageAlt || w.headline);
    images.set(p.key, img ?? null);
  });
  writeJson(imagesFile, Object.fromEntries(images));

  // 7. Data panels (weather, markets, AI & software lists, charts)
  let panels = cached<Panels>("panels.json");
  if (!panels) {
    panels = await gatherPanels({ meter, marketsDir: path.join(ROOT, "data/markets") });
    writeJson(path.join(WORK, "panels.json"), panels);
  }

  // 8. Assemble edition
  const usedSlugs = new Set<string>();
  const stories = picks
    .filter((p) => written.has(p.key))
    .map((p, i) => {
      const w = written.get(p.key)!;
      let id = slugify(w.headline);
      while (usedSlugs.has(id)) id += "-2";
      usedSlugs.add(id);
      const words = [...w.body, w.background, w.whyItMatters].join(" ").split(/\s+/).length;
      const v = p.videoId ? videoById.get(p.videoId) : undefined;
      const sourceUrls = new Set(p.itemIds.map((id) => items.get(id)?.link).filter(Boolean));
      // Writers are told links aren't needed; any that appear must point at one of this story's sources.
      const unlink = (t: string) => t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label: string, url: string) => (sourceUrls.has(url) ? m : label));
      const img = images.get(p.key) ?? undefined;
      return {
        id,
        key: p.key,
        section: p.section,
        rank: i + 1,
        lead: p.lead,
        headline: w.headline,
        dek: w.dek,
        summary: w.summary,
        body: w.body.map(unlink),
        keyFacts: w.keyFacts,
        background: w.background,
        whyItMatters: w.whyItMatters,
        perspectives: p.contested && w.perspectives.length >= 2 ? w.perspectives : [],
        dateline: w.dateline,
        developing: w.developing,
        image: img,
        video: v ? { youtubeId: v.youtubeId, title: v.title, channel: v.channel } : undefined,
        // One entry per outlet: a second report from the same outlet is not a second source.
        sources: p.itemIds
          .map((id) => items.get(id))
          .filter((x): x is FeedItem => !!x)
          .filter((x, i, all) => all.findIndex((y) => canonicalOutlet(y.outlet) === canonicalOutlet(x.outlet)) === i)
          .map((x) => ({ outlet: canonicalOutlet(x.outlet), title: x.title, url: x.link, leaning: leaningFor(x.outlet) ?? x.leaning })),
        tags: w.tags,
        readingMinutes: Math.max(1, Math.round(words / 220)),
      };
    });

  const lead = stories.filter((s) => s.lead).sort((a, b) => a.rank - b.rank).map((s) => s.id);
  const sections = SECTION_IDS.map((sid) => ({
    id: sid,
    name: SECTION_NAMES[sid],
    storyIds: stories.filter((s) => s.section === sid && !s.lead).sort((a, b) => a.rank - b.rank).map((s) => s.id),
  })).filter((s) => s.storyIds.length > 0 || (s.id === "weather" && panels.weather) || (s.id === "ai-software" && panels.tech) || (s.id === "entertainment" && panels.culture));

  const edition = {
    id: editionId,
    date,
    slot: slot === "am" ? "morning" : "evening",
    publishedAt: new Date().toISOString(),
    lead,
    sections,
    stories: stories.map(({ key: _k, lead: _l, ...rest }) => rest),
    panels,
    stats: {
      feedsScanned: gathered.stats.feedsOk,
      gatheredAt: gathered.stats.gatheredAt,
      itemsSeen: gathered.stats.itemsSeen,
      pagesRead: okPages,
      costUsd: Math.round(meter.total * 1000) / 1000,
      // For the morning check: GitHub shows run logs only to signed-in accounts.
      feedsTried: gathered.stats.feedsTried,
      feedsFailed: (gathered.stats.failed ?? []).map((f) => `${f.id} (${[f.status || "", f.note].filter(Boolean).join(" ")})`),
      windowHours: gathered.stats.windowHours,
      coverageAdded: Object.fromEntries(picks.filter((p) => coverage.added[p.key]?.length).map((p) => [p.workingHeadline.slice(0, 80), coverage.added[p.key].map((id) => items.get(id)?.outlet ?? id)])),
    },
  };
  if (stories.length < 15 && !maxStories) throw new Error(`only ${stories.length} stories written — not publishing`);
  writeJson(path.join(EDITIONS, `${editionId}.json`), edition);
  writeJson(path.join(WORK, "cost.json"), { total: meter.total, byModel: meter.byModel, calls: meter.calls });
  log(`edition written: ${stories.length} stories, ${stories.filter((s) => s.image).length} with pictures, ${stories.filter((s) => s.video).length} with video. Cost $${meter.total.toFixed(3)}`);

  // 9. Build + deploy
  if (!build) return;
  execFileSync(process.execPath, ["site/build.ts", "--data", "data/editions", "--out", "dist"], { stdio: "inherit" });
  if (deploy) {
    execFileSync(path.join(ROOT, "node_modules/.bin/wrangler"), ["deploy"], { stdio: "inherit" });
    log("deployed");
  }
}

main().catch((e) => {
  log(`FAILED: ${(e as Error).stack ?? e}`);
  process.exitCode = 1;
});
