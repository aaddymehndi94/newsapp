import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeed } from "../pipeline/feeds.ts";
import { findAiTells } from "../pipeline/style.ts";
import { isJunkImage, rankCandidates } from "../pipeline/images.ts";
import { imageSize } from "../pipeline/enrich.ts";
import { cleanSlate } from "../pipeline/editor.ts";
import type { Source } from "../config/sources.ts";
import type { FeedItem } from "../pipeline/feeds.ts";

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

test("every feed's outlet has an owner and a tier; the Times group, Adani's NDTV and Reliance's News18 only corroborate", async () => {
  const { SOURCES, outletInfo } = await import("../config/sources.ts");
  const missing = [...new Set(SOURCES.map((s) => s.outlet))].filter((o) => !outletInfo(o));
  assert.deepEqual(missing, []);
  for (const o of ["The Times of India", "The Economic Times", "Filmfare", "NDTV", "News18"]) assert.equal(outletInfo(o)?.tier, "corroborate", o);
  assert.equal(outletInfo("The Times of India")?.owner, outletInfo("The Economic Times")?.owner);
  assert.equal(outletInfo("Press Trust of India")?.tier, "wire");
  const ids = SOURCES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "feed ids are unique");
  for (const gone of ["toi-india", "ndtv-top", "firstpost-india", "organiser"]) assert.ok(!ids.includes(gone), gone);
});

test("the Kolkata Telegraph is not given the UK Telegraph's label", async () => {
  const { leaningFor } = await import("../config/sources.ts");
  assert.equal(leaningFor("The Telegraph"), "centre-left");
  assert.equal(leaningFor("The Telegraph (UK)"), "centre-right");
  assert.equal(leaningFor("Scroll"), "centre-left");
});

test("robots.txt: article pages also obey rules aimed at Anthropic's agents; feeds don't", async () => {
  const { parseRobots, robotsAllows } = await import("../pipeline/robots.ts");
  const txt = "User-agent: *\nDisallow: /search\n\nUser-agent: Claude-User\nUser-agent: anthropic-ai\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n";
  assert.equal(robotsAllows(parseRobots(txt), "https://ex.com/news/a"), true);
  assert.equal(robotsAllows(parseRobots(txt, { ai: true }), "https://ex.com/news/a"), false);
  // A ban on the training crawler (and its older names) is not a ban on reading a page for a reader.
  assert.equal(robotsAllows(parseRobots("User-agent: ClaudeBot\nUser-agent: anthropic-ai\nUser-agent: Claude-Web\nDisallow: /\n", { ai: true }), "https://ex.com/news/a"), true);
});

