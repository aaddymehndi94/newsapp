// Fetches every configured feed and prints status, item count, recent count and image coverage.
import { SOURCES } from "../config/sources.ts";
import { parseFeed } from "../pipeline/feeds.ts";
import { fetchText, mapLimit } from "../pipeline/util.ts";

const only = process.argv[2];
const list = only ? SOURCES.filter((s) => s.id.includes(only)) : SOURCES;
const rows = await mapLimit(list, 12, async (s) => {
  const t0 = Date.now();
  const r = await fetchText(s.url, { accept: "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5" });
  const items = r.ok ? parseFeed(r.text, s) : [];
  const recent = items.filter((i) => !i.published || Date.now() - Date.parse(i.published) < 24 * 3600e3).length;
  const imgs = items.filter((i) => i.image).length;
  return { id: s.id, status: r.status, items: items.length, recent, imgs, ms: Date.now() - t0, note: r.ok ? "" : r.text.slice(0, 60), sample: items[0]?.title?.slice(0, 50) ?? "" };
});
for (const r of rows) console.log(`${r.items ? "OK  " : "FAIL"} ${r.id.padEnd(18)} ${String(r.status).padEnd(4)} items=${String(r.items).padEnd(3)} 24h=${String(r.recent).padEnd(3)} img=${String(r.imgs).padEnd(3)} ${r.ms}ms ${r.note || r.sample}`);
console.log(`\n${rows.filter((r) => r.items).length}/${rows.length} feeds OK`);
