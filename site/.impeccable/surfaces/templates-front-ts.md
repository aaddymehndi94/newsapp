---
version: 1
slug: "templates-front-ts"
primary_target: "templates/front.ts"
related_targets: ["templates/article.ts","templates/archive.ts","templates/layout.ts"]
---

# Reader site (front, article, archive)

Scope: the whole reader site. Mode: Read. Platform: web, phone first.
Audience/job: one reader in Bengaluru, mostly on a phone, twice a day: scan the edition's headlines with a picture and a 3–4 line summary each, open what matters, come back to the same place, see what's already read.
Owner feedback driving this round (2026-11-24): the 05:00/17:00 strip looked weird; section tabs didn't look like tabs or scrollable; lead photo cropped on phone; read stories went grey (wants a tick); dark theme's grey-blue was unappealing (wants real contrast); light theme roughly OK; thumbnail for every headline.
Owner choices: "Standard news app" direction (the category standard, played straight); benchmarks BBC News app + NYT / The Hindu app; front density headline + 3–4 lines.

## Direction contract

THESIS: The standard news app, played straight at the BBC News / NYT / The Hindu app craft level: serif headlines inside a clean modern app layout, one finite edition read top to bottom. Refuses the old survey-sheet apparatus (neatline, legend keys, grey-blue night) and any ornament that is not wayfinding.

OWN-WORLD: White day ground and near-black (#111) night ground, neutral greys with zero blue tint, black/white ink, one crimson accent reserved for the active tab, section labels, links and Developing. Source Serif 4 bold headlines, Schibsted Grotesk for every UI string. Solid pill tabs, hairline rules between stories, softly rounded photos, a drawn check for read state.

STORY: The reader sees the date and edition, scans the lead and top stories (picture + 3–4 lines each), jumps by section with tabs, opens a story, goes back to the same spot, and sees a tick on everything already read.

FIRST VIEWPORT (390x844): wordmark left, theme button right; edition line (Morning edition · date · time, All editions); sticky pill tab bar, Top stories filled in ink, later pills cut at the right edge under a fade with a scroll chevron; lead photo full width at its own aspect ratio, uncropped; 28px serif bold headline, summary, meta.

FORM: canon (the standing exit, chosen by the owner), benchmarked to BBC News app + NYT/The Hindu app. seed:4d6348bd38542e38. Signature interaction: the tab bar follows the section in view and keeps the active pill centred; Back restores the exact scroll spot; read ticks appear on return.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
