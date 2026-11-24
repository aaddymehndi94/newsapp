---
name: Meridian
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

# Design System: Meridian

<!-- impeccable:design-map -->
Name: Meridian
Colors: primary: accent #c4122f; neutral: on-accent #ffffff; primary: accent-night #f25a66; primary: accent-fill #c4122f; primary: accent-fill-night #d0283a; neutral: ground #ffffff (+19 more in the sidecar)
Fonts: Source Serif 4 (wordmark, headline-story, headline-lead, headline-feature, headline-row, body-article, dek, summary); Schibsted Grotesk (section-title, box-title, tab, ui, meta)
Spacing: gutter-phone 16px, gutter-tablet 24px, gutter-desktop 32px, row 16px, column-gap 40px, grid-gap 32px, section-phone 32px, section-desktop 48px
Radius: focus 4px, thumb 8px, pic 10px, box 12px, pill 999px
North Star: "The Straight Edition"
Rules:
- The One Crimson Rule. The accent appears only in its listed roles: the section label in meta, Developing, links in running text, key-fact bullets, the active tab, the Latest badge, and focus, caret and selection.
- The White-On-Fill Rule. White text sits only on accent-fill, never on the text accent.
- The No-Tint Rule. The greys are true neutrals (R = G = B).
- The Serif Speaks, Sans Serves Rule. Headlines and anything you read as prose are serif.
- The No-Kicker Rule. Nothing sits above a headline.
- The Own-Shape Rule. Large pictures (lead, feature, article hero) take the aspect-ratio class nearest the photo's own shape: 4:3, 3:2, 16:9 or 2:1.
- The Flat Card Rule. Story cards are never raised, boxed or filled.
Elevation:
- Float: 0 1px 2px rgb(0 0 0 / 0.08), 0 4px 12px rgb(0 0 0 / 0.08)
Don't:
- Don't add eyebrows or kickers above headlines.
- Don't colour left/right politics, or colour-code sections.
- Don't dim, grey or desaturate read cards.
- Don't add inline `style=""` attributes (the CSP forbids them).
- Don't use the crimson outside its listed roles: not on headlines, rules, backgrounds or decorative icons.
- Don't tint the greys or move the night ground toward blue-grey.
- Don't crop large pictures to a house ratio.
- Don't bring back neatlines, legend keys or other ornament that does not help the reader find their way.
- Don't add a second inline script: its hash would also have to be pinned in `_headers`.
Map: build.ts
Map: schema.ts
Map: templates/helpers.ts
Map: templates/layout.ts
Map: templates/front.ts
Map: assets/site.css
Map: assets/site.js
Map: assets/fonts/
Full: .impeccable/design-full.md (read a section when you need its detail)
