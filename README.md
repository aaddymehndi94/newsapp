# Meridian

A calm, balanced, ad-free news site. Twice a day (05:00 and 17:00 IST) it reads ~80 news feeds
from across the political spectrum, has **Claude Opus 5.5** pick a balanced slate of ~40 stories,
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

Local cron (`crontab -l`) runs `scripts/run-edition.sh am` at 03:30 and `… pm` at 15:30 IST; logs in
`logs/`. To run on GitHub instead, see the notes at the top of `.github/workflows/edition.yml`.

## Layout

- `config/sources.ts` — news feeds with leaning labels · `config/youtube.ts` — news channels
- `pipeline/` — gather (`feeds.ts`), read pages (`enrich.ts`), editor (`editor.ts`), writer
  (`writer.ts`, style rules in `style.ts`), pictures (`images.ts`), video (`videos.ts`), orchestration (`run.ts`)
- `site/` — static site renderer → `dist/`
- `data/editions/*.json` — published editions (the archive) · `data/work/` — per-run caches (gitignored)
- `docs/superpowers/` — design spec and implementation plan
