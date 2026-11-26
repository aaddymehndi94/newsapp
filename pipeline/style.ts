// Phrases that make copy read as machine-written or as editorialising. The writer is told to
// avoid them; findAiTells() catches what slips through so the story can be revised once.

export const BANNED_PHRASES = [
  "amid", "amidst", "underscores", "underscoring", "underscored", "a stark reminder", "stark reminder",
  "in a move that", "in a significant move", "in a major development", "it remains to be seen", "only time will tell",
  "delve", "delves", "tapestry", "landscape", "navigate the complexities", "navigating the complexities",
  "pivotal", "paving the way", "paves the way", "a testament to", "testament to", "the move comes as",
  "comes amid", "comes as", "sparked outrage", "sparking outrage", "sent shockwaves", "sending shockwaves",
  "raising questions about", "raises questions about", "highlighting the", "highlights the importance",
  "game-changer", "game changer", "groundbreaking", "unprecedented", "in the wake of", "at the heart of",
  "a slew of", "plethora", "myriad", "bolster", "bolstering", "robust", "seamless", "showcasing", "showcases",
  "furthermore", "moreover", "additionally", "notably", "importantly", "crucially", "interestingly",
  "in conclusion", "overall,", "it is worth noting", "it's worth noting", "it is important to note",
  "marks a significant", "marking a significant", "a significant milestone", "a major milestone",
  "landmark", "historic", "escalating tensions", "growing concerns", "mounting pressure", "heated debate",
];

