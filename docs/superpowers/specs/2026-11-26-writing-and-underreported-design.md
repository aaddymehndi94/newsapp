# Parts 3 and 4: how stories are written, and the daily under-reported piece

Status: **approved by the owner on 2026-11-26** ("i approve all parts. go ahead fixing
everything"), from the outlines in `docs/retro/2026-11-25-editorial-retrospective.md` and the part 2
design (`2026-11-26-selection-design.md`, also approved). The details below are my calls, made
without further questions because the owner asked me to go ahead.

## Part 3: writing

Why: the retrospective found the copy accurate but thin. It doesn't say who people are or what came
before. It talks about its own sources ("the full text was not available"), names one outlet four
or more times, copies up to 55% of a single source's wording, and reads at about grade 12.

What changes:
- **Context block.** Facts about today's event still come only from today's sources. Two kinds of
  background may come from a CONTEXT block, for identity and history only:
  - our own stories from the last 14 days on the same subject (headline, summary, background);
  - the lead section of the English Wikipedia article for up to three people or bodies the editor
    names. These are read from /wiki/ pages, which Wikipedia's robots.txt allows; a disambiguation
    or missing page is skipped.
- **"The story so far"** replaces Background on running stories (the editor marks them with a
  saga). It covers who's who, the two or three decisive earlier events with dates, and what is new
  today, and it is shown before the body. Other stories keep a short Background after the body.
- **Shape.** The first paragraph is 20–30 words. Paragraph 2 says why it matters to a reader in
  India. `whyItMatters` is dropped as a field, though older editions still show it. A new
  `whatNext` field holds the next scheduled step from the sources, or "".
- **Copy rules (prompt):**
  - Attribute to the speaker, not the outlet.
  - Never mention the sources as such.
  - No more than five copied words in a row outside quotes.
  - At most three figures in a sentence.
  - Plain sentences, about grade 9–10.
  - The dateline is where the event happened, or "" (never a default NEW DELHI).
  - Perspectives only for parties on record. Incitement is not a side.
- **Fairness rules (prompt):**
  - Police, ministries and "government sources" are parties, not referees.
  - No unnamed official's characterisation of a named person.
  - Nothing that could identify a survivor of a sexual offence.
- **Checks in code.** These send a story back for its one existing revision:
  - talk about sources ("according to reports", "full text", "the source material");
  - an outlet named three or more times in the body;
  - a run of 8 or more words copied from one source outside quotes (the prompt asks for 5;
    8 in code avoids false alarms on stock phrases);
  - a sentence with five or more figures.

  Each story's reading grade is logged, and the edition records the average.
- **Disclosure.** A story that mentions Anthropic or Claude (the company or its AI) carries a note:
  "Measured Edition is written and edited with Claude, an AI made by Anthropic."
- **Standards page** (/standards/, linked in the footer): how stories are chosen and written, the
  tiers, the fairness rules, the AI disclosure.

## Part 4: the daily under-reported piece

Why: the field test found about one strong story a day that mainstream outlets didn't run (an RTI
reply, an official dataset, a court filing, a regional report). The owner chose this over
document digs.

Approaches considered:
- **A. Ask the editor to flag one.** It is free, but the editor can't see what the mainstream
  didn't run.
- **B. Measure it in code, then triage, write and fact-check with models (chosen).** About $0.13
  a day.
- **C. Dig into primary documents (PDFs, dashboards) automatically.** Too fragile, and it was
  turned down by the owner in favour of B.

How it works:
1. **Candidates.** Items from independent and specialist outlets in the gathered library (The Wire,
   Scroll, The News Minute, Newslaundry, The Quint, ThePrint, Frontline, Down To Earth, LiveLaw, Bar
   & Bench, Alt News, BOOM, Factly, South First, Citizen Matters, Mongabay India, IndiaSpend and
   Article 14 when we carry them). An item is a candidate when no mainstream outlet in the library
   (Times group, HT, The Hindu, Indian Express, NDTV, News18, India Today, Business Standard, Mint,
   Deccan Herald, Outlook) has a headline matching it, and the edition hasn't already picked it.
2. **Read.** The pages of the 12 most promising candidates are read (free). Promise is judged by
   signal words: RTI, data, order, petition, report, survey, audit, filing.
3. **Triage (Opus, direct).** Pick at most one: public interest, rests on a document or record that
   can be checked, new, not opinion. Or "none today". The answer names the checkable claims.
4. **Write (Sonnet).** A short piece (350–600 words) under the label
   "Measured Edition analysis, based on reporting by <outlet>". It says what the record shows and
   what we could not check, and it carries no claims beyond the source.
5. **Fact-check (Sonnet).** Every factual sentence is checked against the source text. An
   unsupported claim leads to one revision; if one is still unsupported, there is no piece today.
6. **Show.** On the front page, a labelled "Under-reported" block sits after the top stories. The
   article page carries the label and the "based on reporting by" line, and the piece sits in its
   subject's section with the same label.

Anti-goals: a daily piece for its own sake ("none today" is fine); campaigning; anything that rests
on one unverifiable claim.
