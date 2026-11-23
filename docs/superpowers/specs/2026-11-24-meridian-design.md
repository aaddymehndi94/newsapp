# Meridian — balanced daily news, AI-edited

Date: 2026-11-24 · Status: approved in conversation (user asleep; executing overnight)

## Intent

The user reads 6–7 news sites a day (Reuters, BBC, The Hindu, Indian Express …) to get an
unbiased picture. Paywalls, ad clutter and news scattered across social media make that tiring.
Meridian is one calm, ad-free site that, twice a day, reads the news from across the spectrum and
publishes a balanced edition: headlines with pictures, a little extra on the front page, and a
well-written, human-sounding article one tap away. First reader: the user, in Bangalore.

## Goals

- Two editions a day, **05:00 and 17:00 IST**, ~35–40 stories each.
- Balanced by **topic** (India, World, Business, Science & Tech, Sports, Health & Environment,
  Bengaluru) and by **viewpoint** (sources from left, centre and right; neutral articles).
- Every headline has a relevant picture. Video embedded where a news channel has a matching clip.
- Articles read as if written by a good wire-service journalist — not like AI.
- Front page you can skim fast; open a story; come back to exactly where you were; read stories dim.
- Classy look, dark and light themes, works great on a phone.
- Cost visible per edition; ~$1.5/day target on a ~$100 Anthropic credit budget.

## Non-goals (for now)

- Personalisation, recommendations, "for you" feeds, follow-topics. (Anti-goal: echo chamber.)
- Per-story left/centre/right toggles or customisation sprawl.
- Comments, accounts, social features, push notifications.
- X / Instagram ingestion (no free access). Reddit is used only as a "what's trending" signal.
- Bypassing paywalls. We use headlines, summaries and pages that are freely readable.
- Own domain / SEO launch (user buys a domain later; until then `noindex`).

## Anti-goals

- Opinionated or slanted writing; speculation beyond what sources report.
- AI-sounding prose ("amid", "underscores", "a stark reminder", tidy moral endings).
- AI-generated photos of real events.
- Ads, popups, cookie walls, heavy JS.

## Decisions (user)

| Topic | Decision |
|---|---|
| Models | Opus 5.5 = editor (clusters + picks a balanced slate, one call/edition). Sonnet 5.5 = writer (one call/story). "We'll see how the costs come." |
| Hosting | Public Cloudflare workers.dev link, `noindex` until launch on own domain |
| Pictures | Outlet's own og:image, hotlinked (not copied) with credit + link; Wikimedia Commons fallback; typographic card last |
| Politics | Neutral article + short "How it's being framed" box on contested stories only (my default, not objected to) |
| Local | Small Bengaluru section (2–3 stories) |
| Editions | 05:00 / 17:00 IST |

## Approaches considered (how it runs)

1. **Static site + scheduled pipeline (chosen).** A Node script gathers feeds, calls Claude,
   writes edition JSON, renders static HTML, deploys to Cloudflare Workers static assets.
   Fast, free hosting, nothing to break at read time, archive is just files.
2. **All-on-Cloudflare (Worker cron + D1).** Free-plan limits (10 ms CPU, 50 subrequests) make
   a 40-feed / 40-LLM-call pipeline fragile without paid Queues/Workflows. Rejected for now.
3. **Dynamic app (Next.js/SSR).** More moving parts, no reader-visible benefit. Rejected.

Scheduler: tonight a local cron job on this machine (always-on desktop). A GitHub Actions
workflow is included so the user can move scheduling off this machine by adding two secrets.
Cloudflare auth: existing `wrangler login` OAuth on this machine (no Pages scope → Workers static assets).

## Pipeline (per edition)

1. **Gather** — ~60 RSS feeds (Indian + international outlets across the spectrum, science, tech,
   sport, Bengaluru), Google-News RSS for Reuters/AP headlines, Reddit top-of-day (signal only),
   YouTube channel RSS of news channels (video candidates). Keep items from the last ~18 h.
2. **Enrich** — fetch article pages where freely reachable: og:image (+ size), readable text
   (Readability). Respect timeouts; paywalled pages just contribute their RSS summary.
3. **Edit (Opus 5.5)** — given compact list of all items, cluster same-event reports, judge
   importance, and choose the slate with section quotas, plus flag contested stories and pick
   the 3–5 best sources per story spanning outlets/leanings, and a matching YouTube clip if any.
4. **Write (Sonnet 5.5)** — per story, from the source texts: headline, dek, front-page summary,
   body, key facts, background, why it matters, perspectives (contested only), dateline, tags.
   Strict style guide + banned-phrase list; automatic check-and-revise for AI tells.
5. **Pictures** — best og:image among the story's sources (size, not logo), verified reachable;
   else Wikimedia Commons search for the subject; else typographic card.
6. **Publish** — write `data/editions/<id>.json`, render site, deploy, log cost.

Scheduled runs use the Message Batches API (50% off) with a deadline fallback to direct calls.

## Data contract — `data/editions/<id>.json`

```ts
type SectionId = "india" | "world" | "business" | "science-tech" | "sports"
               | "health-environment" | "bengaluru";

interface Edition {
  id: string;              // "2026-11-24-am" | "2026-11-24-pm"
  date: string;            // "2026-11-24" (IST)
  slot: "morning" | "evening";
  publishedAt: string;     // ISO 8601 with offset
  lead: string[];          // story ids for the top of the front page (3–5), most important first
  sections: { id: SectionId; name: string; storyIds: string[] }[];   // in display order
  stories: Story[];
  stats: { feedsScanned: number; itemsSeen: number; pagesRead: number; costUsd: number };
}

interface Story {
  id: string;              // url slug, unique within edition
  section: SectionId;
  rank: number;            // 1 = most important in edition
  headline: string;
  dek: string;             // one-sentence standfirst
  summary: string;         // 2–3 sentences for the front page
  body: string[];          // paragraphs; inline markdown limited to *italic* and [text](url)
  keyFacts: string[];      // 3–5 bullets
  background?: string;     // context paragraph(s), may be ""
  whyItMatters?: string;
  perspectives?: { label: string; summary: string; outlets: string[] }[]; // contested only
  dateline?: string;       // "NEW DELHI"
  developing?: boolean;
  image?: { url: string; credit: string; sourceUrl: string; alt: string;
            width?: number; height?: number; kind: "outlet" | "wikimedia" };
  video?: { youtubeId: string; title: string; channel: string };
  sources: { outlet: string; title: string; url: string;
             leaning?: "left" | "centre-left" | "centre" | "centre-right" | "right" }[];
  tags: string[];
  readingMinutes: number;
}
```

## Site

- `/` latest edition front page · `/e/<id>/` any edition · `/e/<id>/<story>/` article ·
  `/archive/` list of editions.
- Static HTML per page (native back restores scroll; works without JS). Small JS for theme toggle,
  read-state dimming (localStorage), "back to where I was".
- Front page: lead story large, 2–4 secondary leads, then sections with picture cards
  (headline + summary). Section jump bar (anchors, not filters). Edition switcher.
- Article: picture with credit, headline, dek, dateline/time/reading time, key facts, body,
  background, why it matters, framing box, video (click-to-load), sources with leaning marks,
  "next in section" to keep reading without going back.
- Images: `referrerpolicy="no-referrer"`, lazy, `onerror` → typographic fallback.
- `X-Robots-Tag: noindex` + robots.txt disallow until launch.

## Left to the builder

Exact feed URLs (verified live), visual design specifics (fonts, palette, layout details),
prompt wording, section quotas tuning, cost tuning (effort levels, batch).
