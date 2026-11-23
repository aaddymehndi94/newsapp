# Good morning — Meridian is live

**Read it here:** https://meridian-news.aadarsh-mehndiratta.workers.dev
(Hidden from Google for now with a `noindex` header and `robots.txt`; anyone with the link can open it.)

## What you'll find

- ~40 stories per edition across India, World, Bengaluru, Business, Science & Tech,
  Health & Environment and Sports. Every story has a picture; about a quarter have a news video.
- Front page: big lead story, three more top stories, then sections. Tap a story, read it, tap
  "Back" (or swipe back) and you land exactly where you were; stories you've read are dimmed, and
  the last one you opened is marked.
- Each article: key facts, the story, background, why it matters, and on politically contested
  stories a short "How it's being framed" box that states each side's position. At the bottom is
  the list of outlets it was built from, each with a leaning label, so you can see the sourcing mix.
- Light/dark toggle (follows your phone by default). "All editions" keeps the archive.

## How it works

Twice a day (cron on this computer: **03:30 → 05:00 edition**, **15:30 → 17:00 edition**):
1. Reads 78 feeds: Indian outlets from left to right (The Hindu, Indian Express, HT, TOI, NDTV,
   Scroll, The Wire, ThePrint, News18, Swarajya, Organiser, Firstpost…), international (BBC, Al Jazeera,
   Guardian, NYT, WSJ, Fox, NPR, DW, France 24, CNA, SCMP, Reuters/AP headlines…), science, tech,
   sport, and Bengaluru city feeds. Also 18 YouTube news channels for video.
2. **Claude Opus 5.5** (editor) groups reports of the same event, picks a balanced slate with
   section quotas, and assigns each story 2–6 sources from different outlets and leanings.
3. **Claude Sonnet 5.5** (writer) writes each story in its own words from those sources, under a
   wire-service style guide. A checker catches AI-sounding phrases ("amid", "underscores", …)
   and sends those stories back for one rewrite.
4. Picture: the best outlet photo, credited and linked, else a free Wikimedia Commons photo.
5. Builds the static site and deploys it to your Cloudflare account (Workers, free plan).

**Keep this laptop on and plugged in.** On AC power it is set to never sleep. If the lid is closed
or it's on battery it may sleep and skip an edition; the site then keeps showing the last one.
Logs: `logs/`.

## Cost so far

- Building and testing overnight: about **$1.70** of Anthropic credit.
- The first scheduled edition (03:30 run, half-price Batch API) cost **$0.69** for 37 stories and
  was live by 03:37. Expect **~$0.70–0.85 per edition, ~$1.40–1.70/day**, so $100 lasts about two
  months. The editor (Opus) is about a quarter of that and the writer the rest. Easy levers if
  you want it cheaper: lower the editor's effort, or trim the number of feeds it reads.
  Each edition's cost is recorded in `data/editions/<id>.json` → `stats.costUsd`.

## Things to know

- **Not included:** X and Instagram (no free access). Reddit refused our requests, so it isn't used either.
- **Headlines only, via Google News:** ThePrint, The Wire, The Quint, Swarajya, The Telegraph and
  Deccan Herald block automated readers or have broken feeds, so we only see their headlines.
  The facts come from outlets we can read.
- **No paywall bypassing**, and the reader respects each site's robots.txt and identifies itself honestly.
- **NDTV photos** can't be embedded on other sites, so we always use another outlet's photo for those stories.
- **Possible refusals:** if Claude declines to write a story (very rare for news), that story is skipped.
- **Thin stories are dropped:** if none of a story's sources can be read (e.g. headline-only), it's
  left out rather than padded. Tonight that cost a Delhi air-quality story and a SEBI one.
- **Source balance, watch this:** the Indian feed pool leans left of centre, so in the first
  scheduled edition 5 of 14 contested stories had no right-of-centre source (e.g. the Bengal
  voter-roll appeals). I tightened the editor's rule so contested stories must get one source
  from each side whenever any feed covers the event, and the log now lists any that still don't.
  If it persists, the next fix is adding more right-of-centre Indian feeds.

## Ideas for next steps (your call)

1. **Your domain**: buy it, tell me, and I'll attach it and remove `noindex` when you're ready.
2. **Run on GitHub instead of this laptop.** You'd create a Cloudflare API token and add 3 repo secrets;
   the instructions are at the top of `.github/workflows/edition.yml`.
3. **"Follow this story"**: link today's article to earlier coverage of the same event.
4. **"Ask about this story"**: a small Q&A box under each article (uses credits per question).
5. Tune anything: section sizes, which outlets, article length, the look.

Just tell me what you liked and what bugged you after reading the first edition.
