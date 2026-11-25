# Measured Edition

A calm, balanced, ad-free news site. Every morning (05:00 IST) it reads ~150 news feeds and
sitemaps (PTI, national and independent Indian outlets, each city's own papers, courts,
fact-checkers, the RBI and international outlets; each outlet has an owner and a tier, so outlets
with conflicts only corroborate), has **Claude Opus 5.5** pick a balanced slate of ~40 stories,
has **Claude Sonnet 5.5** write each one from several outlets' reporting, adds a credited picture
(and a news-channel video where one exists), and publishes a static site to Cloudflare.

## Run it

```bash
. ~/.nvm/nvm.sh && nvm use 24          # Node 24 (system node is too old)
npm install
node pipeline/run.ts                    # produce + build + deploy the current edition
node pipeline/run.ts --no-deploy        # produce + build only (see dist/)
node pipeline/run.ts --no-build --max 5 # quick test: plan the edition, write 5 stories
node site/build.ts                      # rebuild the site from data/editions
npx wrangler deploy                     # upload dist/ to Cloudflare
npm test                                # unit tests
node scripts/check-feeds.ts             # check every news feed still works
```

Flags for `pipeline/run.ts`: `--slot am|pm`, `--date YYYY-MM-DD`, `--batch` (half-price Message
Batches with a deadline fallback), `--fresh` (ignore cached work), `--no-build`, `--no-deploy`, `--max N`.

Secrets live in `.env` (`ANTHROPIC_API_KEY=…`). Cloudflare uses the `wrangler login` on this machine.

## Schedule

GitHub Actions (`.github/workflows/edition.yml`) produces, deploys and commits the edition once a
day; nothing runs on a laptop (owner's choice, 2026-11-25). It has three start times (03:37, 04:17
and 04:57 IST) because GitHub can start scheduled jobs late; the first to run makes the edition and
the others see it in the repo and stop before any paid step.

## Layout

- `config/sources.ts` — news feeds with leaning labels · `config/youtube.ts` — news channels (read through the YouTube Data API; needs `YOUTUBE_API_KEY`)
- `pipeline/` — gather (`feeds.ts`), read pages (`enrich.ts`), editor (`editor.ts`), writer
  (`writer.ts`, style rules in `style.ts`), pictures (`images.ts`), video (`videos.ts`), orchestration (`run.ts`)
- `site/` — static site renderer → `dist/`
- `data/editions/*.json` — published editions (the archive) · `data/work/` — per-run caches (gitignored)
- `docs/superpowers/` — design spec and implementation plan
