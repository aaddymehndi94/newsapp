import type { FeedItem } from "./feeds.ts";
import type { PageInfo } from "./enrich.ts";
import type { SlatePick } from "./editor.ts";
import { SECTION_NAMES } from "./editor.ts";
import { WRITER_MODEL, type JsonRequest } from "./llm.ts";
import { WRITER_STYLE } from "./style.ts";

export interface WrittenStory {
  headline: string;
  dek: string;
  summary: string;
  body: string[];
  keyFacts: string[];
  background: string;
  whyItMatters: string;
  perspectives: { label: string; summary: string; outlets: string[] }[];
  dateline: string;
  developing: boolean;
  tags: string[];
  imageQuery: string;
  imageAlt: string;
}

export const STORY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline", "dek", "summary", "body", "keyFacts", "background", "whyItMatters",
    "perspectives", "dateline", "developing", "tags", "imageQuery", "imageAlt",
  ],
  properties: {
    headline: { type: "string" },
    dek: { type: "string" },
    summary: { type: "string" },
    body: { type: "array", items: { type: "string" } },
    keyFacts: { type: "array", items: { type: "string" } },
    background: { type: "string" },
    whyItMatters: { type: "string" },
    perspectives: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "summary", "outlets"],
        properties: { label: { type: "string" }, summary: { type: "string" }, outlets: { type: "array", items: { type: "string" } } },
      },
    },
    dateline: { type: "string" },
    developing: { type: "boolean" },
    tags: { type: "array", items: { type: "string" } },
    imageQuery: { type: "string" },
    imageAlt: { type: "string" },
  },
};

const WRITER_SYSTEM = `You write news stories for Meridian, a non-partisan news site read in India. You receive an assignment from the editor and the reporting of several outlets on one event. Synthesise them into one original, accurate, balanced story.

${WRITER_STYLE}`;

const PER_SOURCE_CHARS = 7000;
const TOTAL_CHARS = 22000;

export function sourceDocs(pick: SlatePick, items: Map<string, FeedItem>, pages: Map<string, PageInfo>): string {
  let budget = TOTAL_CHARS;
  const docs: string[] = [];
  pick.itemIds.forEach((id, i) => {
    const it = items.get(id);
    if (!it) return;
    const page = pages.get(id);
    let text = page?.text ?? "";
    const room = Math.max(0, Math.min(PER_SOURCE_CHARS, budget));
    if (text.length > room) text = text.slice(0, room).replace(/\s+\S*$/, "") + " …";
    budget -= text.length;
    const summary = it.summary || page?.description || "";
    docs.push(
      `<source n="${i + 1}" outlet="${it.outlet}" leaning="${it.leaning}" published="${it.published ?? "unknown"}">
TITLE: ${it.title}
${summary ? `SUMMARY: ${summary}\n` : ""}${text ? `TEXT:\n${text}` : "(full text not available — headline/summary only)"}
</source>`,
    );
  });
  return docs.join("\n\n");
}

export function buildWriterRequest(pick: SlatePick, docs: string, editionLabel: string): JsonRequest {
  const user = `ASSIGNMENT
Edition: ${editionLabel} (India Standard Time)
Section: ${SECTION_NAMES[pick.section]}
Working headline: ${pick.workingHeadline}
Angle: ${pick.angle}
contested=${pick.contested}

SOURCE MATERIAL
${docs}

Write the story.`;
  return {
    customId: `story:${pick.key}`,
    model: WRITER_MODEL,
    system: WRITER_SYSTEM,
    user,
    schema: STORY_SCHEMA,
    effort: "medium",
    maxTokens: 16000,
  };
}

export function buildRevisionRequest(pick: SlatePick, story: WrittenStory, tells: string[], docs: string, editionLabel: string): JsonRequest {
  const base = buildWriterRequest(pick, docs, editionLabel);
  return {
    ...base,
    customId: `revise:${pick.key}`,
    effort: "low",
    user: `${base.user}

A draft of this story was written, but an editor flagged wording that reads as machine-written or editorialising: ${tells.join("; ")}.
Rewrite the affected sentences in plain, specific newsroom language (keep everything else the same unless it also breaks the style rules). Return the full corrected story.

DRAFT
${JSON.stringify(story, null, 1)}`,
  };
}

export function storyText(s: WrittenStory): string {
  return [s.dek, s.summary, ...s.body, s.background, s.whyItMatters, ...s.keyFacts].join("\n");
}
