# Meridian — reader site design

The reader site is a **survey sheet of the day**. A topographic sheet is bounded and finite, framed
by a neatline, keyed by a legend and annotated in its margins, and Meridian's edition works the same
way. That world shows in the **frame**: the masthead, the neatline, legend keys, section openers and
picture stand-ins. The **reading column** stays calm: a good serif at a real measure with real contrast.

Mode: Read. Platform: web, phone first. Product context: [`PRODUCT.md`](PRODUCT.md) (written
from the brief; the owner could not be interviewed).

## Build, test, files

```sh
node site/build.ts --data data/editions --out dist     # real editions
node site/build.ts --data site/fixtures --out dist     # fake fixtures (see fixtures/README.md)
node --test 'site/**/*.test.ts'                        # Node 24 needs a glob, not a bare dir
```

| File | Role |
|---|---|
| `build.ts` | `buildSite({ dataDir, outDir })` + CLI. Validates, wipes `outDir` (refuses dangerous paths), writes pages, hashed assets, `_headers`, `robots.txt`, `404.html`. |
| `schema.ts` | zod validation. A bad story is dropped with a warning; a bad image/video costs only the picture/video. Ids must be lowercase slugs (they become paths). |
| `templates/helpers.ts` | escaping, the `*italic*`/`[text](http…)` renderer, IST formatting, `pic()`, legend keys, leaning scale, card meta. |
| `templates/layout.ts` | document shell, inline head script (theme + image fallback, hashed into the CSP), mastheads, neatline, footer. |
| `templates/front.ts`, `article.ts`, `archive.ts` | pages (`archive.ts` also renders the 404). |
| `assets/site.css`, `assets/site.js` | all styling and the progressive script; both are content-hashed at build. |
| `assets/fonts/` | self-hosted Source Serif 4 (opsz + wght 400–700, roman + italic; Latin plus a small Ext-A + ₹ subset) and Schibsted Grotesk. OFL licences alongside. |

## Colour

Restrained, using neutrals tinted from the world. **Survey blue** is the one accent and appears only
on links in running text and on state. Section colours follow map-legend convention and appear in only two
places, the legend key swatch and the tint of a picture stand-in. They are never used for text or for
left/right politics.

| Token | Day sheet | Night sheet | Use |
|---|---|---|---|
| `--paper` | `oklch(.976 .004 240)` #f5f7fa | `oklch(.195 .018 258)` #10151d | ground (cool survey white / chart night) |
| `--paper-2` | `oklch(.952 .006 240)` | `oklch(.232 .02 258)` | key-facts box, footer, hover |
| `--ink` | `oklch(.235 .028 262)` #171e2b | `oklch(.935 .008 95)` #ebe9e4 | headlines, body (15:1) |
| `--ink-2` | `oklch(.43 .022 262)` | `oklch(.775 .014 250)` | summaries, meta, dek (≥7:1) |
| `--rule` / `--rule-strong` | `.875` / `.72` L | `.32` / `.46` L | hairlines / boxes, scale ticks |
| `--accent` | `oklch(.47 .125 256)` #245a9f | `oklch(.8 .095 245)` #89c5f7 | body links, source titles, "Last opened" (≥6:1) |
| `--alert` | `oklch(.5 .16 30)` | `oklch(.79 .12 35)` | the Developing dot only |

Legend tints (`--t-*`, lighter at night): India = contour sienna, World = water blue, Business = ochre,
Science & Tech = boundary violet, Sports = forest green, Health & Environment = marsh teal,
Bengaluru = road red, unknown sections = grey. A section is tinted through the `.t-<id>` class, which
sets `--tint`. Tints are mixed **in OKLab**: OKLCH mixing rotates hue and turns sienna purple at night.

The theme follows the system. `data-theme="light|dark"` on `<html>` overrides it, set by the header
toggle (stored in `meridian:theme`) or by `?theme=` (not stored; useful for screenshots). Photos get
a 6% veil at night so they don't glare.

## Type

- **Source Serif 4** (variable, optical sizes) for the wordmark, headlines and all reading. The
  wordmark and article headline force `opsz` 60. Body is 18px/1.65 at a 36em measure.
- **Schibsted Grotesk** for marginal information: meta lines, the edition line, the jump bar, box
  titles, the sources list and the footer.
- **Region-label caps**: section names, "Key facts" and "How it's being framed" are set in Schibsted
  bold caps, tracked 0.14–0.2em, the way a sheet letters regions.
- Headline steps on a phone: lead 30, feature 24, sub 19, row 18. On desktop: lead 44, story 52,
  feature 30. `text-wrap: balance` is applied to headings and `pretty` to paragraphs.
