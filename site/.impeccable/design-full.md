---
name: Measured Edition
description: A daily balanced news edition, read like a standard news app played straight.
colors:
  accent: "#c4122f"
  accent-night: "#f25a66"
  accent-fill: "#c4122f"
  accent-fill-night: "#d0283a"
  on-accent: "#ffffff"
  ground: "#ffffff"
  surface: "#f4f4f4"
  surface-2: "#e9e9e9"
  chip: "#efefef"
  chip-hover: "#e4e4e4"
  ink: "#121212"
  ink-2: "#3d3d3d"
  ink-3: "#656565"
  rule: "#e3e3e3"
  rule-strong: "#c6c6c6"
  ground-night: "#111111"
  surface-night: "#1b1b1b"
  surface-2-night: "#262626"
  chip-night: "#222222"
  chip-hover-night: "#2e2e2e"
  ink-night: "#f3f3f3"
  ink-2-night: "#cbcbcb"
  ink-3-night: "#9d9d9d"
  rule-night: "#2a2a2a"
  rule-strong-night: "#474747"
typography:
  wordmark:
    fontFamily: "Source Serif 4, Source Serif Pro, Georgia, Times New Roman, serif"
    fontSize: "2.125rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontVariation: "\"opsz\" 60"
  headline-story:
    fontFamily: "Source Serif 4, Source Serif Pro, Georgia, Times New Roman, serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.02em"
    fontVariation: "\"opsz\" 60"
  headline-lead:
    fontFamily: "Source Serif 4, Source Serif Pro, Georgia, Times New Roman, serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: "-0.015em"
  headline-feature:
    fontFamily: "Source Serif 4, Source Serif Pro, Georgia, Times New Roman, serif"
    fontSize: "1.4375rem"
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "-0.01em"
  headline-row:
    fontFamily: "Source Serif 4, Source Serif Pro, Georgia, Times New Roman, serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.25
  body-article:
    fontFamily: "Source Serif 4, Source Serif Pro, Georgia, Times New Roman, serif"
    fontSize: "1.15625rem"
    fontWeight: 400
    lineHeight: 1.65
  dek:
    fontFamily: "Source Serif 4, Source Serif Pro, Georgia, Times New Roman, serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.45
  summary:
    fontFamily: "Source Serif 4, Source Serif Pro, Georgia, Times New Roman, serif"
    fontSize: "1.03125rem"
    fontWeight: 400
    lineHeight: 1.5
  section-title:
    fontFamily: "Schibsted Grotesk, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.3125rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  box-title:
    fontFamily: "Schibsted Grotesk, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 800
    lineHeight: 1.25
  tab:
    fontFamily: "Schibsted Grotesk, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.90625rem"
    fontWeight: 600
    lineHeight: 1
  ui:
    fontFamily: "Schibsted Grotesk, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Schibsted Grotesk, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  focus: "4px"
  thumb: "8px"
  pic: "10px"
  box: "12px"
  pill: "999px"
spacing:
  gutter-phone: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "32px"
  row: "16px"
  column-gap: "40px"
  grid-gap: "32px"
  section-phone: "32px"
  section-desktop: "48px"
components:
  tab:
    backgroundColor: "{colors.chip}"
    textColor: "{colors.ink}"
    typography: "{typography.tab}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  tab-hover:
    backgroundColor: "{colors.chip-hover}"
  tab-active:
    backgroundColor: "{colors.accent-fill}"
    textColor: "{colors.on-accent}"
  button-pill:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
    height: "44px"
  button-pill-hover:
    backgroundColor: "{colors.chip}"
  icon-button:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "40px"
  picture:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.pic}"
  thumbnail:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.thumb}"
  key-facts:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.box}"
    padding: "18px 20px"
  latest-badge:
    backgroundColor: "{colors.accent-fill}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  footer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    padding: "28px 0 36px"
---

# Design System: Measured Edition

## Overview

**Creative North Star: "The Straight Edition"**

