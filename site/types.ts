// The edition data contract (docs/superpowers/specs/2026-11-24-meridian-design.md).
// Type-only module: safe under Node's type stripping.

export type SectionId =
  | "india"
  | "world"
  | "business"
  | "science-tech"
  | "sports"
  | "health-environment"
  | "bengaluru";

export type Leaning = "left" | "centre-left" | "centre" | "centre-right" | "right";

export interface StoryImage {
  url: string;
  credit: string;
  sourceUrl: string;
  alt: string;
  width?: number;
  height?: number;
  kind: "outlet" | "wikimedia";
}

export interface StoryVideo {
  youtubeId: string;
  title: string;
  channel: string;
}

export interface StorySource {
  outlet: string;
  title: string;
  url: string;
  leaning?: Leaning;
}

export interface Perspective {
  label: string;
  summary: string;
  outlets: string[];
}

export interface Story {
  id: string;
  section: SectionId;
  rank: number;
  headline: string;
  dek: string;
  summary: string;
  body: string[];
  keyFacts: string[];
  background?: string;
  whyItMatters?: string;
  perspectives?: Perspective[];
  dateline?: string;
  developing?: boolean;
  image?: StoryImage;
  video?: StoryVideo;
  sources: StorySource[];
  tags: string[];
  readingMinutes: number;
}

export interface EditionSection {
  id: SectionId;
  name: string;
  storyIds: string[];
}

export interface Edition {
  id: string;
  date: string;
  slot: "morning" | "evening";
  publishedAt: string;
  lead: string[];
  sections: EditionSection[];
  stories: Story[];
  stats: { feedsScanned: number; itemsSeen: number; pagesRead: number; costUsd: number };
  /** Fixtures only (not part of the pipeline contract): marks invented sample content. */
  fixture?: boolean;
}
