// Produce one Meridian edition end to end.
//   node pipeline/run.ts [--slot am|pm] [--date YYYY-MM-DD] [--batch] [--no-deploy] [--fresh] [--max N]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { SOURCES, canonicalOutlet, leaningFor } from "../config/sources.ts";
import { type FeedItem, gatherAll } from "./feeds.ts";
import { type PageInfo, readPage } from "./enrich.ts";
import { type Slate, type SlatePick, SECTION_IDS, SECTION_NAMES, buildEditorRequest, cleanSlate, planEdition, unalias } from "./editor.ts";
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

function previousHeadlines(): string[] {
  const files = fs.readdirSync(EDITIONS).filter((f) => f.endsWith(".json") && !f.startsWith(editionId)).sort();
  const last = files.at(-1);
  if (!last) return [];
  const ed = readJson<{ stories: { headline: string }[] }>(path.join(EDITIONS, last));
  return ed?.stories.map((s) => s.headline) ?? [];
}

async function main() {
  log(`edition ${editionId} (${editionLabel}) batch=${useBatch} deploy=${deploy}`);

  // 1. Gather
  let gathered = cached<{ items: FeedItem[]; stats: { feedsTried: number; feedsOk: number; itemsSeen: number } }>("items.json");
  if (!gathered) {
    const { items, stats } = await gatherAll(SOURCES, slot === "am" ? 16 : 14);
    // Keep the 16 most recent items per feed so one prolific feed can't flood the editor.
    const bySource = new Map<string, FeedItem[]>();
    for (const it of items) {
      if (!isMostlyLatin(it.title)) continue;
      if (it.title.split(/\s+/).length < 4) continue;
      const arr = bySource.get(it.sourceId) ?? [];
      arr.push(it);
      bySource.set(it.sourceId, arr);
    }
    const trimmed = [...bySource.values()].flatMap((arr) =>
      arr.sort((a, b) => Date.parse(b.published ?? "0") - Date.parse(a.published ?? "0")).slice(0, 16),
    );
    gathered = { items: trimmed, stats };
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
    // Batch (half price) with a 25-minute deadline, then falls back to a direct call.
    const res = await planEdition(req, meter, {
      batch: useBatch,
      deadline: new Date(Date.now() + 25 * 60e3),
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
    .filter((it) => it && it.kind === "rss" && !pageCache.has(it.id));
  log(`reading ${toRead.length} article pages…`);
  await mapLimit(toRead, 8, async (it) => {
    pageCache.set(it.id, await readPage(it.link));
  });
  writeJson(pagesFile, Object.fromEntries(pageCache));
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
      if (page?.ogImage) cands.push({ url: page.ogImage, outlet: it.outlet, sourceUrl: it.link, declaredWidth: page.ogImageWidth, from: "og" });
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
        sources: p.itemIds
          .map((id) => items.get(id))
          .filter((x): x is FeedItem => !!x)
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
      itemsSeen: gathered.stats.itemsSeen,
      pagesRead: okPages,
      costUsd: Math.round(meter.total * 1000) / 1000,
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
