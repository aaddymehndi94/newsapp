// Runtime validation of edition JSON. Editions are machine-written (LLM + feeds), so the
// renderer validates defensively: a malformed story is dropped with a warning instead of
// failing the whole site, and ids that become file paths are restricted to safe slugs.

import { z } from "zod";
import type { Edition, Story } from "./types.ts";

const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;

const httpUrl = z.string().refine((v) => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}, "must be an http(s) URL");

const ImageSchema = z.looseObject({
  url: httpUrl,
  credit: z.string().default(""),
  sourceUrl: z.string().default(""),
  alt: z.string().default(""),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  kind: z.enum(["outlet", "wikimedia"]).catch("outlet"),
});

const VideoSchema = z.looseObject({
  youtubeId: z.string().regex(/^[A-Za-z0-9_-]{6,20}$/),
  title: z.string().default(""),
  channel: z.string().default(""),
});

const SourceSchema = z.looseObject({
  outlet: z.string().min(1),
  title: z.string().default(""),
  url: z.string().default(""),
  leaning: z.enum(["left", "centre-left", "centre", "centre-right", "right"]).optional().catch(undefined),
});

const PerspectiveSchema = z.looseObject({
  label: z.string().min(1),
  summary: z.string().min(1),
  outlets: z.array(z.string()).default([]),
});

export const StorySchema = z.looseObject({
  id: z.string().regex(SLUG, "story id must be a lowercase slug"),
  section: z.string().min(1),
  rank: z.number(),
  headline: z.string().min(1),
  dek: z.string().default(""),
  summary: z.string().default(""),
  body: z.array(z.string()).default([]),
  keyFacts: z.array(z.string()).default([]),
  background: z.string().optional(),
  whyItMatters: z.string().optional(),
  perspectives: z.array(PerspectiveSchema).optional().catch(undefined),
  dateline: z.string().optional(),
  developing: z.boolean().optional(),
  // A bad image or video should cost the story its picture, not its place in the edition.
  image: ImageSchema.optional().catch(undefined),
  video: VideoSchema.optional().catch(undefined),
  sources: z.array(z.unknown()).default([]),
  tags: z.array(z.string()).default([]),
  readingMinutes: z.number().nonnegative().default(1),
});

export const EditionSchema = z.looseObject({
  id: z.string().regex(SLUG, "edition id must be a lowercase slug"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => {
      const t = new Date(`${d}T12:00:00Z`);
      return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
    }, "not a real calendar date"),
  slot: z.enum(["morning", "evening"]),
  publishedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "publishedAt must be ISO 8601"),
  lead: z.array(z.string()).default([]),
  sections: z
    .array(z.looseObject({ id: z.string().min(1), name: z.string().min(1), storyIds: z.array(z.string()).default([]) }))
    .default([]),
  stories: z.array(z.unknown()),
  stats: z
    .looseObject({
      feedsScanned: z.number().default(0),
      itemsSeen: z.number().default(0),
      pagesRead: z.number().default(0),
      costUsd: z.number().default(0),
    })
    .default({ feedsScanned: 0, itemsSeen: 0, pagesRead: 0, costUsd: 0 }),
  fixture: z.boolean().optional().catch(undefined),
});

export interface ParseResult {
  edition: Edition | null;
  warnings: string[];
}

/** Validate one edition. Returns null when the edition itself is unusable. */
export function parseEdition(raw: unknown, label: string): ParseResult {
  const warnings: string[] = [];
  const top = EditionSchema.safeParse(raw);
  if (!top.success) {
    return { edition: null, warnings: [`${label}: invalid edition — ${z.prettifyError(top.error)}`] };
  }
  const stories: Story[] = [];
  const seen = new Set<string>();
  top.data.stories.forEach((s, i) => {
    const r = StorySchema.safeParse(s);
    if (!r.success) {
      warnings.push(`${label}: dropped story #${i} — ${z.prettifyError(r.error)}`);
      return;
    }
    if (seen.has(r.data.id)) {
      warnings.push(`${label}: dropped duplicate story id "${r.data.id}"`);
      return;
    }
    seen.add(r.data.id);
    const sources = r.data.sources.flatMap((src) => {
      const p = SourceSchema.safeParse(src);
      return p.success ? [p.data] : [];
    });
    stories.push({ ...r.data, sources } as unknown as Story);
  });
  if (stories.length === 0) {
    return { edition: null, warnings: [...warnings, `${label}: no usable stories`] };
  }
  const ids = new Set(stories.map((s) => s.id));
  const edition = {
    ...top.data,
    lead: top.data.lead.filter((id) => ids.has(id)),
    sections: top.data.sections.map((sec) => ({ ...sec, storyIds: sec.storyIds.filter((id) => ids.has(id)) })),
    stories,
  } as unknown as Edition;
  return { edition, warnings };
}
