// node --test 'site/**/*.test.ts'   (Node 24 does not expand a bare directory)
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { buildSite } from "./build.ts";
import { inline, placeName, usableImageUrl } from "./templates/helpers.ts";
import type { Story } from "./types.ts";
import { HEAD_SCRIPT } from "./templates/layout.ts";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const EVIL = `<script>alert("x")</script> & "quotes"`;

let tmp: string;
let dataDir: string;
let outDir: string;
let evilStoryPath: string;

async function htmlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}

before(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), "meridian-build-"));
  dataDir = path.join(tmp, "data");
  outDir = path.join(tmp, "dist");
  await mkdir(dataDir);
  for (const name of await readdir(FIXTURES)) {
    if (!name.endsWith(".json")) continue;
    const ed = JSON.parse(await readFile(path.join(FIXTURES, name), "utf8"));
    if (ed.id === "2026-11-24-am") {
      // Untrusted text must come out escaped, and unsafe links must not become links.
      const story = ed.stories[0];
      story.headline = EVIL;
      story.body[0] = `Before [click](javascript:alert(1)) and *ok* and [fine](https://example.com/a?b=1&c=2) ${EVIL}`;
      evilStoryPath = path.join("e", ed.id, story.id, "index.html");
      // A Delhi story, wrongly listed as a lead: it must stay in the city section.
      const delhi = { ...ed.stories.find((x: Story) => x.section === "bengaluru"), id: "delhi-test-story", section: "delhi", rank: 1, headline: "Delhi test story" };
      ed.stories.push(delhi);
      ed.sections.push({ id: "delhi", name: "Delhi", storyIds: [] });
      ed.lead = [delhi.id, ...ed.lead];
    }
    await writeFile(path.join(dataDir, name), JSON.stringify(ed));
  }
  await buildSite({ dataDir, outDir, quiet: true });
});

