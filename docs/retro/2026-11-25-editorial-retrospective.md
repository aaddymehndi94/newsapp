# Measured Edition: editorial retrospective, 24–25 November 2026

Three editions reviewed: 24 Nov (54 stories), and two independent runs on the morning of 25 Nov
(laptop, 65 stories; GitHub, 67 stories, the one published). Five reviewers each took one desk:
sources, selection, copy, fairness (readers' editor), and an under-reported-story field test.
Their working files are in the session scratchpad (`retro/`); this is the synthesis.

## The verdict in one paragraph

The writer does not invent facts: every number in 65 stories was checked against the source text
and none was made up. Everything around the writing is weaker. The editor's choices are partly
chance (two runs on the same news agreed on 1 of 4 leads and about 4 in 10 stories). It never sees
about a third of each day. It mistakes volume of coverage for importance. One newspaper group, the
Times group, sets much of the Indian and city agenda and much of the framing. Courts, rights and
accountability stories reach the editor rarely and are usually passed over. And the copy tells
readers what happened without telling them who the people are or why it matters.

## What went wrong, ranked

1. **Selection is unstable.** Same code, same news, five hours apart: 1 of 4 leads matched, 27 of
   65 stories matched, cities 2 of 19, science 0 of 4. At least 18 stories picked in one run were
   on the other run's menu and passed over. Below the top ten the edition is close to a lottery.
2. **A daily blind spot.** The gather looks back a fixed 16 hours and keeps only the newest 16
   items per feed. With a 03:37 IST start, roughly 03:40–11:40 IST of every day is never shown; for
   busy newsrooms the cap shrinks the window to 2–5 hours (The Hindu 3.8 h, Reuters 4.5 h). New
   Indian Express city copy (posted 05:30–08:30) is never seen, so TOI fills the cities by default.
3. **The Times group dominates.** TOI is 6% of headlines offered but the first source on 14 of 67
   stories and the only source on 5. With ET (same owner) it is first on 36% of India, city and
   business stories. It is 50% of what the editor sees for Chennai and Hyderabad. And because it is
   labelled "centre-right", it fills half the right-of-centre slots in the balance rule.
4. **Volume is mistaken for importance.** The Nvidia boss saga (72 headlines, 29 outlets) led both
   days. The Iran war (18 reports, 12 outlets) got nothing on 25 Nov; also missed: the Merz–Modi
   call, a Yemen strike that killed 26, a Colombia car bomb, a UN femicide report on the UN day
   against violence on women.
5. **Accountability is missing.** No press-freedom story in any edition though three were offered.
   Courts appear only as tie-ins. Voter-roll exclusions of national scope were filed under single
   cities. The Supreme Court day of 24 Nov fell in the blind spot.
6. **Framing follows the source mix.** The same passport story about a government critic carried an
   unnamed officer saying he went to the airport "possibly so he could play the victim" when built
   from TOI copy, and did not when built from The Hindu, BBC and Indian Express. Police versions are
   relayed unexamined; one sexual-offence story narrowed down the survivor's identity.
7. **Balance is manufactured.** At least 8 perspective entries are non-positions ("Legislative
   record cited by The Times of India"); a minister's incitement was boxed as a "side"; party organs
   (Organiser) fill the right-of-centre slot when TOI is absent.
8. **The copy lacks context.** Stories omit who people are (a minister's party), what came before
   (who killed Rajiv Gandhi, what set off the Kuki–Naga clashes), and why today is new. Background
   averages 46 words and is often jargon or repetition. 27% of source items gave the writer a
   headline only.
9. **The copy talks about its sources.** About 20 stories leak notes like "the full text was not
   available" or "according to the sources"; 83 of 186 name an outlet four or more times; single-
   source stories copy up to 55% of their source's wording.
10. **Repetition and density.** Key facts and summary repeat the body in about 60% of stories;
    "why it matters" is often filler; median lede 36 words; reading grade about 12; NEW DELHI is
    used as a default dateline for stories that happened elsewhere.
11. **Rules we broke.** Google News's robots.txt bars `/rss/` to every reader; 17 feeds used it, and
    CNA and The Register barred us too. The feed reader never checked robots.txt (only the article
    reader did). Fixed on 25 Nov (`444e2cf`).
12. **Bugs.** The Kolkata Telegraph was shown as centre-right (it inherited the UK Telegraph's
    label). Stories about Anthropic, which makes the AI that writes them, carry no disclosure.

## Already fixed (25 Nov)

- Robots.txt checked before every feed fetch; 19 barred feeds removed (`444e2cf`).
- GitHub-only scheduling with three start times and a skip guard, after a 6h44m-late start made
  the edition twice (`7c0871b`).

## What to change

**Sources (foundation).** Judge outlets on reliability and conflicts, not only left/right: add
`tier` (primary, wire, core, corroborate, perspective) and `owner`, count one owner as one outlet,
and enforce in code that TOI/ET, NDTV (Adani) and News18 are corroboration only, never the first or
only source. Drop Organiser, Firstpost and duplicate national feeds. Add PTI directly (1,181 stories
a day via its news sitemap), ThePrint, The Wire, The Quint, The News Minute, Newslaundry, LiveLaw,
Bar & Bench, Down To Earth, Frontline, fact-checkers (Alt News, BOOM, Factly), RBI, BBC India, and
per-city sets led by The Hindu, Indian Express, HT, Deccan Herald, NIE, DT Next, Mid-Day, Free Press
Journal, Onmanorama, Mathrubhumi English, South First and Citizen Matters. Read new articles from
outlets' news sitemaps where robots.txt allows. Look back to the previous gather, not 16 hours.
Lost for good: Reuters, AP, The Telegraph (Kolkata), The Statesman (all bar us).

**Selection.** Group headlines into events before the editor sees them, so it judges ~300 events
instead of 1,900 headlines in feed order. Give each outlet one budget sampled across the whole day.
Score events on consequence, effect on India, newness and public interest; treat breadth of
coverage as a signal, not a verdict; require an under-covered check (exclusives, rulings, data,
regional news). Sections become ranges, not quotas, and the editor returns ranked reserves to
replace stories that turn out too thin. Enforce caps in code (no outlet first on more than 15% of
stories; at most two stories per running saga). Accountability rule: at least two court or rights
stories, one from beyond the metros, and any credible report of state action against a journalist.
Measure consistency weekly by running the editor twice.

**Writing.** Facts about today's event only from today's sources; identity and history may also come
from a CONTEXT block (our own earlier stories on the subject, Wikipedia's lead section for named
people and bodies). Background becomes "The story so far": who's who, the two or three decisive
earlier events with dates, and what is new today, shown before the body on running stories. Ledes
20–30 words; paragraph 2 says why it matters to a reader in India; attribute to the speaker, not the
outlet; never mention the sources as such; no more than five copied words in a row; at most three
figures a sentence; dateline where it happened; perspectives only for parties on record, incitement
is not a side. Reading level grade 9–10. Drop `whyItMatters` as a field (fold into paragraph 2);
add `whatNext`. Disclose on stories about Anthropic.

**Fairness.** Police, ministries and "government sources" are parties, not referees. No unnamed
official's characterisation of a named person. Nothing that identifies a sexual-offence survivor.
Publish a short standards note.

**The daily under-reported piece.** The field test found five strong candidates for 20–25 Nov that
no mainstream outlet ran (the Election Commission's Bengal dashboard showing a hard-coded figure,
which we reproduced from the public code; transgender voters falling 30.8% in the roll revision;
kala-azar in a state counted as free of it; a 1.4 GW data centre at a dam in a drought district;
the bullet train's cost nearly doubling, from an RTI). About one strong candidate a day; allow "no
piece today". Process: collect from independent outlets and fact-checkers; score under-reported
against a corpus of mainstream outlets' news sitemaps; triage, pick, verify against primary
documents, write, then fact-check; label "Measured Edition analysis, based on reporting by …".
Estimated cost about $0.13 a day with batch pricing.