- No eyebrows. The section label sits in the meta line under a card's summary (`▪ India · 4 outlets ·
  2 min read`). On articles it sits in the running head beside the back link.

## Signature: the graduated neatline

Under the front-page masthead runs a map border of 24 alternating segments, one for each hour of
the IST day, with ticks at **05:00** and **17:00**. The current edition's tick is bold. A hairline
4px above the band doubles it the way a sheet's frame is doubled. Slim mastheads (article, archive,
404) carry the band with unlabelled ticks: an article marks its own edition's slot, the archive marks
both. The colophon closes the sheet with the same band. Every mark encodes a fact; it is the one
repeating-gradient on the site, so don't spread stripes elsewhere.

Margin notes on desktop: "Compiled in Bengaluru 12°58′ N 77°35′ E" on the left (the pipeline runs
there) and "All times IST, the 82°30′ E meridian" on the right (IST is defined by that meridian).

## Components

- **Picture box `.pic--{lead|feature|sub|thumb|hero|mini}`**: a fixed aspect ratio (3:2, 4:3 for
  thumbs, 16:9 for the article hero), with `object-fit: cover`. There is no layout shift: the image
  sits absolutely positioned over a **typographic stand-in**, which is the section-tinted sheet with a
  survey-cross graticule (an SVG mask, so it takes the tint). While a photo loads, the sheet shows
  without words. With no image, or when the image errors, the head script removes the `<img>` and adds
  `.is-broken`, and the sheet gains an inner neatline and is lettered the way a map labels a place:
  the section in region caps, the dateline place in roman serif (thumbnails truncate it), and the outlet
  in italic on large boxes. A broken article hero drops to 16:5 and hides its credit.
- **Hotlink-blocking hosts** (`BLOCKED_IMAGE_HOSTS` in `helpers.ts`, currently `c.ndtvimg.com`, which
  answers 403): their images are treated as missing at build time, so the stand-in shows at once, and a
  section's feature slot goes to its highest-ranked story whose picture can load.
- **Cards**: the headline is the only link, and `.stretch::after` makes the whole card clickable.
  Focus rings sit on the card (`article:has(.stretch:focus-visible)`).
  - *Lead*: full-bleed picture on phones. On desktop the picture and headline take 8 columns and the
    secondary leads stack in the right 4 as compact rows (3-line summaries), so four headlines sit above
    the fold at 1440×900.
  - *Sub* (2–4): rows on phones, a picture-card row on tablet, stacked rows beside the lead on desktop.
  - *Section*: a feature card plus 3 rows beside it on desktop (4 when exactly 4 remain). Further
    stories run below in a 4-up grid of picture cards, or 3-up when 4-up would strand one card.
  - *Row*: headline beside a 4:3 thumbnail with the summary underneath. It is reused for "Next in" and
    "Also in this edition".
- **Section opener**: a 3px double rule, then the legend key and the name in region caps, with the
  story count on the right.
- **Jump bar**: sticky and horizontally scrollable, with edge fades on phones. An IntersectionObserver
  underlines the section you're in and scrolls the bar to keep it centred. It is anchors only, never
  a filter.
- **Edition switch**: Morning | Evening for the day. The current edition is *ringed* (calendar-pad
  ring). A missing edition is set in italic serif; on the latest day it reads "Evening at 17:00".
- **Key facts**: a `--paper-2` box whose bullets are legend-key squares. On desktop it moves to a
  sticky right rail.
- **How it's being framed**: a hairline-bordered box with a short note on method, then each
  perspective as a label, a summary and the outlets. It renders only when `perspectives` is non-empty.
- **Leaning scale**: five ticks on a baseline with a dot at the outlet's position and the word beside
  it, in neutral ink. Outlets with no leaning get no scale.
- **Video**: a lite embed (YouTube `hqdefault` poster plus a play disc) that links out without JS and
  swaps to a `youtube-nocookie` iframe with autoplay when JS runs.
- **Meta lines** (`.meta`, `.story-meta`): items carry their own dot separator (`::before`). The
  list is shifted left and clipped with `clip-path`, so a wrapped line never starts or ends on a dot.
  Don't put `.sep` spans back into these lists.
- **Colophon**: the closing neatline, "End of the morning edition", next/previous edition links, all
  editions, and the pipeline stats including editing cost.
- **Sample banner**: fixture files carry `"fixture": true` (not part of the pipeline contract). If any
  loaded edition has it, every page opens with an ink bar saying the stories are invented.

## Behaviour (`site.js`, 7 KB, under 3 KB gzipped, progressive)

- **Read marks**: an article adds `editionId/storyId` to `meridian:read` (the last 1,500 are kept) and
  sets `meridian:last`. Cards you have read get a grey headline and a desaturated picture, plus a
  "Read" label. The last-opened card on the front page gets an accent pin labelled "Last opened" that
  wipes in once. Marks are re-applied on `pageshow` after a bfcache restore.
- **Back**: `a[data-back]` calls `history.back()` when `document.referrer` is this edition's front
  page (the listed `data-front` paths, which include `/` when the edition is the latest), so the browser
  restores the exact scroll position. Otherwise it is a normal link to `/e/<id>/#<storyId>`, where the
  card has `scroll-margin-top` to clear the sticky bar.
- **Picture carry-over**: on browsers with cross-document view transitions, the tapped card's picture
  morphs into the article hero (`view-transition-name: hero`) over 340ms with an ease-out curve. This
  is disabled under `prefers-reduced-motion`, which also kills every other animation.

## Security and delivery

- Every string is escaped. Body text allows only `*italic*` and `[text](http/https)`. External links
  get `target=_blank rel="noopener noreferrer nofollow"`.
- `_headers` sets `X-Robots-Tag: noindex, nofollow` and a strict CSP: scripts are `'self'` plus the
  SHA-256 of the single inline head script, there are no inline styles, `img-src https: data:`, and
  frames come only from youtube-nocookie. It also sets nosniff, DENY framing, Referrer-Policy and
  Permissions-Policy. HTML gets `max-age=120`. `/assets/*` gets `immutable` for a year, because CSS
  and JS names are content-hashed.
- `<img>` always has `referrerpolicy="no-referrer"`, `decoding="async"`, width and height, and
  `loading="lazy"` except on the lead and article hero, which get `fetchpriority="high"`.

## Don'ts

- Don't add eyebrows/kickers above headlines, red/blue political colour, or option toggles.
- Don't use legend tints for text or large fills outside picture stand-ins.
- Don't add stripes or graduated bands beyond the neatline.
- Don't add inline `style=""` (the CSP forbids it) or a second inline script (its hash would be needed
  in `_headers`; `build.ts` computes the hash from `HEAD_SCRIPT`).
