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
  storySoFar: z.boolean().optional().catch(undefined),
  whyItMatters: z.string().optional(),
  whatNext: z.string().optional(),
  notChecked: z.string().optional(),
  disclosure: z.string().optional().catch(undefined),
  special: z
    .looseObject({ kind: z.literal("under-reported"), label: z.string().min(1), basedOn: z.array(z.string()).default([]) })
    .optional()
    .catch(undefined),
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

// ───────────── data panels ─────────────
// Each list item is validated on its own: a bad row is dropped, a bad panel is dropped, and
// the edition still renders. Links and pictures must be http(s).

const num = z.number().refine(Number.isFinite);
const rows = <T extends z.ZodType>(item: T) =>
  z.array(z.unknown()).transform((xs) => xs.flatMap((x) => {
    const r = item.safeParse(x);
    return r.success ? [r.data as z.infer<T>] : [];
  }));

const Day = z.looseObject({ date: z.string(), max: num, min: num, code: z.number().int(), rainChance: num });
const WeatherPanelSchema = z.looseObject({
  fetchedAt: z.string(),
  cities: rows(
    z.looseObject({
      name: z.string().min(1),
      lat: num,
      lon: num,
      today: Day,
      tomorrow: Day.optional().catch(undefined),
      aqi: z.looseObject({ value: num, category: z.string(), pm25: num, pm10: num }).optional().catch(undefined),
    }),
  ),
  satellite: z
    .looseObject({
      url: httpUrl,
      width: z.number().positive(),
      height: z.number().positive(),
      time: z.string(),
      bbox: z.tuple([num, num, num, num]),
      credit: z.string(),
    })
    .optional()
    .catch(undefined),
});

const MarketsPanelSchema = z.looseObject({
  fetchedAt: z.string(),
  quotes: rows(
    z.looseObject({
      id: z.string().regex(/^[a-z0-9-]{1,40}$/),
      name: z.string().min(1),
      unit: z.string().max(3),
      per: z.string().optional(),
      decimals: z.number().int().min(0).max(4),
      value: num,
      change: num,
      changePct: num,
      asOf: z.string(),
      history: rows(z.looseObject({ date: z.string(), value: num })),
      source: z.string(),
    }),
  ),
});

const TechPanelSchema = z.looseObject({
  fetchedAt: z.string(),
  repos: rows(z.looseObject({ name: z.string().min(1), url: httpUrl, stars: num, perDay: num.optional().catch(undefined), language: z.string().optional().catch(undefined), createdAt: z.string(), what: z.string().min(1) })),
  models: rows(z.looseObject({ name: z.string().min(1), url: httpUrl, likes: num, downloads: num, task: z.string().optional().catch(undefined), what: z.string().min(1) })),
  tools: rows(z.looseObject({ name: z.string().min(1), url: httpUrl, discussionUrl: httpUrl, points: num, comments: num, what: z.string().min(1) })),
});

const Movie = z.looseObject({ title: z.string().min(1), date: z.string(), url: httpUrl, poster: httpUrl.optional().catch(undefined), language: z.string().optional(), trailer: z.string().regex(/^[A-Za-z0-9_-]{11}$/).optional().catch(undefined) });
const CulturePanelSchema = z.looseObject({
  fetchedAt: z.string(),
  charts: rows(
    z.looseObject({
      id: z.string(),
      name: z.string().min(1),
      songs: rows(z.looseObject({ rank: z.number().int(), title: z.string().min(1), artist: z.string(), url: httpUrl, artwork: httpUrl.optional().catch(undefined) })),
    }),
  ),
  nowShowing: rows(Movie).optional().catch(undefined),
  comingSoon: rows(Movie).optional().catch(undefined),
});

export const PanelsSchema = z.looseObject({
  weather: WeatherPanelSchema.optional().catch(undefined),
  markets: MarketsPanelSchema.optional().catch(undefined),
  tech: TechPanelSchema.optional().catch(undefined),
  culture: CulturePanelSchema.optional().catch(undefined),
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
  panels: PanelsSchema.optional().catch(undefined),
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
