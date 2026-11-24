import { test } from "node:test";
import assert from "node:assert/strict";
import { cpcbAqi, last24Mean, latestScan } from "../pipeline/panels/weather.ts";
import { parseIbja, parseNseClose, quoteFrom } from "../pipeline/panels/markets.ts";
import { readmeExcerpt } from "../pipeline/panels/tech.ts";
import { weatherWords } from "../site/templates/panels.ts";
import { PanelsSchema } from "../site/schema.ts";

test("CPCB AQI takes the worse of the PM2.5 and PM10 sub-indices", () => {
  assert.deepEqual(cpcbAqi(15, 20), { value: 25, category: "Good" });
  assert.equal(cpcbAqi(60, 50).value, 100);
  assert.equal(cpcbAqi(60, 50).category, "Satisfactory");
  assert.equal(cpcbAqi(100, 120).category, "Poor");
  assert.equal(cpcbAqi(20, 400).category, "Very poor");
  assert.equal(cpcbAqi(600, 900).value, 500);
});

test("24-hour mean only counts hours up to now and needs enough data", () => {
  const times = Array.from({ length: 48 }, (_, i) => `2026-11-24T${String(i % 24).padStart(2, "0")}:00`).map((t, i) => (i < 24 ? t.replace("24T", "23T") : t));
  const vals = times.map((_, i) => (i < 24 ? 10 : 30));
  assert.equal(last24Mean(times, vals, "2026-11-23T23:30"), 10);
  assert.equal(last24Mean(times, vals, "2026-11-24T11:00"), (12 * 10 + 12 * 30) / 24);
  assert.equal(last24Mean(times, vals.map(() => null), "2026-11-24T11:00"), undefined);
});

test("latest satellite scan comes from the layer's time dimension", () => {
  const caps = `<Layer><Name>msg_iodc:ir108</Name><Dimension name="time" default="current">2020-08-01T00:00:00.000Z/2026-11-24T02:00:00.000Z/PT15M</Dimension></Layer>`;
  assert.equal(latestScan(caps), "2026-11-24T02:00:00.000Z");
  assert.equal(latestScan("<Name>other</Name>"), undefined);
});

test("NSE closing file is parsed by column name", () => {
  const csv = "Index Name,Index Date,Open Index Value,High Index Value,Low Index Value,Closing Index Value,Points Change,Change(%)\nNifty 50,23-11-2026,25929.15,25992.6,25343.85,25349.65,-450.95,-1.75\nNifty Bank,23-11-2026,1,2,3,62585.35,-1,-1\n";
  const m = parseNseClose(csv);
  assert.equal(m.get("Nifty 50"), 25349.65);
  assert.equal(m.get("Nifty Bank"), 62585.35);
  assert.equal(parseNseClose("<html>not found</html>").size, 0);
});

test("IBJA rates come from the page's embedded JSON", () => {
  const html = `<input type="hidden" name="HdnGold" id="HdnGold" value="{&quot;labels&quot;:[&quot;20/11/2026&quot;,&quot;23/11/2026&quot;],&quot;purity999&quot;:[123893,124945],&quot;purity916&quot;:[1,2]}" />`;
  const { gold, silver } = parseIbja(html);
  assert.deepEqual(gold, [
    { date: "2026-11-20", value: 123893 },
    { date: "2026-11-23", value: 124945 },
  ]);
  assert.deepEqual(silver, []);
});

test("a quote is the latest value and its change from the previous one", () => {
  const q = quoteFrom({ id: "x", name: "X", unit: "", decimals: 2, source: "S" }, [
    { date: "2026-11-23", value: 110 },
    { date: "2026-11-20", value: 100 },
    { date: "2026-11-19", value: -5 },
  ])!;
  assert.equal(q.value, 110);
  assert.equal(q.change, 10);
  assert.equal(q.changePct, 10);
  assert.equal(q.asOf, "2026-11-23");
  assert.equal(q.history.length, 2);
  assert.equal(quoteFrom({ id: "x", name: "X", unit: "", decimals: 2, source: "S" }, [{ date: "2026-11-23", value: 1 }]), undefined);
});

test("README excerpts drop front matter, badges, code and markup", () => {
  const md = "---\nlicense: mit\n---\n# Tool\n[![ci](https://x/b.svg)](https://x)\nA **fast** [tool](https://t) for things.\n```sh\nrm -rf /\n```\n<p>More</p>";
  assert.equal(readmeExcerpt(md), "Tool A **fast** tool for things. More");
});

test("weather codes map to words and icons", () => {
  assert.deepEqual(weatherWords(0), { label: "Clear", sky: "clear" });
  assert.equal(weatherWords(81).sky, "rain");
  assert.equal(weatherWords(95).label, "Thunderstorms");
  assert.equal(weatherWords(1234).label, "Mixed");
});

test("panel schema drops bad rows and unsafe links instead of failing", () => {
  const p = PanelsSchema.parse({
    tech: {
      fetchedAt: "2026-11-24T00:00:00Z",
      repos: [
        { name: "a/b", url: "javascript:alert(1)", stars: 1, createdAt: "x", what: "w" },
        { name: "c/d", url: "https://github.com/c/d", stars: 5, createdAt: "x", what: "w" },
      ],
      models: [],
      tools: [],
    },
    markets: { nope: true },
  });
  assert.equal(p.tech?.repos.length, 1);
  assert.equal(p.tech?.repos[0].name, "c/d");
  assert.equal(p.markets, undefined);
});
