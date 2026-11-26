// Events: headlines from different outlets that report the same thing, grouped in code before the
// editor sees them (part 2 of the redesign, docs/superpowers/specs/2026-11-26-selection-design.md).
// The editor then judges events, each showing how many outlets and owners carry it, instead of
// clustering 1,500 loose headlines in feed order in its head. Precision matters more than recall:
// the editor can still join reports we left apart, but a wrong group would mislead it.
import { canonicalOutlet, outletInfo } from "../config/sources.ts";
import { keyWords } from "./coverage.ts";
import type { FeedItem } from "./feeds.ts";

export interface NewsEvent {
  items: FeedItem[];
  outlets: number;
  owners: number;
  firstSeen?: string;
  /** Where most of its items were filed (a city, or a section hint such as "india"). */
  home: string;
}

const ownerOf = (it: FeedItem) => it.owner ?? outletInfo(it.outlet)?.owner ?? it.outlet;

/** Words that name something in this headline: capitalised mid-sentence, acronyms and figures. */
function namesIn(title: string): Set<string> {
  const words = title.replace(/[‘’“”"'.,:;!?()[\]]/g, " ").split(/\s+/).filter(Boolean);
  const titleCase = words.filter((w) => /^\p{Lu}/u.test(w)).length > words.length * 0.6;
  const out = new Set<string>();
  words.forEach((w, i) => {
    if (/\d/.test(w) || /^\p{Lu}{2,}$/u.test(w) || (!titleCase && i > 0 && /^\p{Lu}/u.test(w))) for (const k of keyWords(w)) out.add(k);
  });
  return out;
}

/**
 * One copy of each headline per outlet (PTI files the same story under several sitemaps), then
 * groups of reports of one event: two headlines match when they share at least three key words,
 * at least half of the shorter one's, including a name or figure, and were published within
 * `hours` of each other. Groups join only when at least a third of their cross pairs match, so
 * one loose link can't chain two stories together.
 */
export function groupEvents(items: FeedItem[], opts: { hours?: number; maxSize?: number } = {}): NewsEvent[] {
  const span = (opts.hours ?? 36) * 3600_000;
  const maxSize = opts.maxSize ?? 30;
  const seen = new Set<string>();
  items = items.filter((it) => {
    const k = `${canonicalOutlet(it.outlet)}|${it.title.toLowerCase().replace(/\W+/g, " ").trim()}`;
    return !seen.has(k) && !!seen.add(k);
  });
  const n = items.length;
  const raw = items.map((it) => [...new Set(keyWords(it.title))]);
  const df = new Map<string, number>();
  for (const ws of raw) for (const w of ws) df.set(w, (df.get(w) ?? 0) + 1);
  const generic = Math.max(20, n * 0.04); // "india", "says", "govt"
  const words = raw.map((ws) => ws.filter((w) => (df.get(w) ?? 0) <= generic));
  const names = items.map((it) => namesIn(it.title));
  const time = items.map((it) => Date.parse(it.published ?? "") || 0);
  const index = new Map<string, number[]>();
  words.forEach((ws, i) => ws.forEach((w) => (index.get(w) ?? index.set(w, []).get(w)!).push(i)));

  const linked = new Set<number>();
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const counts = new Map<number, string[]>();
    for (const w of words[i]) for (const j of index.get(w)!) if (j > i) (counts.get(j) ?? counts.set(j, []).get(j)!).push(w);
    for (const [j, shared] of counts) {
      if (shared.length < 3 || shared.length < 0.5 * Math.min(words[i].length, words[j].length)) continue;
      if (!shared.some((w) => names[i].has(w) || names[j].has(w))) continue;
      if (time[i] && time[j] && Math.abs(time[i] - time[j]) > span) continue;
      linked.add(i * n + j);
      pairs.push([shared.length / Math.max(words[i].length, words[j].length), i, j]);
    }
  }
  const isLinked = (a: number, b: number) => linked.has(a < b ? a * n + b : b * n + a);

  const members = items.map((_, i) => [i]);
  const group = items.map((_, i) => i);
  pairs.sort((a, b) => b[0] - a[0]);
  for (const [, i, j] of pairs) {
    const a = group[i];
    const b = group[j];
    if (a === b || members[a].length + members[b].length > maxSize) continue;
    let links = 0;
    for (const x of members[a]) for (const y of members[b]) if (isLinked(x, y)) links++;
    if (links < (members[a].length * members[b].length) / 3) continue;
    for (const y of members[b]) group[y] = a;
    members[a].push(...members[b]);
    members[b] = [];
  }

  return members.filter((m) => m.length).map((m) => {
    const g = m.map((i) => items[i]).sort((a, b) => Date.parse(a.published ?? "") - Date.parse(b.published ?? ""));
    const homes = new Map<string, number>();
    for (const it of g) {
      const h = it.region !== "india" && it.region !== "world" ? it.region : it.sectionHint;
      homes.set(h, (homes.get(h) ?? 0) + 1);
    }
    return {
      items: g,
      outlets: new Set(g.map((it) => canonicalOutlet(it.outlet))).size,
      owners: new Set(g.map(ownerOf)).size,
      firstSeen: g.find((it) => it.published)?.published,
      home: [...homes].sort((a, b) => b[1] - a[1])[0][0],
    };
  });
}
