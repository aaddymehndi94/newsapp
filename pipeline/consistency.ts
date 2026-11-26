// Weekly consistency check (part 2 of the redesign): run the editor a second time on the exact
// menu an edition was chosen from and record how much the two choices agree. Target: 3 of 4 leads
// and 7 stories in 10. About $0.25 at batch prices.
//   node pipeline/consistency.ts --edition 2026-11-29-am [--batch]
import fs from "node:fs";
import path from "node:path";
import type { FeedItem } from "./feeds.ts";
import type { VideoItem } from "./videos.ts";
import { type Slate, buildEditorRequest, cleanSlate, planEdition, unalias } from "./editor.ts";
import { CostMeter } from "./llm.ts";
import { loadDotEnv, log, readJson, writeJson } from "./util.ts";

/** Stories of two slates that share an item are the same story. */
export function overlap(a: Slate, b: Slate): { leads: number; leadsOf: number; stories: number; storiesOf: number } {
  const same = (x: Slate["stories"][number], y: Slate["stories"][number]) => x.itemIds.some((id) => y.itemIds.includes(id));
  const leadsA = a.stories.filter((s) => s.lead);
  const leadsB = b.stories.filter((s) => s.lead);
  return {
    leads: leadsA.filter((x) => leadsB.some((y) => same(x, y))).length,
    leadsOf: leadsA.length,
    stories: a.stories.filter((x) => b.stories.some((y) => same(x, y))).length,
    storiesOf: a.stories.length,
  };
}

async function main() {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  loadDotEnv(path.join(root, ".env"));
  const argv = process.argv.slice(2);
  const editionId = argv[argv.indexOf("--edition") + 1];
  if (!argv.includes("--edition") || !editionId) throw new Error("--edition YYYY-MM-DD-am is required");
  const work = path.join(root, "data/work", editionId);
  const gathered = readJson<{ items: FeedItem[] }>(path.join(work, "items.json"));
  const first = readJson<Slate>(path.join(work, "slate.json"));
  if (!gathered || !first) throw new Error(`no saved menu and slate in ${work}`);
  const videos = readJson<VideoItem[]>(path.join(work, "videos.json")) ?? [];
  const editions = path.join(root, "data/editions");
  const prev = fs.readdirSync(editions).filter((f) => f.endsWith(".json") && !f.startsWith(editionId)).sort().at(-1);
  const previousHeadlines = prev ? (readJson<{ stories: { headline: string }[] }>(path.join(editions, prev))?.stories ?? []).map((s) => s.headline) : [];
  const { req, aliases } = buildEditorRequest({ items: gathered.items, videos, previousHeadlines, editionLabel: `${editionId} (consistency check)` });
  const meter = new CostMeter();
  const res = await planEdition({ ...req, customId: "consistency" }, meter, { batch: argv.includes("--batch"), deadline: new Date(Date.now() + 90 * 60e3) });
  if (!res.ok) throw new Error(`editor failed: ${res.error}`);
  const items = new Map(gathered.items.map((i) => [i.id, i]));
  const second = cleanSlate(unalias(res.data, aliases), items, new Set(videos.map((v) => v.id)));
  const o = overlap(first, second);
  const out = { edition: editionId, checkedAt: new Date().toISOString(), ...o, costUsd: Math.round(meter.total * 1000) / 1000 };
  fs.mkdirSync(path.join(root, "data/consistency"), { recursive: true });
  writeJson(path.join(root, "data/consistency", `${editionId}.json`), out);
  log(`consistency: leads ${o.leads}/${o.leadsOf}, stories ${o.stories}/${o.storiesOf} (target 3/4 and 7 in 10), cost $${out.costUsd}`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((e) => {
    log(`FAILED: ${(e as Error).message}`);
    process.exitCode = 1;
  });
}