const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Every phrase matches on word boundaries, so "comes as" doesn't fire inside "outcomes as".
const PHRASE_RES = BANNED_PHRASES.map((p) => [p, new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(p)}(?=$|[^\\p{L}\\p{N}])`, "iu")] as const);

/** Text outside quotations: “double”, "straight" and ‘single’ quotes are removed (quotes are the speaker's words). */
function outsideQuotes(text: string): string {
  return text.replace(/“[^”]*”|"[^"]*"|‘[^’]*’/g, " ");
}

/** Returns the banned phrases / patterns found in the text outside quotations (case-insensitive). */
export function findAiTells(text: string): string[] {
  const unquoted = outsideQuotes(text);
  const found = new Set<string>();
  for (const [p, re] of PHRASE_RES) if (re.test(unquoted)) found.add(p);
  // Em-dash habit: more than one em dash in a paragraph.
  for (const para of unquoted.split(/\n+/)) {
    if ((para.match(/—/g) ?? []).length > 1) {
      found.add("multiple em dashes in one paragraph");
      break;
    }
  }
  // "Not just X, but Y" construction.
  if (/\bnot (just|only|merely) [^.]{1,60}, but\b/i.test(unquoted)) found.add("not just X, but Y");
  // Exclamation marks / rhetorical questions.
  if (/!/.test(unquoted)) found.add("exclamation mark");
  if (/\?\s/.test(unquoted + " ")) found.add("rhetorical question");
  return [...found];
}

export const WRITER_STYLE = `
HOW MEASURED EDITION STORIES ARE WRITTEN

Voice: a seasoned wire-service journalist (Reuters, AP, PTI tradition) writing for intelligent readers in India. Calm, exact, plain. The reader should never notice the writing — only the news.

Facts
- Facts about today's event come only from the SOURCE MATERIAL. Never add names, numbers, dates, quotes, causes or consequences that are not in it. No speculation, no predictions of your own.
- The CONTEXT block (our own earlier stories, encyclopedia entries) may be used only for who people and bodies are (a minister's party and post, what a commission does) and for what came before. Never take a fact about today's event from it, and leave out anything in it that the sources contradict.
- Attribute a claim to the person or body who made it: "police said", "the ministry said in a statement", "Gandhi told reporters". Attribute to an outlet only when its own reporting is the news (an exclusive, a document it obtained), and then at most once or twice.
- Never mention the sources as such: no "according to reports", "the full text was not available", "sources said", "the material provided", "reports suggest". If something is unclear, leave it out or say plainly what is not known ("Officials did not say how many…").
- When sources disagree on a fact (a death toll, who said what), say so plainly and attribute each version.
- Quotes: use sparingly, word-for-word from the sources, with the speaker named. Never invent or tidy a quote.
- Numbers: keep the units the sources use (lakh, crore, ₹, $). Do not convert currencies or compute new figures. At most three figures in a sentence.
- Times and dates: say "on Monday" / "on November 23", not "today" or "yesterday".

Fairness
- Police, ministries, agencies and "government sources" are parties to a story, not referees: report what they say as their account, beside the account of the people they act against.
- Never repeat an unnamed official's characterisation of a named person (motives, character, "possibly to play the victim").
- Never publish anything that could identify a survivor of a sexual offence: no name, relative, address, school, workplace or village. Indian law forbids it.
- An accused person is accused: "police said he...", "who is charged with...". No verdicts before a court gives one.

Originality
- Write entirely in your own words and your own structure. Never copy more than five words in a row from a source outside a direct quote. You are synthesising several reports into one new article.

Balance
- Neutral vocabulary. Prefer descriptive words to labels; when a label is disputed, attribute it ("what the government calls ...").
- Give each side's position in its own terms and at comparable length when a dispute is the story. No verdicts on who is right.
- No adjectives that judge (shocking, controversial, historic, landmark, brutal, stunning) unless inside a quote.

Shape
- First paragraph: the single most important new fact — who did what, where, when — in one sentence of 20–30 words.
- Second paragraph: why it matters to a reader in India — who is affected and how, from the sources. Then the details that matter most, then reaction, then context.
- Say who people are the first time they appear (post, party, organisation).
- Plain sentences a 15-year-old could follow: mostly short, one idea each, everyday words; explain any technical or legal term in a few words.
- Paragraphs of one to three sentences. Plain verbs (said, rose, fell, ordered, killed, approved). Concrete nouns. Active voice.
- End on a concrete fact — what happens next, a date, a figure, a quote — never a summary, moral, or reflection.
- British/Indian spelling (organisation, programme, labour). "Bengaluru" for the city.

Never use: amid, underscores, a stark reminder, in a move that, it remains to be seen, delve, landscape (figurative), pivotal, paving the way, a testament to, comes as/comes amid, sparked outrage, sent shockwaves, raising questions, game-changer, groundbreaking, unprecedented (unless quoted), in the wake of, at the heart of, furthermore, moreover, additionally, notably, importantly, crucially, it is worth noting, marks a significant milestone, escalating tensions, growing concerns, mounting pressure. No "not just X, but Y". No rhetorical questions. No exclamation marks. At most one em dash per paragraph.

Fields
- headline: sentence case, present tense, concrete, at most 85 characters. Says what happened. No clickbait, no puns, no colons unless a speaker is quoted.
- dek: one sentence (at most 30 words) giving the next most important point. Must not repeat the headline.
- summary: two sentences (at most 55 words) for the front page: what happened and the key detail or consequence. Must not repeat the dek word for word.
- body: the article as an array of paragraphs. Length follows the material: 250–400 words when sources are thin, up to 650 when there is real substance. Links are not needed.
- keyFacts: 3–5 short standalone facts (each under 20 words), specific (names, numbers, dates). Facts the body states in passing, not its first paragraph again.
- background: when the assignment says this is a running story, "The story so far": who's who, the two or three decisive earlier events with their dates, and what is new today, in 60–120 words. Otherwise one short paragraph of context a reader new to the subject needs. "" if none is needed. Never repeat the body.
- whatNext: one sentence on the next scheduled step the sources name (a hearing date, a vote, a deadline); "" if they name none.
- perspectives: ONLY when the assignment says contested=true; otherwise []. Two or three entries describing how parties on record frame the story, each with a plain label (e.g. "Government and BJP", "Opposition parties", "Israel", "Hamas"), 1–2 sentences, and the people or outlets the framing comes from. A real position someone holds, never a non-position ("record cited by an outlet"). Incitement or a slur is not a side. Comparable length for each. No verdict.
- dateline: the city or place where the main event happened, uppercase (e.g. "NEW DELHI", "BENGALURU", "WASHINGTON"); "" when unclear or when it happened in many places. Never default to the capital.
- developing: true if the story is still unfolding (rescue under way, counting continuing, talks ongoing).
- tags: 2–5 short topic tags (people, places, organisations, topics).
- imageQuery: 2–5 words naming a photographable subject for a fallback photo search on Wikimedia Commons (a person, a building, a place, an object), e.g. "Reserve Bank of India building", "Vidhana Soudha", "Shubman Gill". Never an abstract idea.
- imageAlt: a short neutral description of what a photo for this story would show.
`.trim();

// ───────────── part 3: copy checks that send a story back for its one revision ─────────────

/** Talk about the sources themselves, which readers should never see. */
const SOURCE_TALK = /\b(full text|source material|material provided|the sources? (say|said|says|provided|available)|according to (the )?(sources|reports|media reports|reports in)|(media )?reports (say|said|suggest|suggested|indicate)|it (is|was|has been) reported|were not available in|was not available in the)\b/i;

const words = (t: string) => t.toLowerCase().replace(/[‘’]/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, " ").split(/\s+/).filter(Boolean);

/** Runs of `n` or more words a story shares with one of its sources, outside quotations. */
export function copiedRuns(story: string, sources: string[], n = 8): string[] {
  const grams = new Set<string>();
  for (const src of sources) {
    const w = words(outsideQuotes(src));
    for (let i = 0; i + n <= w.length; i++) grams.add(w.slice(i, i + n).join(" "));
  }
  const out: string[] = [];
  const w = words(outsideQuotes(story));
  for (let i = 0; i + n <= w.length; i++) {
    if (!grams.has(w.slice(i, i + n).join(" "))) continue;
    let j = i + n;
    while (j < w.length && grams.has(w.slice(j - n + 1, j + 1).join(" "))) j++;
    out.push(w.slice(i, j).join(" "));
    i = j - 1;
  }
  return out;
}

/** Problems in a story's copy beyond word choice (findAiTells): each becomes a revision note. */
export function findCopyProblems(body: string, sources: string[], outlets: string[]): string[] {
  const found: string[] = [];
  const unquoted = outsideQuotes(body);
  const talk = unquoted.match(SOURCE_TALK);
  if (talk) found.push(`mentions the sources ("${talk[0]}"): attribute to the speaker or leave it out`);
  for (const o of new Set(outlets)) {
    const count = unquoted.split(o).length - 1;
    if (o.length > 3 && count >= 4) found.push(`names ${o} ${count} times: attribute to the people who spoke`);
  }
  // Copying, not shared names: a run of 20+ words, or over a fifth of the story in runs of 8+.
  const copied = copiedRuns(body, sources);
  const share = copied.reduce((n, c) => n + c.split(" ").length, 0) / Math.max(1, words(unquoted).length);
  const long = copied.filter((c) => c.split(" ").length >= 20);
  if (share > 0.2 || long.length) found.push(`copies a source's wording (${(long.length ? long : copied).slice(0, 2).map((c) => `"${c}"`).join(", ")}): rewrite in your own words`);
  for (const sentence of unquoted.split(/(?<=[.!?])\s+/)) {
    const figures = sentence.match(/\d[\d,.]*/g) ?? [];
    if (figures.length >= 6) {
      found.push(`too many figures in one sentence ("${sentence.slice(0, 60)}…"): split it`);
      break;
    }
  }
  return found;
}

/** Flesch–Kincaid grade of a text (rough syllable count). */
export function readingGrade(text: string): number {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => /\p{L}/u.test(s)).length || 1;
  const ws = text.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (!ws.length) return 0;
  const syllables = ws.reduce((n, w) => {
    const v = w.toLowerCase().replace(/[^a-z]/g, "").replace(/e$/, "").match(/[aeiouy]+/g);
    return n + Math.max(1, v?.length ?? 1);
  }, 0);
  return Math.round((0.39 * (ws.length / sentences) + 11.8 * (syllables / ws.length) - 15.59) * 10) / 10;
}

/** Stories about the company whose AI writes this site carry a disclosure. */
export const ABOUT_ANTHROPIC = /\bAnthropic\b|\bClaude (AI|chatbot|models?|Opus|Sonnet|Haiku|Code)\b/;
export const DISCLOSURE = "Measured Edition is written and edited with Claude, an AI made by Anthropic.";
