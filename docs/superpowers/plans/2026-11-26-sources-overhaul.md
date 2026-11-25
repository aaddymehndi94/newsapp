# Part 1: sources and the time window — work plan

Branch `sources-overhaul`. **Do not merge to `main` until the owner approves** (they are asleep
overnight on 25–26 Nov; they asked for the work to continue). Push the branch so it is safe.
Evidence: `docs/retro/2026-11-25-editorial-retrospective.md`. Owner's brief: remove bias, especially
from outlets known for biased or poor journalism ("times of india is particularly bad"; the cities
lean on TOI); give headlines an equal chance; don't let outlets with incentives set the agenda.

Rules that never bend: respect robots.txt (pipeline/robots.ts checks every feed and page), honest
user agent, no proxies, no paywall workarounds, no paid API calls during development (counting
tokens with the API's countTokens endpoint is free and allowed). Node 24:
`export NVM_DIR=~/.nvm && . ~/.nvm/nvm.sh && nvm use 24`. Tests: `npm test`; typecheck
`npx tsc --noEmit -p .`. Free check of all feeds: a script calling `gatherAll(SOURCES, 26)`.

## Tasks (TDD: failing test first, then code; commit after each)

1. **Source schema.** In `config/sources.ts` add to `Source`: `tier: "primary" | "wire" | "core" |
   "corroborate" | "perspective"` and `owner: string` (e.g. "Bennett Coleman" for TOI/ET/Filmfare,
   "Adani" for NDTV, "Reliance/Network18" for News18, "The Hindu group" for The Hindu/Frontline/
   Businessline). Leaning stays but is no longer the main axis. Give every outlet a unique name.
2. **Fix the leaning bug.** `leaningFor("The Telegraph")` falls through to `EXTRA_LEANINGS` and
   shows the Kolkata Telegraph as centre-right (it is the UK paper's label). Kolkata Telegraph is
   centre-left; key by unique outlet names.
3. **Apply the source changes** (all verified by the source desk on 25 Nov ~18:00 UTC within robots.txt):
   - DROP: `toi-india`, `ndtv-top`, `firstpost-india`, `organiser` (duplicate or party organ). Swarajya
     had no usable route (title-less sitemap) and is already gone with the Google News feeds.
   - DEMOTE to `corroborate` (never first or only source; enforced in task 7): `toi-*` city feeds,
     `et-top`, `ndtv-india`, `news18-india`, Filmfare.
   - KEEP as `core`: `hindu-*`, `ie-*`, `ht-*`, Mint, Business Standard, Scroll (relabel centre-left),
     Mongabay, NIE city feeds.
   - ADD (kind in brackets; "sitemap" is the new kind from task 4):
     - PTI [sitemap, wire, centre]: `https://www.ptinews.com/news-sitemap.xml` → daily
       `/sitemaps/pti-sitemap-YYYY-MM-DD.xml` (~1,181 titled items a day; article pages are JS-only,
       so headlines only; route city items by keyword: Delhi ~45/day, Bengal ~25, Mumbai, etc.).
     - ThePrint [sitemap, core, centre]: `https://theprint.in/googlenews.xml`.
     - The Wire [sitemap, core, left]: `https://thewire.in/news-sitemap.xml`; rewrite link host
       `thewirenews.in` → `thewire.in`; its times are IST mislabelled +00:00. Never sole source.
     - The Quint [sitemap, core, centre-left]: `https://www.thequint.com/sitemap/today` and `/sitemap/yesterday`.
     - The News Minute [rss, core, centre-left]: `https://www.thenewsminute.com/stories.rss` (+ daily
       sitemap `/sitemap/sitemap-daily-YYYY-MM-DD.xml`, slugs only; filter by URL path for cities).
     - Newslaundry [rss, core]: `https://www.newslaundry.com/stories.rss` (rate-limits with 429; be gentle).
     - LiveLaw [sitemap/rss, core, courts]: `https://www.livelaw.in/google_feeds.xml`.
     - Bar & Bench [rss, core, courts]: `https://www.barandbench.com/stories.rss`.
     - Down To Earth [sitemap, core]: `https://www.downtoearth.org.in/news_sitemap.xml`.
     - Frontline [rss, core]: `https://frontline.thehindu.com/feeder/default.rss`.
     - Fact-checkers [rss, core, at most 2 picks]: Alt News `https://www.altnews.in/feed/`,
       BOOM `https://www.boomlive.in/google_feeds.xml`, Factly `https://factly.in/feed/`.
     - RBI [rss, primary]: `https://www.rbi.org.in/pressreleases_rss.xml` (times have no offset: IST).
     - BBC India [rss, core]: `https://feeds.bbci.co.uk/news/world/asia/india/rss.xml`.
     - NYT Asia [rss, core]: `https://rss.nytimes.com/services/xml/rss/nyt/AsiaPacific.xml`.
     - The Diplomat South Asia [rss, core]: `https://thediplomat.com/regions/south-asia/feed/`.
   - Cities (TOI corroborate-only everywhere, at most 4 TOI items per city in the editor's menu):
     - Bengaluru: keep hindu-blr, hindu-karnataka, ie-bangalore, ht-bengaluru; add Deccan Herald
       `https://www.deccanherald.com/stories.rss?section=bengaluru` (+ `news_sitemap.xml` filtered to
       `/bengaluru/`), South First `https://thesouthfirst.com/category/karnataka/feed/`, TNM (Karnataka
       path filter), Citizen Matters `https://citizenmatters.in/feed/`.
     - Chennai: keep hindu-che, nie-chennai; add The Hindu Tamil Nadu
       `https://www.thehindu.com/news/national/tamil-nadu/feeder/default.rss`, DT Next
       `https://www.dtnext.in/api/v1/collections/newschennai-news.rss`, South First
       `https://thesouthfirst.com/category/tamilnadu/feed/`, TNM.
     - Delhi: keep hindu-del, ie-delhi, ht-delhi; add Newslaundry, Down To Earth, PTI (Delhi keywords).
     - Hyderabad: keep hindu-hyd, nie-hyderabad; add The Hindu Telangana
       `https://www.thehindu.com/news/national/telangana/feeder/default.rss`, South First
       `https://thesouthfirst.com/category/telangana/feed/`; Siasat `https://www.siasat.com/feed/`
       and Deccan Chronicle `https://www.deccanchronicle.com/google_feeds.xml` as corroborate only.
       Skip Telangana Today (BRS-aligned).
     - Kochi: keep hindu-kochi, hindu-kerala, nie-kochi; add Onmanorama
       `https://www.onmanorama.com/kerala.feeds.onmrss.xml`, Mathrubhumi English
       `https://english.mathrubhumi.com/rss`, South First `https://thesouthfirst.com/category/keralam/feed/`.
     - Kolkata: keep hindu-kol, hindu-wb; IE Kolkata `https://indianexpress.com/section/cities/kolkata/feed/`
       is active again (9 items/24h; fix the stale comment); add PTI (Bengal keywords). Accept fewer
       than 3 stories on thin days rather than letting TOI fill the gap.
     - Mumbai: keep ht-mumbai, hindu-mum, ie-mumbai; add Mid-Day
       `https://www.mid-day.com/Resources/midday/rss/mumbai-news.xml` (tabloid-leaning; no offset: IST),
       Free Press Journal `https://www.freepressjournal.in/stories.rss` filtered to `/mumbai/`
       (its robots.txt disallows `/*/feed`; the stories.rss path is allowed), PTI (Mumbai keywords).
   - Outlets whose robots.txt names Claude/Anthropic agents (TNM, Newslaundry, Deccan Herald, The Hindu,
     Frontline, Indian Express, Siasat, Newschecker): our agent is not named, but respect the intent —
     add `fetchPages: false` so we use their feed text only and never fetch their article pages. Note
     this applies to The Hindu and Indian Express, which the pipeline fetches today.
   - Verify every new URL again with the robots check before committing (a free gather run).
4. **Sitemap source kind** in `pipeline/feeds.ts`: parse `<url>` entries with `news:title`
   (fall back to a title from the URL slug), `news:publication_date` or `lastmod`, `loc`; support
   a sitemap index (follow today's and yesterday's child sitemaps only); optional URL-path include
   filter and keyword filter (for PTI city routing); treat timestamps with no offset as IST.
5. **Time window.** Look back to the previous edition's gather time (store `stats.gatheredAt` in
   each edition; read the latest edition in `data/editions/`) minus 1 hour, with a floor of 26 hours
   and a ceiling of 50. Today it is a fixed 16 hours, which hides about 8 hours of every day.
6. **Outlet budget across the whole window** (replace "newest 16 per feed" in `pipeline/run.ts`):
   one budget per owner group (about 30 items; 10 per outlet per city), sampled evenly across 3-hour
   buckets so a busy newsroom's daytime work is not dropped. Keep the editor's menu near today's size
   (measure with countTokens; today's editor input is ~55K tokens).
7. **Enforce in code** (`cleanSlate` in `pipeline/editor.ts`, which needs item → source metadata):
   the first-listed source of a story must be tier core, wire or primary; a story whose sources are
   all corroborate-tier is dropped; items from the same owner count as one outlet; drop repeated
   items from the same outlet that pose as corroboration.
8. **Editor prompt touch-ups for this part only:** remove "single-source acceptable for … a local
   city report"; describe tiers instead of "own feeds before headline-only items". (The full
   selection redesign is Part 2; don't do it here.)
9. **Dry run, free:** gather all feeds with the new config; report items per outlet, per owner
   group and per city, robots skips and failures, and the editor prompt's token count (countTokens).
   Write the numbers into this file under "Results".
10. Update docs: README source summary, `docs/MORNING-NOTES.md` feed counts, memory.

## Also tonight

- After the 03:37 IST GitHub run (it may take until ~05:00): check it started on time, that the two
  later start times skipped without paying, its cost, and feed failures with the new robots check
  (`curl https://api.github.com/repos/aaddymehndi94/newsapp/actions/runs?per_page=5`; the edition
  JSON lands in `data/editions/2026-11-26-am.json` on `main`).
- Leave a short morning summary for the owner in the conversation: what was done, what's waiting for
  their approval (merge of this branch), the 03:37 run's result.

## Results

(fill in)

## Progress

(Update as tasks finish: task number, commit, one line.)
