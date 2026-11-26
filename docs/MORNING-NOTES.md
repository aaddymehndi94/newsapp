# Good morning — Measured Edition is live

**Read it here:** https://measurededition.com
(Open to Google and other search engines, with a sitemap at /sitemap.xml.)

## What you'll find

- About 70 stories per edition across India, World, your city, Weather, Business, Markets,
  AI & Software, Science & Tech, Health & Environment, Entertainment and Sports. The city section
  covers Bengaluru, Chennai, Delhi, Hyderabad, Kochi, Kolkata and Mumbai: pick yours once and the
  site remembers it. Every story has a picture; about a quarter have a news video.
- Front page: big lead story, three more top stories, then sections. Tap a story, read it, tap
  "Back" (or swipe back) and you land exactly where you were; stories you've read are dimmed, and
  the last one you opened is marked.
- Each article: key facts, the story, background, why it matters, and on politically contested
  stories a short "How it's being framed" box that states each side's position. At the bottom is
  the list of outlets it was built from, each with a leaning label, so you can see the sourcing mix.
- Light/dark toggle (follows your phone by default). "All editions" keeps the archive.

## How it works

Once a day (owner's choice from 2026-11-24). **GitHub Actions makes it, starting at 03:37 IST** (with 04:17 and 04:57 as back-up start times, since GitHub can start late). Nothing runs on your laptop:
1. Reads ~150 feeds and news sitemaps back to the previous edition (26–50 hours): PTI's wire,
   The Hindu, Indian Express, HT, Mint, Business Standard, ThePrint, The Wire, The Quint, Scroll,
   The News Minute, Frontline, BBC India, courts (LiveLaw, Bar & Bench), fact-checkers (Alt News,
   BOOM, Factly), the RBI, Down To Earth; international (BBC, Al Jazeera, Guardian, NYT, WSJ, Fox,
   NPR, DW, France 24, SCMP, The Diplomat…), science, tech, sport; and each city's own papers
   (Deccan Herald, South First, Citizen Matters, DT Next, Onmanorama, Mathrubhumi, Mid-Day, Free
   Press Journal, NIE…). Each outlet has an owner and a tier: the Times group, NDTV (Adani), News18
   (Reliance), Fox and the NY Post only corroborate, never lead a story; TOI shows at most 4 items
   per city. Each owner gets a budget per section, sampled across the whole window. Also 18 YouTube news channels for video, read through the YouTube Data API only when YOUTUBE_API_KEY is set (YouTube's robots.txt disallows its channel feeds).
2. Code groups reports of the same event; **Claude Opus 5.5** (editor) scores each candidate story
   (consequence, effect on India, newness, public interest) and assigns 2–6 sources from different
   outlets and leanings. Code then chooses about 68 stories: best scores first, each section within
   its range, at most two per running story, at least two court or rights stories (one from beyond
   the big cities), no outlet first on more than ~15%. Unused candidates stand by as reserves for
   stories that turn out too thin. On Sundays the editor runs twice to measure how stable it is.
3. **Claude Sonnet 5.5** (writer) writes each story in its own words from those sources, with our
   own earlier stories and Wikipedia's opening paragraphs for who's who. Short first paragraph, why
   it matters in the second, "The story so far" on running stories, "What's next". Checks send
   stories back for one rewrite (at most 25 a day) when they sound machine-written, talk about
   their sources, copy wording or crowd figures. Stories about Anthropic carry a disclosure.
   The rules are public at /standards/ ("How we work").
3b. **The under-reported story:** from independent outlets' reports that no mainstream outlet ran,
   Opus picks at most one (or none), Sonnet writes it and a fact-check compares it with its source.
   It runs in its own block after the top stories, labelled "Measured Edition analysis".
4. Picture: the best outlet photo, credited and linked, else a free Wikimedia Commons photo.
5. Builds the static site and deploys it to your Cloudflare account (Workers, free plan).

Your laptop plays no part: GitHub makes, publishes and saves the edition.

## Cost so far

- Building and testing overnight: about **$1.70** of Anthropic credit.
- The first scheduled edition (03:30 run, half-price Batch API) cost **$0.69** for 37 stories and
  was live by 03:37. Expect **~$0.70–0.85 per edition, ~$1.40–1.70/day**, so $100 lasts about two
  months. The editor (Opus) is about a quarter of that and the writer the rest. Easy levers if
  you want it cheaper: lower the editor's effort, or trim the number of feeds it reads.
  Each edition's cost is recorded in `data/editions/<id>.json` → `stats.costUsd`.

## Things to know

- **Not included:** X and Instagram (no free access). Reddit refused our requests, so it isn't used either.
- **No Reuters, AP, Kolkata Telegraph or Statesman:** their bot checks refuse us. PTI's pages need
  JavaScript, so its text is read where ThePrint republishes it word for word.
- **Thin stories get more reports:** a story with fewer than three readable reports is matched
  against everything gathered that morning (about 4,000 reports, plus Business Standard, Outlook and
  Deccan Herald), then the Guardian's search (full text through its API), then GDELT if it answers.
- **robots.txt is not consulted until 3 December** (the owner's call during development; set in
  pipeline/robots.ts, IGNORE_ROBOTS_UNTIL). After that, the rules a site writes for every reader
  apply again. Either way: no paywall bypassing, an honest user agent, and a site that refuses us
  stays refused.
- **The Guardian** comes through its Content API (GUARDIAN_API_KEY, developer key), with full text.
- **No one paper leads too much:** no owner is credited first on more than about one story in seven
  when another outlet carries the story; a story lists each outlet once.
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

1. **Your domain**: done, measurededition.com is live and open to search.
2. **"Follow this story"**: link today's article to earlier coverage of the same event.
3. **"Ask about this story"**: a small Q&A box under each article (uses credits per question).
4. Tune anything: section sizes, which outlets, article length, the look.

Just tell me what you liked and what bugged you after reading the first edition.