test("news sitemaps: titles, Indian times mislabelled as UTC, host rewrite, path and headline filters", async () => {
  const { parseSitemap } = await import("../pipeline/feeds.ts");
  const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url><loc>https://thewirenews.in/politics/delhi-vote-roll</loc><news:news><news:publication_date>2026-11-25T23:13:33+00:00</news:publication_date><news:title><![CDATA[Delhi Voter Roll: 44 Lakh May Be Left Out]]></news:title></news:news></url>
  <url><loc>https://thewirenews.in/sport/cricket-score</loc><news:news><news:publication_date>2026-11-25T20:00:00+00:00</news:publication_date><news:title>Cricket score today</news:title></news:news></url>
  <url><loc>https://thewirenews.in/politics/bihar-cabinet-expansion-today</loc><lastmod>2026-11-25T10:00:00+05:30</lastmod></url>
  </urlset>`;
  const base = { ...src, kind: "sitemap" as const, outlet: "The Wire", host: ["thewirenews.in", "thewire.in"] as [string, string], times: "ist-as-utc" as const, path: /^\/politics\// };
  const { items, children } = parseSitemap(xml, base);
  assert.deepEqual(children, []);
  assert.deepEqual(items.map((i) => [i.title, i.link, i.published]), [
    ["Delhi Voter Roll: 44 Lakh May Be Left Out", "https://thewire.in/politics/delhi-vote-roll", "2026-11-25T17:43:33.000Z"],
    // No news:title: the headline comes from the link's last part.
    ["Bihar cabinet expansion today", "https://thewire.in/politics/bihar-cabinet-expansion-today", "2026-11-25T04:30:00.000Z"],
  ]);
  assert.equal(items[0].summary, "");
  const delhiOnly = parseSitemap(xml, { ...base, match: /\bDelhi\b/ }).items;
  assert.deepEqual(delhiOnly.map((i) => i.title), ["Delhi Voter Roll: 44 Lakh May Be Left Out"]);
  const index = `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc><![CDATA[https://www.ptinews.com/sitemaps/pti-sitemap-2026-11-25.xml]]></loc></sitemap><sitemap><loc>https://www.ptinews.com/sitemaps/pti-sitemap-2026-11-24.xml</loc></sitemap></sitemapindex>`;
  assert.deepEqual(parseSitemap(index, base).children, ["https://www.ptinews.com/sitemaps/pti-sitemap-2026-11-25.xml", "https://www.ptinews.com/sitemaps/pti-sitemap-2026-11-24.xml"]);
});

test("feeds whose times carry no offset are read as Indian time; items carry the outlet's tier and owner", () => {
  const xml = `<rss><channel><item><title>RBI to conduct repo auction on Friday</title><link>https://www.rbi.org.in/a</link><pubDate>Wed, 25 Nov 2026 19:20:00</pubDate></item></channel></rss>`;
  const [it] = parseFeed(xml, { ...src, outlet: "Reserve Bank of India", times: "ist" });
  assert.equal(it.published, "2026-11-25T13:50:00.000Z");
  assert.equal(it.tier, "primary");
  assert.equal(it.owner, "Reserve Bank of India");
  const [toi] = parseFeed(xml, { ...src, outlet: "The Times of India", path: /^\/a$/ });
  assert.equal(toi.tier, "corroborate");
  assert.deepEqual(parseFeed(xml, { ...src, path: /^\/mumbai\// }), []);
});

test("cleanSlate: a story never leads with a corroborate-only outlet, one owner gives at most two items, all-corroborate stories go", () => {
  const it = (outlet: string, tier: string, owner: string) => ({ outlet, tier, owner }) as never;
  const items = new Map([
    ["toi1", it("The Times of India", "corroborate", "Times")],
    ["toi2", it("The Times of India", "corroborate", "Times")],
    ["et1", it("The Economic Times", "corroborate", "Times")],
    ["hindu", it("The Hindu", "core", "Hindu")],
    ["ndtv", it("NDTV", "corroborate", "Adani")],
    ["pti", it("Press Trust of India", "wire", "PTI")],
  ]);
  const pick = (key: string, rank: number, itemIds: string[]) =>
    ({ key, section: "india", rank, lead: false, workingHeadline: "", angle: "", itemIds, contested: false, videoId: "" }) as never;
  const s = cleanSlate({ stories: [pick("a", 1, ["toi1", "toi2", "et1", "hindu"]), pick("b", 2, ["ndtv"]), pick("c", 3, ["pti"])] }, items, new Set());
  assert.deepEqual(s.stories.map((x) => [x.key, x.itemIds.join()]), [["a", "hindu,toi1,toi2"], ["c", "pti"]]);
});

test("budget: items are sampled across the whole window, per owner and section; a corroborate outlet gets 4 per city", async () => {
  const { budgetItems, windowHours } = await import("../pipeline/budget.ts");
  const now = Date.parse("2026-11-26T00:00:00Z");
  const mk = (n: number, o: Partial<FeedItem>) =>
    Array.from({ length: n }, (_, i) => ({ id: `${o.owner}-${o.sectionHint}-${i}`, published: new Date(now - i * 3600_000).toISOString(), tier: "core", region: "india", sectionHint: "india", ...o }) as FeedItem);
  const items = [
    ...mk(40, { owner: "Hindu" }),
    ...mk(20, { owner: "Times", tier: "corroborate", region: "delhi", sectionHint: "delhi" }),
    ...mk(20, { owner: "HT", region: "delhi", sectionHint: "delhi" }),
  ];
  const kept = budgetItems(items);
  const hindu = kept.filter((i) => i.owner === "Hindu");
  assert.equal(hindu.length, 16);
  // Not just the newest 16: the oldest hours of the window are represented too.
  assert.ok(hindu.some((i) => Date.parse(i.published!) <= now - 30 * 3600_000));
  assert.equal(kept.filter((i) => i.owner === "Times").length, 4);
  assert.equal(kept.filter((i) => i.owner === "HT").length, 10);
  // The window reaches back to the last gather (less an hour's overlap), within 26 to 50 hours.
  assert.equal(windowHours(now - 24 * 3600_000, now), 26);
  assert.equal(windowHours(now - 30 * 3600_000, now), 31);
  assert.equal(windowHours(now - 90 * 3600_000, now), 50);
  assert.equal(windowHours(undefined, now), 26);
});

test("a headline-only wire item gets the full text of its word-for-word republication, and the copy leaves the menu", async () => {
  const { linkRepublished } = await import("../pipeline/feeds.ts");
  const base = { tier: "core", region: "india", sectionHint: "india", summary: "" };
  const items = [
    { ...base, id: "p", sourceId: "pti-india", outlet: "Press Trust of India", title: "Allahabad HC adjourns hearing in Saharanpur mosque case till Dec 9", link: "https://www.ptinews.com/story/national/x/1", pages: false },
    { ...base, id: "t", sourceId: "theprint", outlet: "ThePrint", title: "Allahabad HC adjourns hearing in Saharanpur mosque case till Dec 9", link: "https://theprint.in/india/x/2", pages: true },
    { ...base, id: "o", sourceId: "theprint", outlet: "ThePrint", title: "ThePrint's own report on the Delhi voter roll", link: "https://theprint.in/india/y/3", pages: true },
    { ...base, id: "s", sourceId: "pti-india", outlet: "Press Trust of India", title: "Short title", link: "https://www.ptinews.com/story/national/z/4", pages: false },
  ] as FeedItem[];
  const out = linkRepublished(items);
  assert.deepEqual(out.map((i) => [i.id, i.alt ?? ""]), [["p", "https://theprint.in/india/x/2"], ["o", ""], ["s", ""]]);
});

test("coverage search: a focused GDELT query from a headline, known outlets only, and a page must be about the story", async () => {
  const { gdeltQuery, outletForUrl, relevant } = await import("../pipeline/coverage.ts");
  assert.equal(gdeltQuery("Delhi SIR: Nearly 44 lakh voters may remain excluded from final roll as claims phase ends"), '"Delhi" "SIR" "44 lakh" voters excluded final sourcelang:english');
  assert.equal(outletForUrl("https://www.deccanherald.com/india/x"), "Deccan Herald");
  assert.equal(outletForUrl("https://economictimes.indiatimes.com/news/x"), "The Economic Times");
  assert.equal(outletForUrl("https://some-content-farm.example/x"), undefined);
  assert.ok(relevant("Nearly 44 lakh voters in Delhi may be left off the final roll after the SIR claims phase.", "Delhi SIR: 44 lakh voters may be excluded"));
  assert.ok(!relevant("The cricket team won by six wickets in Delhi.", "Delhi SIR: 44 lakh voters may be excluded"));
});
