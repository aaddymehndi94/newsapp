// Markets panel: end-of-day values with a 30-day chart, from sources that publish them openly.
//   Nifty 50, Nifty Bank: NSE's daily index closing file (nsearchives.nseindia.com).
//   US dollar in rupees: European Central Bank reference rates, via api.frankfurter.dev.
//   Gold (24 carat, ₹ per 10 g) and silver (₹ per kg): India Bullion and Jewellers Association.
//   Bitcoin: Coinbase Exchange public market data.
// Sensex, S&P 500 and Nasdaq are left out: their publishers either block automated access
// (BSE, Cboe, Nasdaq) or only license the data for private use, and we don't work around that.
import fs from "node:fs";
import path from "node:path";
import type { MarketPoint, MarketQuote, MarketsPanel } from "../../site/types.ts";
import { fetchText, log, mapLimit, readJson, writeJson } from "../util.ts";

const CHART_POINTS = 30;

/** Build a quote from a date-ascending history: latest value and the change from the one before. */
export function quoteFrom(
  base: Omit<MarketQuote, "value" | "change" | "changePct" | "asOf" | "history">,
  history: MarketPoint[],
): MarketQuote | undefined {
  const h = history.filter((p) => Number.isFinite(p.value) && p.value > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (h.length < 2) return undefined;
  const last = h[h.length - 1];
  const prev = h[h.length - 2];
  const change = last.value - prev.value;
  return {
    ...base,
    value: last.value,
    change,
    changePct: (change / prev.value) * 100,
    asOf: last.date,
    history: h.slice(-CHART_POINTS),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// ───────────── NSE ─────────────

/** Parse NSE's ind_close_all CSV into { index name → closing value }. */
export function parseNseClose(csv: string): Map<string, number> {
  const out = new Map<string, number>();
  const lines = csv.trim().split(/\r?\n/);
  const head = lines[0]?.split(",").map((s) => s.trim().toLowerCase()) ?? [];
  const ci = head.findIndex((h) => h.startsWith("closing index value"));
  if (ci < 0) return out;
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const v = Number(cols[ci]);
    if (cols[0] && Number.isFinite(v)) out.set(cols[0].trim(), v);
  }
  return out;
}

interface NseCache {
  days: Record<string, Record<string, number>>;
  /** Weekdays with no file (holidays), so they aren't asked for again. */
  closed: string[];
}

const NSE_INDICES = ["Nifty 50", "Nifty Bank"];

async function nse(dataDir: string): Promise<MarketQuote[]> {
  const file = path.join(dataDir, "nse.json");
  const cache: NseCache = readJson<NseCache>(file) ?? { days: {}, closed: [] };
  const today = new Date(Date.now() + 5.5 * 3600e3);
  const wanted: string[] = [];
  for (let i = 0; i < 45; i++) {
    const d = new Date(today.getTime() - i * 86400e3);
    const dow = d.getUTCDay();
    const key = ymd(d);
    if (dow === 0 || dow === 6 || cache.days[key] || cache.closed.includes(key)) continue;
    wanted.push(key);
  }
  await mapLimit(wanted, 2, async (key) => {
    const [y, m, d] = key.split("-");
    const r = await fetchText(`https://nsearchives.nseindia.com/content/indices/ind_close_all_${d}${m}${y}.csv`, {
      accept: "text/csv,*/*;q=0.5",
      timeoutMs: 20_000,
    });
    if (r.ok && r.contentType.includes("csv")) {
      const all = parseNseClose(r.text);
      const keep: Record<string, number> = {};
      for (const n of NSE_INDICES) if (all.has(n)) keep[n] = all.get(n)!;
      if (Object.keys(keep).length) cache.days[key] = keep;
    } else if (r.status === 404 && Date.parse(key) < today.getTime() - 3 * 86400e3) {
      cache.closed.push(key); // an old weekday with no file: a market holiday
    }
  });
  // Keep the cache small: 60 days.
  const cutoff = ymd(new Date(today.getTime() - 60 * 86400e3));
  for (const k of Object.keys(cache.days)) if (k < cutoff) delete cache.days[k];
  cache.closed = cache.closed.filter((k) => k >= cutoff).sort();
  fs.mkdirSync(dataDir, { recursive: true });
  writeJson(file, cache);

  const series = (name: string) =>
    Object.entries(cache.days)
      .filter(([, v]) => typeof v[name] === "number")
      .map(([date, v]) => ({ date, value: v[name] }));
  return [
    quoteFrom({ id: "nifty50", name: "Nifty 50", unit: "", decimals: 2, source: "NSE" }, series("Nifty 50")),
    quoteFrom({ id: "niftybank", name: "Nifty Bank", unit: "", decimals: 2, source: "NSE" }, series("Nifty Bank")),
  ].filter((q): q is MarketQuote => !!q);
}

// ───────────── ECB (Frankfurter) ─────────────

async function usdInr(): Promise<MarketQuote | undefined> {
  const start = ymd(new Date(Date.now() - 50 * 86400e3));
  const r = await fetchText(`https://api.frankfurter.dev/v1/${start}..?base=USD&symbols=INR`, { accept: "application/json", timeoutMs: 20_000 });
  if (!r.ok) throw new Error(`frankfurter ${r.status}`);
  const j = JSON.parse(r.text) as { rates: Record<string, { INR?: number }> };
  const hist = Object.entries(j.rates)
    .filter(([, v]) => typeof v.INR === "number")
    .map(([date, v]) => ({ date, value: v.INR! }));
  return quoteFrom({ id: "usdinr", name: "US dollar", unit: "₹", decimals: 2, source: "European Central Bank" }, hist);
}

// ───────────── IBJA ─────────────

/** IBJA's home page carries its recent daily rates as JSON in hidden inputs. */
export function parseIbja(html: string): { gold: MarketPoint[]; silver: MarketPoint[] } {
  const grab = (name: string) => {
    const m = html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`));
    if (!m) return undefined;
    const txt = m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    try {
      return JSON.parse(txt) as Record<string, unknown[]>;
    } catch {
      return undefined;
    }
  };
  const toPoints = (labels: unknown[] | undefined, values: unknown[] | undefined): MarketPoint[] => {
    if (!labels || !values) return [];
    return labels.flatMap((l, i) => {
      const m = String(l).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const v = Number(values[i]);
      return m && Number.isFinite(v) && v > 0 ? [{ date: `${m[3]}-${m[2]}-${m[1]}`, value: v }] : [];
    });
  };
  const g = grab("HdnGold");
  const s = grab("HdnSilver");
  return { gold: toPoints(g?.labels, g?.purity999), silver: toPoints(s?.labels, s?.silverRate) };
}

async function ibja(): Promise<MarketQuote[]> {
  const r = await fetchText("https://ibjarates.com/", { timeoutMs: 30_000 });
  if (!r.ok) throw new Error(`ibja ${r.status}`);
  const { gold, silver } = parseIbja(r.text);
  return [
    quoteFrom({ id: "gold", name: "Gold 24K", unit: "₹", per: "per 10 g", decimals: 0, source: "IBJA" }, gold),
    quoteFrom({ id: "silver", name: "Silver", unit: "₹", per: "per kg", decimals: 0, source: "IBJA" }, silver),
  ].filter((q): q is MarketQuote => !!q);
}

// ───────────── Coinbase ─────────────

async function bitcoin(): Promise<MarketQuote | undefined> {
  const r = await fetchText("https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400", {
    accept: "application/json",
    timeoutMs: 20_000,
  });
  if (!r.ok) throw new Error(`coinbase ${r.status}`);
  // [time, low, high, open, close, volume], newest first; the newest is today's, still open.
  const rows = JSON.parse(r.text) as number[][];
  const hist = rows.map((c) => ({ date: ymd(new Date(c[0] * 1000)), value: c[4] }));
  return quoteFrom({ id: "bitcoin", name: "Bitcoin", unit: "$", decimals: 0, source: "Coinbase" }, hist);
}

export async function marketsPanel(dataDir: string): Promise<MarketsPanel | undefined> {
  const safe = async <T>(name: string, p: Promise<T>): Promise<T | undefined> => {
    try {
      return await p;
    } catch (e) {
      log(`markets: ${name} failed: ${(e as Error).message}`);
      return undefined;
    }
  };
  const [n, fx, metals, btc] = await Promise.all([
    safe("nse", nse(dataDir)),
    safe("usdinr", usdInr()),
    safe("ibja", ibja()),
    safe("bitcoin", bitcoin()),
  ]);
  const quotes = [...(n ?? []), fx, ...(metals ?? []), btc].filter((q): q is MarketQuote => !!q);
  if (quotes.length === 0) return undefined;
  return { fetchedAt: new Date().toISOString(), quotes };
}
