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

test("batch custom ids satisfy the API pattern", async () => {
  const { storyCustomId } = await import("../pipeline/writer.ts");
  for (const key of ["india-nepal-package", "x".repeat(80), "a-b_c"]) assert.match(storyCustomId(key), /^[a-zA-Z0-9_-]{1,64}$/);
});

test("pictures from hosts that block embedding are never chosen", () => {
  assert.ok(isJunkImage("https://c.ndtvimg.com/2026-11/abc.jpg"));
});
