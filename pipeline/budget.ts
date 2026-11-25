// What the editor is shown. Each owner gets a budget per section (per city for city news),
// sampled evenly across the whole window, so a busy newsroom's daytime work isn't crowded out
// by its newest items and no one group can flood the menu. The editor's menu costs about 15
// tokens a headline, so it can be generous; the writer's cost depends on stories, not items.
import { CITY_SECTIONS } from "./editor.ts";
import type { FeedItem } from "./feeds.ts";

const isCity = (r: string) => (CITY_SECTIONS as readonly string[]).includes(r);

/** How many items an owner may show the editor in one section. */
export function budgetFor(it: Pick<FeedItem, "region" | "tier" | "sectionHint">): number {
  if (isCity(it.region)) return it.tier === "corroborate" ? 4 : 10;
  if (it.tier === "wire") return it.sectionHint === "india" ? 30 : it.sectionHint === "business" ? 20 : 12;
  return 16;
}

/** Evenly spaced picks from a list sorted newest first (always including the newest). */
function spread<T>(sorted: T[], n: number): T[] {
  if (sorted.length <= n) return sorted;
  return Array.from({ length: n }, (_, i) => sorted[Math.floor((i * sorted.length) / n)]);
}

export function budgetItems(items: FeedItem[]): FeedItem[] {
  const groups = new Map<string, FeedItem[]>();
  for (const it of items) {
    const key = `${it.owner}|${isCity(it.region) ? it.region : it.sectionHint}`;
    const g = groups.get(key) ?? [];
    g.push(it);
    groups.set(key, g);
  }
  return [...groups.values()].flatMap((g) =>
    spread(g.sort((a, b) => Date.parse(b.published ?? "0") - Date.parse(a.published ?? "0")), budgetFor(g[0])),
  );
}

/**
 * Hours to look back: to the previous gather, less an hour of overlap, so nothing published
 * between two editions goes unseen. At least 26 hours (outlets that post city news after the
 * morning run are caught the next day); at most 50 (after a missed day).
 */
export function windowHours(lastGather: number | undefined, now = Date.now()): number {
  if (!lastGather || !Number.isFinite(lastGather)) return 26;
  return Math.min(50, Math.max(26, Math.ceil((now - lastGather) / 3600_000 + 1)));
}
