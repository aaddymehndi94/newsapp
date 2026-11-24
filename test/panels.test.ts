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

test("Google Finance pages yield the live value plus daily closes", async () => {
  const { parseGoogleFinance } = await import("../pipeline/panels/markets.ts");
  const html =
    `<script>AF_initDataCallback({key: 'ds:2', data:[[[["/m/x",["SENSEX","INDEXBOM"],"BSE SENSEX",1,null,[82435.99,-1483.7,-1.77,2,2,2],null,83919.71,null,null,null,[1795428146],"Asia/Calcutta",19800]]]]});</script>` +
    `<script>AF_initDataCallback({key: 'ds:11', data:[[[["SENSEX","INDEXBOM"],null,[[[1],[` +
    Array.from({ length: 12 }, (_, i) => `[[2026,11,${i + 1},16,null,null,null,[19800]],[${80000 + i},0,0]]`).join(",") +
    `]]]]]]});</script>`;
  const h = parseGoogleFinance(html, "SENSEX", "INDEXBOM");
  assert.equal(h.length, 13);
  assert.deepEqual(h.at(-1), { date: "2026-11-23", value: 82435.99 });
  assert.deepEqual(h[0], { date: "2026-11-01", value: 80000 });
});

test("Wikipedia film tables carry month and day down the rows and skip red links", async () => {
  const { parseWikiFilms } = await import("../pipeline/panels/culture.ts");
  const html = `<table class="wikitable"><tr><th>Opening</th><th>Title</th></tr>
<tr><td rowspan="3"><b>N<br />O<br />V</b></td><td rowspan="2"><b>20</b></td><td><i><a href="/wiki/Pratap" title="Pratap">Pratap</a></i></td></tr>
<tr><td><i><a href="/w/index.php?title=Nobody&amp;action=edit&amp;redlink=1" class="new">Nobody</a></i></td></tr>
<tr><td><b>27</b></td><td><i><a href="/wiki/Gunmaaster_G9">Gunmaaster G9</a></i></td></tr></table>`;
  assert.deepEqual(parseWikiFilms(html, 2026, "Hindi"), [
    { title: "Pratap", date: "2026-11-20", url: "https://en.wikipedia.org/wiki/Pratap", language: "Hindi" },
    { title: "Gunmaaster G9", date: "2026-11-27", url: "https://en.wikipedia.org/wiki/Gunmaaster_G9", language: "Hindi" },
  ]);
});

test("films: only ones people are reading about, biggest first; upcoming in date order", async () => {
  const { rankFilms } = await import("../pipeline/panels/culture.ts");
  const f = (title: string, date: string) => ({ title, date, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`, language: "Hollywood" });
  const films = [f("Small Film", "2026-11-20"), f("Big Film", "2026-11-13"), f("Bigger Film", "2026-11-20"), f("Old Film", "2026-09-01"), f("Later Film", "2026-12-18"), f("Sooner Film", "2026-11-27"), f("Far Film", "2027-03-01"), f("Café Film", "2026-12-04")];
  const views = new Map([["Big_Film", 50_000], ["Bigger_Film", 200_000], ["Old_Film", 90_000], ["Later_Film", 120_000], ["Sooner_Film", 20_000], ["Far_Film", 300_000], ["Café_Film", 10_000]]);
  const { now, soon } = rankFilms(films, views, "2026-11-24");
  assert.deepEqual(now.map((m) => m.title), ["Bigger Film", "Big Film"]);
  assert.deepEqual(soon.map((m) => m.title), ["Sooner Film", "Café Film", "Later Film"]);
});

test("film posters come from the infobox and trailers from Wikidata's YouTube IDs", async () => {
  const { parseInfoboxPoster, parseWikidataTrailer } = await import("../pipeline/panels/culture.ts");
  const page = `<style>.infobox-image{}</style><table class="infobox vevent"><tr><td colspan="2" class="infobox-image"><span><a href="/wiki/File:X.jpg"><img src="//thumb.wikimedia.org/wikipedia/en/thumb/4/48/X_%28poster%29.jpg/250px-X_%28poster%29.jpg?utm_source=en.wikipedia.org" width="250"></a></span></td></tr></table>`;
  assert.equal(parseInfoboxPoster(page), "https://thumb.wikimedia.org/wikipedia/en/thumb/4/48/X_%28poster%29.jpg/250px-X_%28poster%29.jpg");
  assert.equal(parseInfoboxPoster("<p>no infobox</p>"), undefined);
  const st = (id: string, text: string) => `<div id="Q1$x" class="wikibase-statementview wb-normal"><a href="https://www.youtube.com/watch?v=${id}">${id}</a> ${text}</div>`;
  const item = `<div class="wikibase-statementgroupview" id="P1651" data-property-id="P1651">` +
    st("aZXBFirj6b4", "subject named as Now in Production language of work or name English") +
    st("3_9vCamtuPY", "object of statement has role teaser trailer language of work or name English number of viewers/listeners 9,000,000") +
    st("NdvqHc56lE0", "object of statement has role trailer language of work or name English number of viewers/listeners 14,393,259") +
    st("5jEeTPYVBsY", "object of statement has role trailer language of work or name English number of viewers/listeners 700,774") +
    `</div><div class="wikibase-statementgroupview" id="P2047"><a href="https://www.youtube.com/watch?v=zzzzzzzzzzz">x</a> trailer</div>`;
  assert.equal(parseWikidataTrailer(item, "English"), "NdvqHc56lE0");
  assert.equal(parseWikidataTrailer(`<div class="wikibase-statementgroupview" id="P1651">${st("aZXBFirj6b4", "Now in Production")}</div>`), undefined);
});

test("GitHub repos: fast risers only, with forks, fastest first", async () => {
  const { vetRepos } = await import("../pipeline/panels/tech.ts");
  const now = Date.parse("2026-11-24T00:00:00Z");
  const r = (name: string, stars: number, forks: number, daysOld: number, extra = {}) => ({
    full_name: name, html_url: `https://github.com/${name}`, description: "d", stargazers_count: stars, forks_count: forks, language: null,
    created_at: new Date(now - daysOld * 86400e3).toISOString(), fork: false, archived: false, ...extra,
  });
  const out = vetRepos([
    r("a/steady", 3000, 200, 20), // 150 a day
    r("b/rocket", 1200, 90, 2), // 600 a day
    r("c/slow", 900, 50, 25), // 36 a day: too slow
    r("d/small", 250, 30, 1), // under 300 stars
    r("e/farmed", 8000, 10, 4), // no forks to speak of
    r("f/fork", 5000, 400, 3, { fork: true }),
    r("b/rocket", 1200, 90, 2), // listed by both searches
  ], now);
  assert.deepEqual(out.map((x) => [x.full_name, x.perDay]), [["b/rocket", 600], ["a/steady", 150]]);
});