after(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("buildSite", () => {
  it("writes the expected pages and files", async () => {
    const expected = [
      "index.html",
      "404.html",
      "robots.txt",
      "_headers",
      "archive/index.html",
      "e/2026-11-23-pm/index.html",
      "e/2026-11-24-am/index.html",
      "e/2026-11-23-pm/rbi-holds-repo-rate/index.html",
      evilStoryPath,
    ];
    for (const rel of expected) {
      await assert.doesNotReject(readFile(path.join(outDir, rel)), `missing ${rel}`);
    }
    const assets = await readdir(path.join(outDir, "assets"));
    assert.ok(assets.some((f) => /^site\.[0-9a-f]{10}\.css$/.test(f)), "hashed css");
    assert.ok(assets.some((f) => /^site\.[0-9a-f]{10}\.js$/.test(f)), "hashed js");
    const fonts = await readdir(path.join(outDir, "assets", "fonts"));
    assert.ok(fonts.includes("source-serif-4-latin.woff2"));
    // One article page per story in each edition.
    for (const id of ["2026-11-23-pm", "2026-11-24-am"]) {
      const ed = JSON.parse(await readFile(path.join(FIXTURES, `${id}.json`), "utf8"));
      for (const s of ed.stories) {
        await assert.doesNotReject(readFile(path.join(outDir, "e", id, s.id, "index.html")), `missing ${id}/${s.id}`);
      }
    }
  });

  it("serves the latest edition at the root", async () => {
    const root = await readFile(path.join(outDir, "index.html"), "utf8");
    assert.match(root, /data-edition="2026-11-24-am"/);
  });

  it("escapes untrusted text and drops unsafe links", async () => {
    for (const rel of [evilStoryPath, "e/2026-11-24-am/index.html", "index.html"]) {
      const html = await readFile(path.join(outDir, rel), "utf8");
      assert.ok(!html.includes(`<script>alert("x")</script>`), `${rel} contains raw <script>`);
      assert.ok(html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;quotes&quot;"), `${rel} lacks escaped headline`);
      assert.ok(!/href="\s*javascript:/i.test(html), `${rel} has a javascript: link`);
    }
    const article = await readFile(path.join(outDir, evilStoryPath), "utf8");
    assert.match(article, /<em>ok<\/em>/);
    assert.match(article, /<a href="https:\/\/example\.com\/a\?b=1&amp;c=2"/);
    // Only the known inline head script and the external script are present.
    const scripts = article.match(/<script\b[^>]*>/g) ?? [];
    assert.equal(scripts.length, 2);
  });

  it("gives every <img> referrerpolicy=no-referrer, decoding and dimensions", async () => {
    let count = 0;
    for (const file of await htmlFiles(outDir)) {
      const html = await readFile(file, "utf8");
      for (const tag of html.match(/<img\b[^>]*>/g) ?? []) {
        count++;
        assert.match(tag, /referrerpolicy="no-referrer"/, `${path.relative(outDir, file)}: ${tag}`);
        assert.match(tag, /decoding="async"/, tag);
        assert.match(tag, /width="\d+" height="\d+"/, tag);
      }
    }
    assert.ok(count > 50, `expected many images, saw ${count}`);
  });

  it("emits noindex headers, robots.txt and a CSP that allows the inline head script", async () => {
    const headers = await readFile(path.join(outDir, "_headers"), "utf8");
    assert.match(headers, /X-Robots-Tag: noindex, nofollow/);
    const hash = createHash("sha256").update(HEAD_SCRIPT).digest("base64");
    assert.ok(headers.includes(`'sha256-${hash}'`), "CSP hash matches head script");
    assert.match(headers, /\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
    const robots = await readFile(path.join(outDir, "robots.txt"), "utf8");
    assert.match(robots, /Disallow: \//);
    const page = await readFile(path.join(outDir, "index.html"), "utf8");
    assert.ok(page.includes(`<script>${HEAD_SCRIPT}</script>`));
  });

  it("gathers every city into one section with a picker, and keeps city stories out of Top stories", async () => {
    const html = await readFile(path.join(outDir, "index.html"), "utf8");
    assert.equal((html.match(/<section class="section" id="city"/g) ?? []).length, 1);
    assert.doesNotMatch(html, /id="bengaluru"/);
    assert.match(html, /<a class="tab[^"]*" href="#city"/);
    const order = [...html.matchAll(/class="city-group" data-city="([a-z]+)"/g)].map((m) => m[1]);
    assert.deepEqual(order, ["bengaluru", "chennai", "delhi", "hyderabad", "kochi", "kolkata", "mumbai"]);
    const picks = [...html.matchAll(/data-pick="([a-z]+)"/g)].map((m) => m[1]);
    assert.deepEqual(picks, order);
    const group = (c: string) => html.split(`data-city="${c}"`)[1].split('class="city-group"')[0];
    assert.ok(group("delhi").includes("/delhi-test-story/"), "the Delhi story sits in the Delhi group");
    assert.ok(group("bengaluru").includes("/namma-metro-pink-line-opening-date/"));
    assert.match(group("chennai"), /No Chennai stories in this edition/);
    const top = html.split('id="top-stories"')[1].split("</section>")[0];
    assert.ok(!top.includes("delhi-test-story"), "a city story never leads the edition");
  });

  it("keeps fixture builds out of search and the sitemap", async () => {
    const page = await readFile(path.join(outDir, "index.html"), "utf8");
    assert.match(page, /<meta name="robots" content="noindex, nofollow">/);
    await assert.rejects(readFile(path.join(outDir, "sitemap.xml")));
    // Test builds are never counted as readers.
    assert.doesNotMatch(page, /cloudflareinsights/);
    assert.doesNotMatch(await readFile(path.join(outDir, "_headers"), "utf8"), /cloudflareinsights/);
  });

  it("opens a real edition build to search, with canonical links and a sitemap", async () => {
    const realData = path.join(tmp, "real-data");
    const realOut = path.join(tmp, "real-dist");
    await mkdir(realData);
    let latest: { id: string; stories: { id: string }[] } | undefined;
    for (const name of await readdir(FIXTURES)) {
      if (!name.endsWith(".json")) continue;
      const ed = JSON.parse(await readFile(path.join(FIXTURES, name), "utf8"));
      delete ed.fixture;
      if (!latest || ed.id > latest.id) latest = ed;
      await writeFile(path.join(realData, name), JSON.stringify(ed));
    }
    await buildSite({ dataDir: realData, outDir: realOut, quiet: true });
    const ORIGIN = "https://measurededition.com";
    const story = latest!.stories[0];

    const headers = await readFile(path.join(realOut, "_headers"), "utf8");
    assert.doesNotMatch(headers, /X-Robots-Tag/);
    const robots = await readFile(path.join(realOut, "robots.txt"), "utf8");
    assert.doesNotMatch(robots, /Disallow: \//);
    assert.match(robots, new RegExp(`Sitemap: ${ORIGIN}/sitemap.xml`));

    const front = await readFile(path.join(realOut, "index.html"), "utf8");
    assert.doesNotMatch(front, /name="robots"/);
    assert.ok(front.includes(`<link rel="canonical" href="${ORIGIN}/">`), "front page names / as canonical");
    const article = await readFile(path.join(realOut, "e", latest!.id, story.id, "index.html"), "utf8");
    assert.ok(article.includes(`<link rel="canonical" href="${ORIGIN}/e/${latest!.id}/${story.id}/">`));
    // Cloudflare injects its Web Analytics beacon at the edge (any versioned path on its host), so
    // our pages carry no tag of their own (it would count visits twice) and the policy allows it.
    assert.doesNotMatch(front, /cloudflareinsights/);
    const csp = headers.split("\n").find((l) => l.includes("Content-Security-Policy")) ?? "";
    assert.match(csp, /script-src [^;]*https:\/\/static\.cloudflareinsights\.com[ ;]/);
    assert.match(csp, /connect-src [^;]*https:\/\/cloudflareinsights\.com[ ;]/);
    const notFound = await readFile(path.join(realOut, "404.html"), "utf8");
    assert.match(notFound, /<meta name="robots" content="noindex">/);
    assert.doesNotMatch(notFound, /rel="canonical"/);

    const sitemap = await readFile(path.join(realOut, "sitemap.xml"), "utf8");
    for (const p of ["/", "/archive/", `/e/${latest!.id}/${story.id}/`]) {
      assert.ok(sitemap.includes(`<loc>${ORIGIN}${p}</loc>`), `sitemap lists ${p}`);
    }
  });

  it("labels fixture builds as invented on every page", async () => {
    for (const f of await htmlFiles(outDir)) {
      assert.ok((await readFile(f, "utf8")).includes(`class="sample-banner"`), `${f} lacks the sample banner`);
    }
  });

  it("does not repeat a lead story inside its section on the front page", async () => {
    const html = await readFile(path.join(outDir, "e/2026-11-23-pm/index.html"), "utf8");
    const ids = [...html.matchAll(/<article [^>]*id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, "duplicate story cards");
    assert.equal(ids.length, 20);
  });
});

describe("inline markdown", () => {
  it("allows only italics and http(s) links", () => {
    assert.equal(
      inline(`a *b* [c](https://x.org/?q=1&r=2) [d](javascript:void0) <e>`),
      `a <em>b</em> <a href="https://x.org/?q=1&amp;r=2" target="_blank" rel="noopener noreferrer nofollow">c</a> d &lt;e&gt;`,
    );
  });
});

describe("pictures and places", () => {
  const story = (url: string) => ({ image: { url, credit: "", sourceUrl: "", alt: "", kind: "outlet" } }) as unknown as Story;
  it("treats hotlink-blocking hosts and non-http URLs as missing", () => {
    assert.equal(usableImageUrl(story("https://c.ndtvimg.com/a.jpg")), null);
    assert.equal(usableImageUrl(story("javascript:alert(1)")), null);
    assert.equal(usableImageUrl(story("https://upload.wikimedia.org/a.jpg")), "https://upload.wikimedia.org/a.jpg");
  });
  it("title-cases all-caps datelines and leaves mixed case alone", () => {
    assert.equal(placeName("NEW DELHI"), "New Delhi");
    assert.equal(placeName("THIRUVANANTHAPURAM, "), "Thiruvananthapuram");
    assert.equal(placeName("Port-au-Prince"), "Port-au-Prince");
  });
});

it("renders data panels in their own sections, even with no stories there", async () => {
  const { frontLayout, renderFront } = await import("./templates/front.ts");
  const { parseEdition } = await import("./schema.ts");
  const raw = JSON.parse(await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/2026-11-24-am.json"), "utf8"));
  raw.panels = {
    markets: {
      fetchedAt: "2026-11-24T02:00:00Z",
      quotes: [{ id: "nifty50", name: "Nifty 50", unit: "", decimals: 2, value: 25349.65, change: -450.95, changePct: -1.75, asOf: "2026-11-23", history: [{ date: "2026-11-20", value: 25800.6 }, { date: "2026-11-21", value: 25700 }, { date: "2026-11-23", value: 25349.65 }], source: "NSE" }],
    },
  };
  const ed = parseEdition(raw, "t").edition!;
  const ids = frontLayout(ed).sections.map((s) => s.id);
  assert.ok(ids.includes("markets"), ids.join(","));
  if (ids.includes("business")) assert.ok(ids.indexOf("markets") > ids.indexOf("business"));
  const html = renderFront(ed, { editions: [ed], latest: ed, sample: true, css: "/a.css", js: "/a.js", fontPreloads: [] });
  assert.match(html, /id="markets"/);
  assert.match(html, /25,349\.65/);
  assert.match(html, /\u2212450\.95/);
  assert.match(html, /data-jump="markets"/);
});