Measured Edition looks like the news apps its reader already trusts (BBC News, the NYT app, The Hindu app) and does not try to be cleverer than them. Bold serif headlines sit inside a clean, modern app layout: a white day ground or a near-black night ground, neutral greys with no tint, black and white ink, and one crimson accent. Each edition is finite, read from top to bottom, and ends with "You're all caught up".

The density is a news app's density: every headline gets a picture and a 3–4 line summary. Hairlines separate the stories, and a heavy 2px ink rule opens each section. Nothing is decorative unless it helps the reader find their way. The editorial voice comes from the serif and from restraint, never from ornament. The replaced "survey sheet" world (neatline, legend tints, grey-blue night) is gone and none of its apparatus comes back.

On a phone the page is one column with a full-bleed lead photo. On desktop it becomes a 7:5 lead-and-rows split, with the same components throughout.

**Key Characteristics:**
- Two grounds with real contrast: pure white, and near-black (#111) with neutral greys.
- One crimson accent, used only in its listed roles.
- Source Serif 4 bold for headlines and reading text. Schibsted Grotesk for every UI string.
- Solid pill tabs, hairline rows, softly rounded photos.
- Photos are shown at their own shape. The large ones are never cropped to a house ratio.
- Read state is a drawn tick. A card is never dimmed.

## Colors

The palette is fully neutral, with no hue at all in the greys. A single crimson accent is the only colour on the page apart from the photos.

### Primary
- **News Crimson** (accent / accent-night): the one accent. It is text colour for the section label in card and story meta, for "Developing" and its dot, for links in body text, key facts, Context and the framing box, for the key-fact bullet dots, and for the text caret, focus ring and selection tint (at 16% day, 30% night). At night it lifts to a lighter crimson so text keeps about 5.8:1 on #111.
- **Crimson Fill** (accent-fill / accent-fill-night): the accent used as a background under white text (on-accent). It is used for the active section tab and the "Latest" badge in the archive. By day it equals the accent. At night it is a deeper crimson, so white text keeps about 5:1.

### Neutral
- **Day Ground** (ground) / **Night Ground** (ground-night): the page, the sticky tab bar and top bar, and icon-button faces. The browser `theme-color` matches it.
- **Surface** (surface / surface-night): the key-facts box and the footer band.
- **Surface 2** (surface-2 / surface-2-night): the picture box while a photo loads, and its placeholder when there is no photo.
- **Chip / Chip Hover** (chip, chip-hover, plus night pair): inactive tab pills, and the hover fill for pill buttons, the back link and icon buttons.
- **Ink** (ink / ink-night): headlines, the wordmark, section titles, the 2px section rules, and the strong part of the edition line.
- **Ink 2** (ink-2 / ink-2-night): summaries, the dek, the footer text, and both read marks ("Read" and "Last opened").
- **Ink 3** (ink-3 / ink-3-night): meta lines, counts, credits, notes and dot separators.
- **Rule / Rule Strong** (rule, rule-strong, plus night pair): hairlines between rows and under the bars, and the outlines of buttons, the framing box and the leaning-scale ticks.

### Named Rules
**The One Crimson Rule.** The accent appears only in its listed roles: the section label in meta, Developing, links in running text, key-fact bullets, the active tab, the Latest badge, and focus, caret and selection. It never appears on headlines, rules, backgrounds or icons beyond these.

**The White-On-Fill Rule.** White text sits only on accent-fill, never on the text accent. At night the text accent is too light to carry white.

**The No-Tint Rule.** The greys are true neutrals (R = G = B). The night ground is #111, not a blue-grey. Sections are not colour-coded. Left and right politics are never coloured: the leaning scale is ink on rule-strong.

At night, photos take `brightness(0.93)` so they don't glare.

## Typography

**Display Font:** Source Serif 4 (variable, opsz plus weight 400–700, roman and italic; self-hosted; falls back to Source Serif Pro, then Georgia)
**Body Font:** Source Serif 4 for reading text (summaries, dek, article body, key facts)
**Label Font:** Schibsted Grotesk (variable 400–900; self-hosted; falls back to system-ui) for every UI string

**Character:** A bold, newsy serif carries the headlines and the reading, the way NYT and BBC set them. A sturdy grotesk carries everything a news app's chrome would: tabs, meta, section titles, buttons, the footer.

### Hierarchy
- **Wordmark** (700, opsz 60, one line, never wraps): "Measured Edition" in the masthead (34px phone, scaling down to about 31px at 320px; 44px from 600px) and the top bar (24px, scaling to about 20px at 320px). The favicon is the same face's bold "M" in white on a #111 rounded square.
- **Story headline** (700, 30 / 38 / 44px at phone / 600px / 1024px, 1.12): the article H1.
- **Lead headline** (700, 28 / 34 / 40px, 1.14): the edition's lead card.
- **Feature headline** (700, 23 / 26px, 1.18): the first card of each section.
- **Row headline** (700, 18 / 19px, 1.25): every row card, including "More in" and "Also in this edition".
- **Article body** (400, 18.5 / 19px, 1.65, inside a 720px column): running text.
- **Dek** (400, 19 / 20px, 1.45, ink-2): the standfirst under the article headline.
- **Summary** (400, 16.5 / 17px, 1.5, ink-2): card summaries. In rows it is clamped to 4 lines.
- **Section title** (Grotesk 800, 21px, 1.2): section heads on the front page. **Box title** (Grotesk 800, 19px) is used for Key facts, How it's being framed, Background, Why it matters, Sources and the Keep reading heads.
- **Meta** (Grotesk 400, 13px, ink-3): the section label, Developing, outlets, read time and read marks.
- **Tab** (Grotesk 600, 14.5px): section pills.

### Named Rules
**The Serif Speaks, Sans Serves Rule.** Headlines and anything you read as prose are serif. Every control, label and count is Grotesk. Neither family crosses over.

**The No-Kicker Rule.** Nothing sits above a headline. The section label lives in the meta line under the summary on cards, and first in the meta line on articles.

`text-wrap: balance` applies to headings and `pretty` to paragraphs.

## Layout

The page uses a centred wrap with a maximum width of 1200px. Its gutter is 16px on phones, 24px from 600px and 32px from 1024px, and it respects the safe areas. Articles narrow to a 720px column.

- **Phone (base):** one continuous column. The lead photo runs full bleed with square corners. Sub-stories and section stories are rows.
- **Row:** a two-column grid. The headline sits beside a 4:3 thumbnail (clamped to 100–150px, about 28% of the width, with a 14px gap). The summary spans both columns below and is clamped to 4 lines. Meta comes last. Each row has 16px of padding above and below and is separated from the next by a 1px rule hairline.
- **Section:** a 2px ink rule, then the title on the left and the story count on the right, then the feature card, then rows. Sections are 32px apart on phones and 48px apart on desktop.
- **Desktop (≥1024px):** Top stories use a 7fr:5fr split: the lead card on the left, sub-rows stacked on the right with a 40px gap. Each section puts its feature card beside 3 rows, or 4 rows when that avoids an orphan. The remaining stories run below in a 3-column grid with 32px gaps, or a 2-column grid when 3 columns would strand a card.
- **Sticky chrome:** the front page has a sticky tab bar, and other pages a 56px sticky top bar. Anchored sections clear it with `scroll-margin-top` / `scroll-padding-top` (60–64px).
- **Breakpoints:** 600px, 1024px, and 1240px (where the tab track stops bleeding to the screen edge).

**The Own-Shape Rule.** Large pictures (lead, feature, article hero) take the aspect-ratio class nearest the photo's own shape: 4:3, 3:2, 16:9 or 2:1. Portrait and square photos use 4:3, and photos of unknown size use 16:9. A share image with a masthead burned in is shown whole. Only thumbnails are a fixed 4:3 crop.

## Elevation & Depth

The system is flat. Depth comes from the ground, a surface tint and hairlines, never from shadows. Cards have no background, border or shadow; a rule separates them. The one shadow is the small scroll arrow that floats over the tab track, which needs to read above the pills it covers.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 4px 12px rgb(0 0 0 / 0.08)` by day; `0 1px 2px rgb(0 0 0 / 0.5), 0 6px 16px rgb(0 0 0 / 0.45)` at night): only for the tab-bar scroll arrows.

**The Flat Card Rule.** Story cards are never raised, boxed or filled. A hairline separates them and the photo carries the weight.

## Shapes

- Photos have softly rounded corners (10px), and thumbnails slightly less (8px). A full-bleed lead or article hero on phones drops to square corners where it meets the screen edge.
- Boxes (key facts, the framing box, video) use 12px.
- Every control is a pill or a circle: tabs, buttons, the back link, the Latest badge (999px), and icon buttons and scroll arrows (50%).
- Structural lines are straight: 1px hairlines between stories, and 2px ink rules that open sections, Keep reading blocks, archive days and the colophon.
- Dots are round: meta separators, the Developing dot, key-fact bullets and leaning ticks.

## Components

### Section tabs
- **Character:** solid pills you can obviously scroll, like an app's section bar.
- **Shape:** 36px tall, 16px side padding, pill radius, 8px apart.
- **Default / Hover:** chip fill with ink text. On hover, chip-hover.
- **Active:** crimson fill with white text, and `aria-current="location"`. An IntersectionObserver moves the active state to the section in view and scrolls the track to keep that pill centred.
- **Overflow:** 56px ground-coloured fades at the edges, plus 32px circular chevron buttons (rule-strong outline, the Float shadow). Each fade and arrow hides at its own end.
- Tabs are anchors only, never a filter. "Top stories" is always first.

### Buttons
- **Pill button:** 44px minimum height, 10px × 18px padding, 1px rule-strong outline, transparent face, Grotesk 600 at 15px. Its hover is a chip fill. It is used for colophon navigation and the 404 links.
- **Back link:** a pill with a chevron, no outline in the top bar and outlined at the foot of an article. Its hover is a chip fill.
- **Icon button:** a 40px circle with a rule-strong outline (the theme toggle, a half-filled disc glyph drawn in SVG).
- **Focus:** a 2px crimson outline with a 2px offset everywhere. A card shows its focus ring on the whole card (offset 4px, radius 6px).

### Cards
- **Lead:** a full-bleed photo at its own ratio, then the 28px serif headline, summary and meta.
- **Feature:** a picture at its own ratio, then the feature headline, summary and meta.
- **Row:** headline beside a thumbnail, the summary clamped to 4 lines, then meta. Every row has a thumbnail.
- The headline is the only link, and `.stretch::after` makes the whole card clickable. Hovering underlines the headline.

### Picture box
- A fixed aspect ratio, so there is no layout shift. The photo is absolutely positioned and covers the box, over a surface-2 placeholder.
- When there is no photo, or it fails to load, the placeholder names the section (11–12px Grotesk caps) and, on large boxes, the outlet. This is a placeholder caption, not a kicker.

### Meta line
- Grotesk 13px in ink-3. Each item draws its own leading "·" in a 15px slot. The list is shifted left by 15px and clipped with `clip-path: inset(-6px -6px -6px 15px)`, so a wrapped line never starts with a dot.
- Order: read marks (added by script), section label (crimson 700), Developing (crimson 600 with a 7px dot), outlets, read time.

### Read marks
- **Read:** a drawn filled-circle tick and the word "Read", in ink-2 at weight 600.
- **Last opened:** a drawn pin and "Last opened", in ink-2 at weight 500. It appears on the front page only, next to Read.
- The card itself is unchanged: no dimming, no greyed headline, no desaturated photo.

### Key facts and framing
- **Key facts:** a surface box with a 12px radius and 18px × 20px padding. It has a Grotesk 800 box title and serif bullets marked with 7px crimson dots.
- **How it's being framed:** a 1px rule-strong outlined box with a 12px radius. It holds a note on method, then each perspective as a Grotesk label, a serif summary and the outlets in ink-3.

### Sources and leaning scale
- Each source row shows the outlet in Grotesk 700 and the article title in serif ink-2, with a rule-strong underline.
- The leaning scale is five 8px dots, one filled in ink, plus the word. It is neutral and never red or blue. Outlets with no known leaning get no scale.

### Video
- A lite embed: a 16:9 poster with a 12px radius on black, and a 64px dark play disc that scales to 1.06 on hover. With JS it swaps to a `youtube-nocookie` iframe.

### Archive edition card
- A 4:3 mini thumbnail beside the edition name (serif 700, 19px), a meta line and the lead headline. A rule hairline separates the cards.
- The newest edition carries a "Latest" pill badge: crimson fill, white Grotesk 700 at 11px, uppercase.

### Colophon and footer
- **Colophon:** a 2px ink rule, then a centred "You're all caught up" (serif 700, 26px), the end-of-edition line, pill-button navigation and the pipeline stats.
- **Footer:** a surface band holding the wordmark, the AI and no-tracking notes, and site links.

## Do's and Don'ts

### Do:
- **Do** put every headline with a picture: a thumbnail for rows, or a ratio-matched photo for the lead and features.
- **Do** choose large-picture ratios with `ratioClass()` (r43 / r32 / r169 / r21), so photos keep their own shape.
- **Do** keep the accent in its listed roles, and put white text only on accent-fill.
- **Do** separate stories with 1px rule hairlines, and open sections with a 2px ink rule.
- **Do** use the leading-dot plus clip-path meta list. Every item carries its own `::before` dot.
- **Do** choose the desktop section grid so that no card is orphaned: 3 or 4 rows beside the feature, then 3 or 2 columns.
- **Do** keep every control a pill or circle at a 36–44px tap height.

### Don't:
- **Don't** add eyebrows or kickers above headlines.
- **Don't** colour left/right politics, or colour-code sections.
- **Don't** dim, grey or desaturate read cards. Read state is the tick.
- **Don't** add inline `style=""` attributes (the CSP forbids them).
- **Don't** use the crimson outside its listed roles: not on headlines, rules, backgrounds or decorative icons.
- **Don't** tint the greys or move the night ground toward blue-grey.
- **Don't** crop large pictures to a house ratio.
- **Don't** bring back neatlines, legend keys or other ornament that does not help the reader find their way.

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
| `templates/helpers.ts` | escaping, the `*italic*`/`[text](http…)` renderer, IST formatting, `ratioClass()` and `pic()`, leaning scale, card meta. |
| `templates/layout.ts` | document shell, inline head script (theme + image fallback, hashed into the CSP), front masthead, slim top bar, footer. |
| `templates/front.ts`, `article.ts`, `archive.ts` | pages (`front.ts` also exports `rowStory`, reused by articles; `archive.ts` also renders the 404). |
| `assets/site.css`, `assets/site.js` | all styling and the progressive script; both are content-hashed at build. |
| `assets/fonts/` | self-hosted Source Serif 4 (opsz + wght 400–700, roman + italic; Latin plus a small Ext-A + ₹ subset) and Schibsted Grotesk (400–900). OFL licences alongside. |

The theme follows the system. `data-theme="light|dark"` on `<html>` overrides it. That attribute is set by the header toggle (stored in `meridian:theme`) or by `?theme=`, which is not stored and is useful for screenshots. `THEME_COLORS` in `layout.ts` and `PAPER` in `site.js` must match `--bg`.

## Behaviour (`site.js`, progressive)

- **Read marks:** opening an article adds its key (edition id and story id, joined by a slash) to `meridian:read` (the last 1,500 are kept) and sets `meridian:last`. Read cards get the "Read" tick in their meta. On the front page the last-opened card also gets "Last opened". Marks are re-applied on `pageshow` after a bfcache restore.
- **Back:** `a[data-back]` calls `history.back()` when `document.referrer` is this edition's front page (the listed `data-front` paths, which include `/` when the edition is the latest). That way the browser restores the exact scroll position. Otherwise it is a normal link to `/e/<id>/#<storyId>`, and the card's anchor clears the sticky bar.
- **Picture carry-over:** on browsers with cross-document view transitions, the tapped card's picture morphs into the article hero (`view-transition-name: hero`, 340ms, `cubic-bezier(0.16, 1, 0.3, 1)`). Page transitions take 180ms. `prefers-reduced-motion` disables view transitions and every other animation.
- **Tabs:** the edge fades and arrows track the scroll position, and the active pill follows the section in view and stays centred.
- **Hotlink-blocking hosts:** `HOTLINK_BLOCKED_HOSTS` in `../config/sources.ts` (re-exported as `BLOCKED_IMAGE_HOSTS` in `helpers.ts`) currently lists `c.ndtvimg.com`, which answers 403. Images on these hosts are treated as missing at build time, so the placeholder shows at once. A section's feature slot goes to its highest-ranked story whose picture can load.
- **Sample banner:** fixture files carry `"fixture": true`. If any loaded edition has it, every page opens with an ink bar saying the stories are invented.

## Security and delivery

- Every string is escaped. Body text allows only `*italic*` and `[text](url)` links whose URL is http or https. External links get `target=_blank rel="noopener noreferrer nofollow"`.
- `_headers` sets a strict CSP (and `X-Robots-Tag: noindex, nofollow` only on fixture builds). Each page carries a canonical link to its measurededition.com URL. Scripts are `'self'` plus the SHA-256 of the single inline head script (`build.ts` computes it from `HEAD_SCRIPT`). Styles are `'self'` only, so no inline styles are allowed. Images are `img-src 'self' https: data:`, and frames come only from youtube-nocookie. It also sets nosniff, DENY framing, COOP, Referrer-Policy and Permissions-Policy. HTML gets `max-age=120`. `/assets/*` gets `immutable` for a year, because the CSS and JS names are content-hashed. `robots.txt` disallows everything, and each page carries `<meta name="robots" content="noindex, nofollow">`.
- `<img>` always has `referrerpolicy="no-referrer"`, `decoding="async"`, and a width and height. It also has `loading="lazy"`, except on the lead, top-story rows and the article hero, which get `fetchpriority="high"`.
- Don't add a second inline script: its hash would also have to be pinned in `_headers`.

## Data panels (added 2026-11-24)

Weather, Markets, AI & Software and Entertainment carry data panels next to their stories (`templates/panels.ts`). They follow the same system, with these additions:

- **Up and down.** Market changes use `--up` (#0a7a3d by day, #4cc27a at night) and `--down` (#c4122f / #f25a66). This is the one sanctioned use of green, and only for market direction; crimson stays the single accent everywhere else.
- **Every number says what it covers.** A quote tile shows the price and its date ("23 Nov close", or "Latest price" for bitcoin), then two labelled changes: "On the day" (bitcoin: "24 hours") and "Since <date>", each coloured by its own sign.
- **Real charts, not decoration.** Every chart covers the same calendar month, so tiles compare directly. The line is neutral (`--ink-2` with a faint area fill) and never coloured: colour belongs to the labelled numbers, so the chart can't seem to contradict them. A dashed line marks the starting level, the high and low sit on the right, the first and last dates below, and the latest close is a dot.
- **Room to read.** Quote tiles are one per row on phones, two at 600px and four at 1024px. Charts are 88px tall on phones and 76px on desktop.
- **Drawn icons.** Weather conditions use the authored 24px line icons in `panels.ts` (1.6 stroke, currentColor). No emoji or Unicode symbols stand in for icons, and counts are written as words ("3.5k stars").
- **Lists, not cards.** City forecasts, repositories, models, launches and songs are hairline-ruled lists. Market quotes are the one tile grid (`--surface`, 12px radius), because a quote board is the category standard.
- **Films are poster strips.** 2:3 posters (`--r-thumb`) in a horizontal scroll strip, 136px columns, with title, "Released"/"Out" date and language under each. The strip is `position: relative` so the screen-reader text inside it is clipped by its scroll box instead of widening the page. A film with no poster gets a quiet title block, not an empty box.
- **Trailers play in a dialog.** A film's "Trailer" link (crimson, with the drawn play triangle) and its poster open a native `<dialog>` holding a youtube-nocookie iframe that is created on click and removed on close. Esc, the backdrop and a drawn close button (44px target, top right) all close it. Story videos still play in place.
- **Satellite.** The infrared image is pinned to the scan time and drawn with an SVG overlay of city dots and labels (white with a dark halo). Political boundaries are deliberately left off; only coastlines show.
- **Every panel names its sources** in a `.panel-note` line.
