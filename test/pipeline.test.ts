import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeed } from "../pipeline/feeds.ts";
import { findAiTells } from "../pipeline/style.ts";
import { isJunkImage, rankCandidates } from "../pipeline/images.ts";
import { imageSize } from "../pipeline/enrich.ts";
import { cleanSlate } from "../pipeline/editor.ts";
import type { Source } from "../config/sources.ts";

const src: Source = { id: "t", outlet: "Test Times", url: "x", region: "india", section: "india", leaning: "centre" };

test("parseFeed: RSS 2.0 with media:content picks widest image, strips html, drops linkless", () => {
  const xml = `<?xml version="1.0"?><rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
  <item><title>Monsoon &amp; floods hit Assam</title><link>https://ex.com/a</link>
    <description><![CDATA[<p>Heavy <b>rain</b> fell.</p>]]></description><pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate>
    <media:content url="https://ex.com/s.jpg" width="300" medium="image"/><media:content url="https://ex.com/l.jpg" width="1200" medium="image"/></item>
  <item><title>No link here</title></item></channel></rss>`;
  const items = parseFeed(xml, src);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Monsoon & floods hit Assam");
  assert.equal(items[0].summary, "Heavy rain fell.");
  assert.equal(items[0].image, "https://ex.com/l.jpg");
  assert.equal(items[0].published, "2026-11-23T10:00:00.000Z");
});

test("parseFeed: Atom and RDF", () => {
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom story here today</title><link rel="alternate" href="https://ex.com/atom"/><updated>2026-11-23T10:00:00Z</updated><summary>Sum</summary></entry></feed>`;
  assert.equal(parseFeed(atom, src)[0].link, "https://ex.com/atom");
  const rdf = `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/"><item><title>RDF story</title><link>https://ex.com/rdf</link></item></rdf:RDF>`;
  assert.equal(parseFeed(rdf, src)[0].link, "https://ex.com/rdf");
  assert.deepEqual(parseFeed("not xml at all <<<", src), []);
});

test("parseFeed: Google News strips outlet suffix and summary", () => {
  const xml = `<rss><channel><item><title>Rupee rises on inflows - Reuters</title><link>https://news.google.com/rss/articles/x</link><description>&lt;a&gt;junk&lt;/a&gt;</description><source url="https://reuters.com">Reuters</source></item></channel></rss>`;
  const [it] = parseFeed(xml, { ...src, outlet: "Google News — World", kind: "gnews" });
  assert.equal(it.leaning, "centre");
  const [site] = parseFeed(xml.replace(/Reuters/g, "TheWire.in"), { ...src, outlet: "The Wire", leaning: "left", kind: "gnews" });
  assert.equal(site.outlet, "The Wire");
  assert.equal(it.title, "Rupee rises on inflows");
  assert.equal(it.outlet, "Reuters");
  assert.equal(it.summary, "");
});

test("findAiTells flags machine-ish phrasing, passes wire copy, ignores quotes", () => {
  assert.ok(findAiTells("The decision comes amid rising prices.").includes("amid"));
  assert.ok(findAiTells("This underscores the need for reform.").includes("underscores"));
  assert.ok(findAiTells("It was a stark reminder of the risks.").includes("a stark reminder"));
  assert.ok(findAiTells("It remains to be seen whether talks resume.").includes("it remains to be seen"));
  assert.ok(findAiTells("A — b — c in one paragraph.").includes("multiple em dashes in one paragraph"));
  assert.ok(findAiTells("This is not just a policy change, but a shift.").includes("not just X, but Y"));
  const clean = "Police in Bengaluru arrested two men on Monday after a fire at a warehouse in Peenya killed three workers, officials said.\nThe fire broke out at about 2 a.m.";
  assert.deepEqual(findAiTells(clean), []);
  assert.deepEqual(findAiTells('The minister said the bill was "historic".'), []);
});

test("image ranking drops logos and prefers og/wider", () => {
  assert.ok(isJunkImage("https://ex.com/static/logo.png"));
  assert.ok(isJunkImage("https://ex.com/images/default-share.jpg"));
  assert.ok(!isJunkImage("https://ex.com/2026/11/23/flood-assam.jpg"));
  const r = rankCandidates([
    { url: "https://ex.com/rss.jpg", outlet: "A", sourceUrl: "u", from: "rss" },
    { url: "https://ex.com/logo.png", outlet: "B", sourceUrl: "u", from: "og" },
    { url: "https://ex.com/og.jpg", outlet: "C", sourceUrl: "u", from: "og" },
    { url: "https://ex.com/og.jpg", outlet: "C", sourceUrl: "u", from: "og" },
  ]);
  assert.deepEqual(r.map((c) => c.url), ["https://ex.com/og.jpg", "https://ex.com/rss.jpg"]);
});

test("imageSize reads PNG and JPEG headers", () => {
  const png = new Uint8Array(32);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(png.buffer).setUint32(16, 1200);
  new DataView(png.buffer).setUint32(20, 675);
  assert.deepEqual(imageSize(png), { width: 1200, height: 675 });
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0x02, 0xa3, 0x04, 0xb0, 3]);
  assert.deepEqual(imageSize(jpg), { width: 1200, height: 675 });
});

