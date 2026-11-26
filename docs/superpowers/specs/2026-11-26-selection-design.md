# Part 2: how stories are chosen — design for approval

Status: **approved by the owner on 2026-11-26** ("i approve all parts"). Part 1 (sources) shipped on 2026-11-26.
Evidence: `docs/retro/2026-11-25-editorial-retrospective.md` (selection desk findings).

## Why

The owner wants every headline to get an equal chance, importance judged like a serious newspaper,
and no outlet with an incentive setting the agenda. The retrospective found:
- Two editor runs on the same news agreed on 1 of 4 leads and about 4 stories in 10.
- Volume of coverage was taken for importance: a CEO saga led two days running while the Iran war,
  a Yemen strike that killed 26 and a UN femicide report on the UN day against it were left out.
- Courts, rights and press freedom stories were offered and passed over; national voter-roll
  stories were filed under single cities.
- Fixed section quotas forced filler on quiet days and squeezed busy sections.

## Goals, non-goals, anti-goals

- Goals: an edition a careful reader would defend story by story; the same news gives nearly the
  same edition; important stories with thin coverage get in; caps on any one owner's influence.
- Non-goals: personalisation, engagement metrics, more stories per day.
- Anti-goals: an edition that is "balanced" by formula but misses the day's biggest news; a
  rubric so rigid that the editor can't use judgment.

## Approaches

- **A. Prompt only:** add a scoring rubric and rules to the editor's instructions. Cheapest, but the
  editor reads 1,300 headlines in feed order and still has to spot events itself, which is where the
  instability comes from.
- **B. Group headlines into events in code, then the editor judges events (recommended).** Before the
  editor sees anything, headlines that share most of their key words are grouped into events (the
  same matcher the coverage search uses). The editor sees ~400 events, each with how many outlets
  and owners carry it, which tiers, and when it broke, instead of 1,300 loose headlines. It scores
  each candidate on a short rubric; code ranks by score, applies caps and fills sections.
- **C. Two editors:** Sonnet groups and scores everything, Opus picks from the top 150. Most thorough,
  about $0.10–0.15 more a day, and two models' judgments to reconcile.

B fixes the cause (the editor clustering 1,300 headlines in its head) for no extra cost; A doesn't;
C costs more for a gain B should mostly capture.

## Design (approach B)

1. **Events, built in code.** Union headlines from the gathered items whose key words overlap
   strongly (≥3 shared and ≥50%), within 36 hours. Each event shows: a representative headline,
   outlets and distinct owners, tiers present, first seen, regions. Wire-only and single-outlet
   events stay in, marked, so under-covered news is visible rather than lost.
2. **Rubric (editor fills it):** consequence (how many people, how much), effect on India,
   newness (a real development, not a restatement), public interest (accountability, rights,
   safety, money), and an "under-covered" flag (exclusive, court ruling, official data, regional
   report). Breadth of coverage is shown, but the prompt says it is evidence, not a verdict.
3. **Ranking and sections in code:** code orders by rubric total (ties by breadth of independent
   owners), then fills sections within ranges instead of quotas (India 7–11, World 7–11, each city
   2–4, Business 4–6, …). The editor returns ranked reserves per section, used when a story is
   dropped as too thin.
4. **Caps in code:** no owner is the first source of more than 15% of stories; at most two stories
   per running saga; the corroborate-only rules from part 1 stay.
5. **Accountability floor:** at least two court or rights stories, one from outside the metros, and
   any credible report of state action against a journalist. Code checks and logs when unmet; the
   prompt requires the editor to look for them.
6. **Consistency check:** once a week, run the editor twice on the same events (about $0.25) and log
   the overlap of leads and stories. Target: 3 of 4 leads and 7 stories in 10.

## Cost

Grouping is free. The editor's input should shrink (events instead of headlines) or stay near 60K
tokens; scores add about 3K output tokens (~$0.03 a day at batch prices). The weekly check is
about $1 a month.

## Left to the builder

Exact matcher thresholds (tune on two days of saved items), the event listing format, and the
section ranges' exact numbers (start from the current quotas ±2).

## Next parts (separate approvals)

- Part 3, writing: "The story so far" background, attribution to speakers not outlets, plainer
  sentences (grade 9–10), no notes about sources in the copy, a disclosure on stories about
  Anthropic.
- Part 4, the daily under-reported piece (owner chose this over document digs), about $0.13 a day.