test("cleanSlate removes unknown ids, dedupes items across stories, renumbers, fixes leads", () => {
  const items = new Map([["a", {} as never], ["b", {} as never], ["c", {} as never]]);
  const s = cleanSlate(
    {
      stories: [
        { key: "x", section: "india", rank: 2, lead: false, workingHeadline: "", angle: "", itemIds: ["a", "zzz"], contested: false, videoId: "v:nope" },
        { key: "y", section: "world", rank: 1, lead: true, workingHeadline: "", angle: "", itemIds: ["b", "a"], contested: true, videoId: "" },
        { key: "z", section: "india", rank: 3, lead: false, workingHeadline: "", angle: "", itemIds: ["zzz"], contested: false, videoId: "" },
      ],
    },
    items,
    new Set(),
  );
  // y (rank 1) claims b and a; x then has no unused known items; z has none at all.
  assert.deepEqual(s.stories.map((x) => [x.key, x.rank, x.itemIds.join(), x.lead, x.videoId]), [["y", 1, "b,a", true, ""]]);
});

test("cleanSlate never makes a city story a lead, even when marked or needed to fill", () => {
  const items = new Map(["a", "b", "c", "d", "e"].map((k) => [k, {} as never]));
  const pick = (key: string, section: string, rank: number, lead: boolean, id: string) =>
    ({ key, section, rank, lead, workingHeadline: "", angle: "", itemIds: [id], contested: false, videoId: "" }) as never;
  const s = cleanSlate(
    {
      stories: [
        pick("delhi-metro", "delhi", 1, true, "a"),
        pick("kochi-port", "kochi", 2, false, "b"),
        pick("budget", "india", 3, true, "c"),
        pick("summit", "world", 4, false, "d"),
        pick("rates", "business", 5, false, "e"),
      ],
    },
    items,
    new Set(),
  );
  const leads = s.stories.filter((x) => x.lead).map((x) => x.key);
  assert.deepEqual(leads, ["budget", "summit", "rates"]);
  assert.ok(s.stories.some((x) => x.key === "delhi-metro"), "the city story is kept, just not as a lead");
});

test("batch custom ids satisfy the API pattern", async () => {
  const { storyCustomId } = await import("../pipeline/writer.ts");
  for (const key of ["india-nepal-package", "x".repeat(80), "a-b_c"]) assert.match(storyCustomId(key), /^[a-zA-Z0-9_-]{1,64}$/);
});

test("pictures from hosts that block embedding are never chosen", () => {
  assert.ok(isJunkImage("https://c.ndtvimg.com/2026-11/abc.jpg"));
});

test("feed hardening: bad entities, lowercase pubdate, dedupe keeps real query params", async () => {
  const { decodeEntities } = await import("../pipeline/util.ts");
  const { dedupeKey } = await import("../pipeline/feeds.ts");
  assert.equal(decodeEntities("a &#99999999; b &#x110000; c"), "a &#99999999; b &#x110000; c");
  const xml = `<rss><channel><item><title>Lowercase date tag story</title><link>https://ex.com/z</link><pubdate>Mon, 23 Nov 2026 10:00:00 +0530</pubdate></item></channel></rss>`;
  assert.equal(parseFeed(xml, src)[0].published, "2026-11-23T04:30:00.000Z");
  assert.notEqual(dedupeKey("https://pib.gov.in/P.aspx?PRID=1"), dedupeKey("https://pib.gov.in/P.aspx?PRID=2"));
  assert.equal(dedupeKey("https://ex.com/a?utm_source=x&at_medium=rss#top"), "https://ex.com/a");
});

test("style check: word boundaries and single quotes", () => {
  assert.deepEqual(findAiTells("Farm incomes as reported by the survey rose 4%. The outcomes as listed were mixed."), []);
  assert.deepEqual(findAiTells("He called the ruling ‘unprecedented’ and asked ‘why now?’ in a speech."), []);
  assert.ok(findAiTells("The ruling comes as farmers protest.").includes("comes as"));
  assert.ok(findAiTells("It was unprecedented.").includes("unprecedented"));
});

test("robots.txt: Google News bars /rss/ for every reader; an allowed path and our own agent's group work", async () => {
  const { parseRobots, robotsAllows } = await import("../pipeline/robots.ts");
  const google = "User-agent: *\nDisallow: /\nAllow: /$\nAllow: /topics/\n\nUser-agent: Googlebot\nDisallow: /\n";
  const rules = parseRobots(google);
  assert.equal(robotsAllows(rules, "https://news.google.com/rss/search?q=india"), false);
  const site = parseRobots("User-agent: *\nDisallow: /search\n\nUser-agent: MeasuredEditionReader\nDisallow: /private/\n");
  assert.equal(robotsAllows(site, "https://ex.com/feed/"), true);
  assert.equal(robotsAllows(site, "https://ex.com/search?q=x"), false);
  assert.equal(robotsAllows(site, "https://ex.com/private/a"), false);
});

test("no source is fetched from a site whose robots.txt we know bars it", async () => {
  const { SOURCES } = await import("../config/sources.ts");
  const barred = SOURCES.filter((s) => /^https:\/\/news\.google\.com\//.test(s.url) || /reddit\.com\//.test(s.url));
  assert.deepEqual(barred.map((s) => s.id), []);
});
